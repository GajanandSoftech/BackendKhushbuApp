const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Public routes - ORDER MATTERS! Specific routes before generic ones
router.get('/featured', productController.getFeaturedProducts);
router.get('/search', productController.searchProducts);
router.get('/:id', productController.getProductById);  // Must be AFTER /featured and /search
router.get('/', productController.getAllProducts);

// Admin routes
router.post('/',
  authMiddleware,
  adminMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
    body('category_id').isUUID().withMessage('Valid category ID required'),
    body('unit').trim().notEmpty().withMessage('Unit required'),
    body('weight').trim().notEmpty().withMessage('Weight required'),
    body('stock_quantity').isInt({ min: 0 }).withMessage('Valid stock quantity required'),
    validate
  ],
  productController.createProduct
);

router.put('/:id',
  authMiddleware,
  adminMiddleware,
  productController.updateProduct
);

router.delete('/:id',
  authMiddleware,
  adminMiddleware,
  productController.deleteProduct
);

module.exports = router;
