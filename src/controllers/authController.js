const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

// Register new user
const register = async (req, res, next) => {
  try {
    const { phone, name, email, password } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        phone,
        name,
        email,
        password: hashedPassword,
        role: 'user'
      })
      .select()
      .single();

    if (error) throw error;

    // Generate token
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
const getProfile = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, phone, email, role, is_active, created_at')
      .eq('id', req.userId)
      .single();

    if (error) throw error;

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

// Update user profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .update({ name, email, updated_at: new Date().toISOString() })
      .eq('id', req.userId)
      .select('id, name, phone, email, role')
      .single();

    if (error) throw error;

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

// Change user password
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', req.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password and update
    const hashed = await bcrypt.hash(newPassword, 10);

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ password: hashed, updated_at: new Date().toISOString() })
      .eq('id', req.userId)
      .select('id')
      .single();

    if (updateError) throw updateError;

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

// Delete user account
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.userId;

    // Delete user's orders
    await supabase
      .from('orders')
      .delete()
      .eq('user_id', userId);

    // Delete user's addresses
    await supabase
      .from('addresses')
      .delete()
      .eq('user_id', userId);

    // Delete user's cart items
    await supabase
      .from('cart')
      .delete()
      .eq('user_id', userId);

    // Delete the user account
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    res.json({
      message: 'Account successfully deleted. All associated data has been removed.'
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password - generate new password, update user, and email via nodemailer
const forgotPassword = async (req, res, next) => {
  try {
    const { identifier } = req.body; // phone or email
    if (!identifier) return res.status(400).json({ error: 'Identifier required' });

    // Try find by phone first
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', identifier)
      .single();

    if (error || !user) {
      // Try by email
      const { data: u2, error: e2 } = await supabase
        .from('users')
        .select('*')
        .eq('email', identifier)
        .single();
      user = u2;
      error = e2;
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate a simple random password
    const crypto = require('crypto');
    const newPassword = crypto.randomInt(0, 10000).toString().padStart(4, '0');

    const hashed = await bcrypt.hash(newPassword, 10);

    const { error: updateErr } = await supabase
      .from('users')
      .update({ password: hashed, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    const nodemailer = require('nodemailer');
    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = process.env.SMTP_PORT;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;
    const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;

    if (user.email && SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
        secure: SMTP_PORT == 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      const mailOptions = {
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Password reset - Your new password',
        text: `Hello ${user.name || ''},\n\nA new password has been generated for your account.\n\nEmail: ${user.email}\nPhone: ${user.phone}\nNew Password: ${newPassword}\n\nPlease login and change your password immediately.\n\nIf you did not request this, contact support.`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (mailErr) {
        console.error('Failed to send reset email', mailErr);
        // still return success since password updated; inform that email failed
        return res.json({ message: 'Password reset; email send failed', emailSent: false });
      }

      return res.json({ message: 'Password reset; email sent', emailSent: true });
    }

    // If no email configured or user has no email, still return success but indicate no email
    res.json({ message: 'Password reset (no email sent)', emailSent: false });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  forgotPassword
};
