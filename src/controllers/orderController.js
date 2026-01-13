const { supabase } = require('../config/supabase');

// Lightweight fetch helper (works with Node 18+ global fetch or falls back to node-fetch)
const doFetch = (...args) => {
  if (typeof fetch === 'function') return fetch(...args);
  return import('node-fetch').then(({ default: f }) => f(...args));
};

// Create new order
const createOrder = async (req, res, next) => {
  try {
    const { address_id, delivery_instructions, payment_method,delivery_fee } = req.body;

    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', req.userId);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Resolve product/variant info and check stock + compute totals
    const resolvedItems = [];
    let subtotal = 0;

    for (const item of cartItems) {
      // Resolve variant if present
      let variant = null;
      if (item.variant_id) {
        const { data: vData, error: vErr } = await supabase
          .from('product_variants')
          .select('id, price, product_id')
          .eq('id', item.variant_id)
          .single();
        if (vErr) throw vErr;
        variant = vData;
      }

      // Resolve product
      const productId = item.product_id || (variant ? variant.product_id : null);
      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('id, name')
        .eq('id', productId)
        .single();
      if (pErr) throw pErr;

      // Determine applicable price (variant price takes precedence)
      const unitPrice = (variant && variant.price != null)
        ? parseFloat(variant.price)
        : (product && product.price != null ? parseFloat(product.price) : null);

      if (unitPrice == null || Number.isNaN(unitPrice)) {
        // Missing price information: require variant pricing in this schema
        return res.status(500).json({ error: `Missing price for product ${product?.name || productId}. Ensure product_variants contain pricing or products table has a price.` });
      }

      const itemSubtotal = unitPrice * item.quantity;
      subtotal += itemSubtotal;

      resolvedItems.push({
        cartItem: item,
        product,
        variant,
        unitPrice,
        subtotal: itemSubtotal,
      });
    }

    const smallCartCharge = (subtotal ?? 0) < 350 ? 40 : 0;
    const total = subtotal + delivery_fee + smallCartCharge;

    // Create order
    const randomString = Math.random().toString(36).substring(2, 7).toUpperCase(); 
    const orderNumber = `ORD-${randomString}`;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: req.userId,
        order_number: orderNumber,
        address_id,
        subtotal,
        delivery_fee,
        small_cart_charge: smallCartCharge,
        total,
        status: 'pending',
        payment_method,
        payment_status: 'pending',
        delivery_instructions
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items using resolved data (insert subtotal and variant reference)
    const orderItemsPayload = resolvedItems.map((ri) => ({
      order_id: order.id,
      product_id: ri.product.id,
      variant_id: ri.variant ? ri.variant.id : null,
      quantity: ri.cartItem.quantity,
      subtotal: ri.subtotal,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload)
      .select();

    if (itemsError) throw itemsError;

    // Stock updates removed per request — do not modify variant/product stock here.

    // Clear cart
    await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', req.userId);

    const orderPayload = {
      ...order,
      order_items: insertedItems || orderItemsPayload
    };

    // Broadcast to connected SSE clients (best-effort)
    try {
      if (req && req.app && typeof req.app.locals.broadcastOrder === 'function') {
        req.app.locals.broadcastOrder(orderPayload);
      }
    } catch (e) {
      console.error('Failed to broadcast new order via SSE', e);
    }

    // Forward to external admin webhook if configured (to bridge to another backend)
    try {
      const webhookUrl = process.env.ADMIN_ORDER_WEBHOOK_URL;
      if (webhookUrl) {
        await doFetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: orderPayload })
        });
      }
    } catch (e) {
      console.error('Failed to forward order to admin webhook', e);
    }

    res.status(201).json({
      message: 'Order placed successfully',
      order: orderPayload
    });
  } catch (error) {
    next(error);
  }
};

// Get user orders
const getUserOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10, days } = req.query;

    let query = supabase
      .from('orders')
      .select(`
        *,
        address:addresses(
          address_line1, area, city, state, pincode, landmark
        ),
        order_items(
          *,
          product:products(id, name),
          variant:product_variants(id, unit, weight, image_url)
        )
      `, { count: 'exact' })
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by days if provided
    if (days) {
      const daysNum = parseInt(days);
      if (!isNaN(daysNum) && daysNum > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysNum);
        const cutoffIso = cutoffDate.toISOString();
        query = query.gte('created_at', cutoffIso);
      }
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: orders, error, count } = await query;

    if (error) throw error;

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get order by ID
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        address:addresses(*),
        order_items(
          *,
          product:products(id, name),
          variant:product_variants(id, unit, weight, image_url)
        )
      `)
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (error) throw error;

    res.json({ order });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'pending', 
      'confirmed', 
      'processing', 
      'out_for_delivery', 
      'delivered', 
      'cancelled',
      'return_initiated',
      'return_completed',
      'return_cancelled'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Verify order exists and user has permission
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (!existingOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Allow users to initiate/cancel returns on their own delivered orders
    const isReturnAction = ['return_initiated', 'return_cancelled'].includes(status);
    if (isReturnAction && existingOrder.user_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Validate return status transitions
    if (status === 'return_initiated' && existingOrder.status !== 'delivered') {
      return res.status(400).json({ success: false, error: 'Can only initiate return for delivered orders' });
    }

    if (status === 'return_cancelled' && existingOrder.status !== 'return_initiated') {
      return res.status(400).json({ success: false, error: 'Can only cancel an initiated return' });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        address:addresses(*),
        order_items(
          *,
          product:products(id, name),
          variant:product_variants(id, unit, weight, image_url)
        )
      `)
      .single();

    if (error) throw error;

    // Broadcast status change
    try {
      if (req && req.app && typeof req.app.locals.broadcastOrder === 'function') {
        req.app.locals.broadcastOrder(order);
      }
    } catch (e) {
      console.error('Failed to broadcast order update', e);
    }

    // For return-related status changes, also fetch a full order payload (including user)
    // and forward it to the admin webhook (if configured) and broadcast the richer payload.
    try {
      if (String(status || '').startsWith('return')) {
        try {
          const { data: fullOrder, error: fetchErr } = await supabase
            .from('orders')
            .select(`
              *,
              user:users(id, name, phone),
              address:addresses(*),
              order_items(
                *,
                product:products(id, name),
                variant:product_variants(id, unit, weight, image_url)
              )
            `)
            .eq('id', id)
            .single();

          if (!fetchErr && fullOrder) {
            const orderPayload = fullOrder;
            try {
              if (req && req.app && typeof req.app.locals.broadcastOrder === 'function') {
                req.app.locals.broadcastOrder(orderPayload);
              }
            } catch (e) {
              console.error('Failed to broadcast full order payload for return event', e);
            }

            try {
              const webhookUrl = process.env.ADMIN_ORDER_WEBHOOK_URL;
              if (webhookUrl) {
                await doFetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ order: orderPayload, event: status })
                });
              }
            } catch (e) {
              console.error('Failed to forward return order to admin webhook', e);
            }
          }
        } catch (e) {
          console.error('Error preparing return order payload:', e);
        }
      }
    } catch (e) {
      console.error('Return broadcast handling error', e);
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Cancel order
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get order
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'delivered' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot cancel this order' });
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Restore product stock
    for (const item of order.order_items) {
      await supabase.rpc('increment_stock', {
        product_id: item.product_id,
        quantity: item.quantity
      });
    }

    // Fetch the full updated order (including user/address/items) to send to admin
    try {
      const { data: fullOrder, error: fetchErr } = await supabase
        .from('orders')
        .select(`
          *,
          user:users(id, name, phone),
          address:addresses(*),
          order_items(
            *,
            product:products(id, name),
            variant:product_variants(id, unit, weight, image_url)
          )
        `)
        .eq('id', id)
        .single();

      if (fetchErr) {
        console.error('Failed to fetch full order after cancel:', fetchErr);
      } else {
        const orderPayload = fullOrder;
        // Broadcast locally if available
        try {
          if (req && req.app && typeof req.app.locals.broadcastOrder === 'function') {
            req.app.locals.broadcastOrder(orderPayload);
          }
        } catch (e) {
          console.error('Failed to broadcast cancelled order locally', e);
        }

        // Forward to external admin webhook if configured
        try {
          const webhookUrl = process.env.ADMIN_ORDER_WEBHOOK_URL;
          if (webhookUrl) {
            await doFetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: orderPayload })
            });
          }
        } catch (e) {
          console.error('Failed to forward cancelled order to admin webhook', e);
        }
      }
    } catch (e) {
      console.error('Error preparing cancelled order payload:', e);
    }

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
};