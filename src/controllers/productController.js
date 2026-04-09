const { supabase } = require("../config/supabase");

const formatProductWithVariants = (product) => {
  const variants = product.product_variants || [];

  // Find default variant
  let defaultVariant = variants.find((v) => v.is_default && v.is_active);

  if (!defaultVariant && variants.length > 0) {
    defaultVariant = variants
      .filter((v) => v.is_active)
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
  }

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category_id: product.category_id,
    subcategory_id: product.subcategory_id,

    image_url: defaultVariant?.image_url || product.image_url || null,

    rating: product.rating || 0,
    is_active: product.is_active,
    is_featured: product.is_featured || false,
    created_at: product.created_at,
    updated_at: product.updated_at,

    variants: variants.map((v) => ({
      id: v.id,
      price: parseFloat(v.price),
      original_price: v.original_price ? parseFloat(v.original_price) : null,
      weight: v.weight,
      unit: v.unit,
      image_url: v.image_url, // ✅ ADDED
      is_default: v.is_default,
      is_active: v.is_active,
    })),

    // Backward compatibility
    price: defaultVariant ? parseFloat(defaultVariant.price) : 0,
    original_price: defaultVariant?.original_price
      ? parseFloat(defaultVariant.original_price)
      : null,
    weight: defaultVariant?.weight || "1",
    unit: defaultVariant?.unit || "pc",

    category: product.category,
    subcategory: product.subcategory,
  };
};

// Get all products with filters
const getAllProducts = async (req, res, next) => {
  try {
    const {
      category_id,
      subcategory_id,
      search,
      min_price,
      max_price,
      sort_by = "created_at",
      order = "desc",
      page = 1,
      limit = 100,
    } = req.query;

    let query = supabase
      .from("products")
      .select(
        `
        *,
        category:categories(id, name),
        subcategory:subcategories(id, name),
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

      `,
        { count: "exact" }
      )
      .eq("is_active", true);

    // Filters
    if (category_id) query = query.eq("category_id", category_id);
    if (subcategory_id) query = query.eq("subcategory_id", subcategory_id);
    if (search) query = query.ilike("name", `%${search}%`);

    // Sorting
    query = query.order(sort_by, { ascending: order === "asc" });

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: products, error, count } = await query;

    if (error) throw error;

    // Format products with variants
    const formattedProducts = products.map(formatProductWithVariants);

    // Apply price filters after fetching (since price is in variants table)
    let filteredProducts = formattedProducts;
    if (min_price) {
      filteredProducts = filteredProducts.filter(
        (p) => p.price >= parseFloat(min_price)
      );
    }
    if (max_price) {
      filteredProducts = filteredProducts.filter(
        (p) => p.price <= parseFloat(max_price)
      );
    }

    res.json({
      products: filteredProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredProducts.length,
        totalPages: Math.ceil(filteredProducts.length / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single product by ID
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "Product ID is required" });
    }

    const { data: product, error } = await supabase
      .from("products")
      .select(
        `
        *,
        category:categories(id, name),
        subcategory:subcategories(id, name),
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

      `
      )
      .eq("id", id)
      .single();

    if (error || !product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    const formattedProduct = formatProductWithVariants(product);

    return res.status(200).json({
      success: true,
      product: formattedProduct,
    });
  } catch (error) {
    console.error("❌ Exception in getProductById:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch product",
    });
  }
};

// Get featured products
const getFeaturedProducts = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const { data: products, error } = await supabase
      .from("products")
      .select(
        `
        *,
        category:categories(id, name),
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

      `
      )
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const formattedProducts = products.map(formatProductWithVariants);

    res.json({ products: formattedProducts });
  } catch (error) {
    next(error);
  }
};

// Search products
const searchProducts = async (req, res, next) => {
  try {
    const { q } = req.query;
    // parse and cap limit to avoid heavy queries from clients
    const rawLimit = parseInt(req.query.limit, 10);
    const DEFAULT_LIMIT = 10;
    const MAX_LIMIT = 10;
    const limit =
      Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    if (!q) {
      return res.status(400).json({ error: "Search query required" });
    }

    const { data: products, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        image_url,
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

      `
      )
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .limit(limit);

    if (error) throw error;

    const formattedProducts = products.map(formatProductWithVariants);

    res.json({ products: formattedProducts });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  getFeaturedProducts,
  searchProducts,
};
