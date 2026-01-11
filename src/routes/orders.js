const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const orderController = require('../controllers/orderController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');

// User routes
router.post('/',
  authMiddleware,
  [
    body('address_id').isUUID().withMessage('Valid address ID required'),
    body('payment_method').isIn(['cod', 'online', 'wallet']).withMessage('Valid payment method required'),
    validate
  ],
  orderController.createOrder
);

router.get('/', authMiddleware, orderController.getUserOrders);
router.get('/:id', authMiddleware, orderController.getOrderById);
router.post('/:id/cancel', authMiddleware, orderController.cancelOrder);

// User return requests (no admin required)
router.post('/:id/return/initiate', authMiddleware, (req, res, next) => {
  req.body.status = 'return_initiated';
  return orderController.updateOrderStatus(req, res, next);
});

router.post('/:id/return/cancel', authMiddleware, (req, res, next) => {
  req.body.status = 'return_cancelled';
  return orderController.updateOrderStatus(req, res, next);
});

router.put('/:id/status',
  authMiddleware,
  adminMiddleware,
  [
    body('status').isIn(['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled', 'return_initiated', 'return_completed', 'return_cancelled']),
    validate
  ],
  orderController.updateOrderStatus
);

module.exports = router;
