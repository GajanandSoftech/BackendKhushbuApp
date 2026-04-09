const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const validate = require("../middleware/validate");

router.get("/featured", productController.getFeaturedProducts);
router.get("/search", productController.searchProducts);
router.get("/:id", productController.getProductById); 

router.get("/", productController.getAllProducts);

module.exports = router;