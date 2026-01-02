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

// Change password (protected)
router.post('/change-password',
  authMiddleware,
  [
    body('oldPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    validate
  ],
  authController.changePassword
);

// Delete account (protected)
router.post('/delete-account',
  authMiddleware,
  authController.deleteAccount
);

// Forgot password (send new password via email)
router.post('/forgot-password',
  [
    body('identifier').trim().notEmpty().withMessage('Phone or email required'),
    validate
  ],
  authController.forgotPassword
);

module.exports = router;
