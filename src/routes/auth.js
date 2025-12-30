const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Register
router.post('/register',
  [
    body('phone').isMobilePhone().withMessage('Valid phone number required'),
    body('name').trim().notEmpty().withMessage('Name required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
  ],
  authController.register
);

// Login
router.post('/login',
  [
    body('phone').isMobilePhone().withMessage('Valid phone number required'),
    body('password').notEmpty().withMessage('Password required'),
    validate
  ],
  authController.login
);

// Send OTP
router.post('/send-otp',
  [
    body('phone').isMobilePhone().withMessage('Valid phone number required'),
    validate
  ],
  authController.sendOTP
);

// Verify OTP
router.post('/verify-otp',
  [
    body('phone').isMobilePhone().withMessage('Valid phone number required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Valid OTP required'),
    validate
  ],
  authController.verifyOTP
);

// Get profile (protected)
router.get('/profile', authMiddleware, authController.getProfile);

// Update profile (protected)
router.put('/profile',
  authMiddleware,
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    validate
  ],
  authController.updateProfile
);

module.exports = router;
