const { supabase } = require('../config/supabase');

// Get user addresses
const getAddresses = async (req, res, next) => {
  try {
    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', req.userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ addresses });
  } catch (error) {
    next(error);
  }
};

// Get address by ID
const getAddressById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: address, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (error) throw error;

    res.json({ address });
  } catch (error) {
    next(error);
  }
};

// Create address
const createAddress = async (req, res, next) => {
  try {
    const {
      address_line1,
      area,
      city,
      state,
      pincode,
      landmark,
      latitude,
      longitude,
      address_type,
      is_default
    } = req.body;

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', req.userId);
    }

    const { data: address, error } = await supabase
      .from('addresses')
      .insert({
        user_id: req.userId,
        address_line1,
        area,
        city,
        state,
        pincode,
        landmark,
        latitude,
        longitude,
        address_type: address_type || 'home',
        is_default: is_default || false
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Address added successfully',
      address
    });
  } catch (error) {
    next(error);
  }
};

// Update address
const updateAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // If setting as default, unset other defaults
    if (updateData.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', req.userId)
        .neq('id', id);
    }

    const { data: address, error } = await supabase
      .from('addresses')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Address updated successfully',
      address
    });
  } catch (error) {
    next(error);
  }
};

// Delete address
const deleteAddress = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) throw error;

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress
};
