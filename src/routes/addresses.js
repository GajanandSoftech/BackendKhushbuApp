const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const addressController = require('../controllers/addressController');
const { authMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');

// All address routes require authentication
router.use(authMiddleware);

router.get('/', addressController.getAddresses);
router.get('/:id', addressController.getAddressById);

router.post('/',
  [
    body('address_line1').trim().notEmpty().withMessage('Address line 1 required'),
    body('city').trim().notEmpty().withMessage('City required'),
    body('state').trim().notEmpty().withMessage('State required'),
    body('pincode').trim().notEmpty().withMessage('Pincode required'),
    body('address_type').optional().isIn(['home', 'work', 'other']),
    validate
  ],
  addressController.createAddress
);

router.put('/:id', addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);

module.exports = router;
