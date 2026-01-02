const { supabase } = require('../config/supabase');

// Create new order
const createOrder = async (req, res, next) => {
  try {
    const { address_id, delivery_instructions, payment_method } = req.body;

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

    // Determine delivery fee based on address and subtotal (mirror frontend CheckoutScreen)
    let deliveryFee = 40;
    try {
      let address = null;
      if (address_id) {
        const { data: addrData, error: addrErr } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', address_id)
          .single();
        if (!addrErr) address = addrData;
      }

      // If no explicit address provided, try to find user's default address
      if (!address) {
        const { data: defAddr, error: defErr } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', req.userId)
          .eq('is_default', true)
          .limit(1)
          .single();
        if (!defErr) address = defAddr;
      }

      const addrPincode = address ? String(address.pincode || '') : '';
      const addrLine = address ? String(address.address_line1 || '') : '';
      const addrArea = address ? String(address.area || address.locality || '') : '';
      const isManinagar = /maninagar/i.test(`${addrArea} ${addrLine}`);

      if ((subtotal ?? 0) < 250) {
        deliveryFee = 40;
      } else if (isManinagar) {
        deliveryFee = 0;
      } else if (!address || addrPincode !== '380008') {
        deliveryFee = 40;
      } else {
        deliveryFee = 0;
      }
    } catch (err) {
      deliveryFee = 40;
    }

    const total = subtotal + deliveryFee;

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
        delivery_fee: deliveryFee,
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

    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        ...order,
        items: insertedItems || orderItemsPayload
      }
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

// Update order status (Admin only)
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Order status updated',
      order
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

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

// Get all orders (Admin only)
const getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('orders')
      .select(`
        *,
        user:users(id, name, phone),
        order_items(
          *,
          product:products(id, name),
          variant:product_variants(id, unit, weight, image_url)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
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

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAllOrders
};
