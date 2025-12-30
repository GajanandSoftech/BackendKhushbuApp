const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const categoryController = require('../controllers/categoryController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:categoryId/subcategories', categoryController.getSubcategories);

// Admin routes
router.post('/',
  authMiddleware,
  adminMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('icon').optional().trim(),
    body('display_order').optional().isInt(),
    validate
  ],
  categoryController.createCategory
);

router.put('/:id',
  authMiddleware,
  adminMiddleware,
  [
    body('name').optional().trim().notEmpty(),
    body('icon').optional().trim(),
    body('display_order').optional().isInt(),
    body('is_active').optional().isBoolean(),
    validate
  ],
  categoryController.updateCategory
);

router.delete('/:id', authMiddleware, adminMiddleware, categoryController.deleteCategory);

router.post('/subcategories',
  authMiddleware,
  adminMiddleware,
  [
    body('category_id').isUUID().withMessage('Valid category ID required'),
    body('name').trim().notEmpty().withMessage('Name required'),
    body('icon').optional().trim(),
    body('display_order').optional().isInt(),
    validate
  ],
  categoryController.createSubcategory
);

module.exports = router;
