const { supabase } = require('../config/supabase');

// Helper: basic UUID format check to avoid passing invalid IDs to Postgres
const isLikelyUuid = (val) => {
  return typeof val === 'string' && val.length === 36 && val.indexOf('-') !== -1;
};

// Helper: pick default or first active variant
const pickVariant = (product) => {
  const variants = product?.product_variants || [];
  const vDefault = variants.find(v => v.is_default && v.is_active);
  const vActive = variants.find(v => v.is_active);
  return vDefault || vActive || variants[0] || null;
};

// Helper: fetch products with variants by ids
const fetchProductsByIds = async (ids) => {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, name,
      product_variants(
  id,
  price,
  original_price,
  weight,
  unit,
  image_url,
  is_default,
  is_active
)

    `)
    .in('id', ids);
  if (error) throw error;
  return data;
};

// Get user cart
const getCart = async (req, res, next) => {
  try {
    // Step 1: get cart items (no join)
    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', req.userId);
    if (error) throw error;

    // Step 2: fetch needed products with variants
    const productIds = [...new Set(cartItems.map(i => i.product_id))];
    const products = await fetchProductsByIds(productIds);
    const productMap = new Map(products.map(p => [p.id, p]));

    // Step 3: attach variant-derived fields
    const itemsWithVariant = cartItems.map(item => {
      const product = productMap.get(item.product_id) || null;
      // If cart item stores a variant_id, prefer that variant
      const variant = product
        ? (item.variant_id
            ? product.product_variants.find(v => v.id === item.variant_id) || pickVariant(product)
            : pickVariant(product))
        : null;

      return {
        ...item,
        product: product
          ? {
              ...product,
              selected_variant: variant,
              price: variant?.price ?? null,
              original_price: variant?.original_price ?? null,
              unit: variant?.unit ?? null,
              weight: variant?.weight ?? null,
            }
          : null,
      };
    });

    const itemTotal = itemsWithVariant.reduce((sum, item) => {
      const price = item.product?.selected_variant?.price ?? 0;
      return sum + price * item.quantity;
    }, 0);

    const savings = itemsWithVariant.reduce((sum, item) => {
      const v = item.product?.selected_variant;
      if (v?.original_price) {
        return sum + (v.original_price - v.price) * item.quantity;
      }
      return sum;
    }, 0);

    res.json({
      items: itemsWithVariant,
      summary: {
        itemTotal,
        savings,
        deliveryFee: 0,
        total: itemTotal,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Add item to cart
const addToCart = async (req, res, next) => {
  try {
    const { product_id, quantity = 1, variant_id } = req.body;

    // Ensure product exists and get variants
    const [product] = await fetchProductsByIds([product_id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    // If client provided a variant_id, prefer that (and validate it's active)
    let variant = null;
    if (variant_id) {
      variant = product.product_variants.find(v => v.id === variant_id && v.is_active);
      if (!variant) {
        return res.status(400).json({ error: 'Requested variant is not available' });
      }
    } else {
      variant = pickVariant(product);
      if (!variant) {
        return res.status(400).json({ error: 'No active variant available for this product' });
      }
    }

    // Check if item already in cart. If variant specified, match variant too so different variants create separate items.
    let existingQuery = supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', req.userId)
      .eq('product_id', product_id);
    if (variant_id) {
      existingQuery = existingQuery.eq('variant_id', variant_id);
    }
    const { data: existingItem } = await existingQuery.single();

    let cartItem;
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', existingItem.id)
        .select('*')
        .single();
      if (error) throw error;
      cartItem = data;
    } else {
      // insert with variant_id when provided
      const insertData = { user_id: req.userId, product_id, quantity };
      if (variant_id) insertData.variant_id = variant_id;

      const { data, error } = await supabase
        .from('cart_items')
        .insert(insertData)
        .select('*')
        .single();
      if (error) throw error;
      cartItem = data;
    }

    // Use the variant we validated/selected above
    const cartItemWithVariant = {
      ...cartItem,
      product: {
        ...product,
        selected_variant: variant,
        price: variant?.price ?? null,
        original_price: variant?.original_price ?? null,
        unit: variant?.unit ?? null,
        weight: variant?.weight ?? null,
      },
    };

    res.status(201).json({
      message: 'Item added to cart',
      cartItem: cartItemWithVariant
    });
  } catch (error) {
    next(error);
  }
};

// Update cart item quantity
const updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Reject temp/invalid ids early to avoid DB UUID parse errors
    if (!isLikelyUuid(id)) {
      return res.status(400).json({ error: 'Invalid cart item id' });
    }
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    const { data: updatedItem, error } = await supabase
      .from('cart_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select('*')
      .single();
    if (error) throw error;

    // fetch product for this item to return consistent shape
    const [product] = await fetchProductsByIds([updatedItem.product_id]);
    const v = product
      ? (updatedItem.variant_id
          ? product.product_variants.find(x => x.id === updatedItem.variant_id) || pickVariant(product)
          : pickVariant(product))
      : null;
    res.json({
      message: 'Cart updated',
      cartItem: {
        ...updatedItem,
        product: product
          ? {
              ...product,
              selected_variant: v,
              price: v?.price ?? null,
              original_price: v?.original_price ?? null,
              unit: v?.unit ?? null,
              weight: v?.weight ?? null,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Remove item from cart
const removeFromCart = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isLikelyUuid(id)) {
      return res.status(400).json({ error: 'Invalid cart item id' });
    }

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) throw error;

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    next(error);
  }
};

// Clear cart
const clearCart = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', req.userId);

    if (error) throw error;

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};
