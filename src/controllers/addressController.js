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

    // compute delivery fee server-side if coords provided
    let delivery_fee = null;
    try {
      const { getDeliveryFee } = require('../utils/delivery');
      // default store coords; override via env if available
      const storeLat = parseFloat(process.env.STORE_LAT || '23.03');
      const storeLng = parseFloat(process.env.STORE_LNG || '72.60');
      if (latitude != null && longitude != null) {
        const latNum = Number(latitude);
        const lngNum = Number(longitude);
        if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
          const res = getDeliveryFee(storeLat, storeLng, latNum, lngNum);
          delivery_fee = res.fee;
        }
      }
    } catch (e) {
      // ignore delivery calc errors
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', req.userId);
    }

    const insertObj = {
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
    };
    if (delivery_fee != null) insertObj.delivery_fee = delivery_fee;

    const { data: address, error } = await supabase
      .from('addresses')
      .insert(insertObj)
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

    // if latitude/longitude included in updateData, recompute delivery_fee
    try {
      const { getDeliveryFee } = require('../utils/delivery');
      const storeLat = parseFloat(process.env.STORE_LAT || '23.03');
      const storeLng = parseFloat(process.env.STORE_LNG || '72.60');
      if (updateData.latitude != null && updateData.longitude != null) {
        const latNum = Number(updateData.latitude);
        const lngNum = Number(updateData.longitude);
        if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
          const res = getDeliveryFee(storeLat, storeLng, latNum, lngNum);
          updateData.delivery_fee = res.fee;
        }
      }
    } catch (e) {
      // ignore
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