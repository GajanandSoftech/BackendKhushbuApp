const { supabase } = require('../config/supabase');

// Get all categories with subcategories
const getAllCategories = async (req, res, next) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select(`
        *,
        subcategories (*)
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    res.json({ categories });
  } catch (error) {
    next(error);
  }
};

// Get single category with subcategories
const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: category, error } = await supabase
      .from('categories')
      .select(`
        *,
        subcategories (*)
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) throw error;

    res.json({ category });
  } catch (error) {
    next(error);
  }
};

// Create category (Admin only)
const createCategory = async (req, res, next) => {
  try {
    const { name, icon, display_order } = req.body;

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        name,
        icon,
        display_order,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    next(error);
  }
};

// Update category (Admin only)
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, icon, display_order, is_active } = req.body;

    const { data: category, error } = await supabase
      .from('categories')
      .update({
        name,
        icon,
        display_order,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    next(error);
  }
};

// Delete category (Admin only)
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get subcategories by category
const getSubcategories = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const { data: subcategories, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    res.json({ subcategories });
  } catch (error) {
    next(error);
  }
};

// Create subcategory (Admin only)
const createSubcategory = async (req, res, next) => {
  try {
    const { category_id, name, icon, display_order } = req.body;

    const { data: subcategory, error } = await supabase
      .from('subcategories')
      .insert({
        category_id,
        name,
        icon,
        display_order,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Subcategory created successfully',
      subcategory
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubcategories,
  createSubcategory
};
