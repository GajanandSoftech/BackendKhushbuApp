const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const cartController = require('../controllers/cartController');
const { authMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');

// All cart routes require authentication
router.use(authMiddleware);

router.get('/', cartController.getCart);

router.post('/items',
  [
    body('product_id').isUUID().withMessage('Valid product ID required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validate
  ],
  cartController.addToCart
);

router.put('/items/:id',
  [
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validate
  ],
  cartController.updateCartItem
);

router.delete('/items/:id', cartController.removeFromCart);
router.delete('/', cartController.clearCart);

module.exports = router;
