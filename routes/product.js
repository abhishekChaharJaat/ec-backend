import express from "express";
import userModal from "../modals/userModal.js"; // Unused in these routes, but kept
import productModal from "../modals/productModal.js"; // Model for products
import { requireSignin, isAdmin } from "../middlewares/authMiddleware.js";
import { uploadImage } from "../middlewares/multer.js";
import cartModal from "../modals/cartModal.js";

const router = express.Router();

// ========================== Add a product ================================ //
router.post(
  "/add-new-product",
  requireSignin,
  isAdmin,
  uploadImage.single("thumbnail"),
  async (req, res) => {
    try {
      // Extract product data from request body
      const productData = req.body;

      // Create a new product instance using productModal
      const newProduct = new productModal(productData);

      // Save to MongoDB
      const savedProduct = await newProduct.save();

      // Send success response
      res.status(201).json({
        success: true,
        message: "Product added successfully",
        product: savedProduct,
      });
    } catch (error) {
      // Handle validation errors
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
      }

      res.status(500).json({
        success: false,
        message: "Server error while adding product",
      });
    }
  }
);

// ==================== fetch all products =================================//
router.get("/get-all-products", async (req, res) => {
  try {
    // Fetch all products from the database
    const products = await productModal.find({});

    // Send success response with products
    res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      products: products,
    });
  } catch (error) {
    // Handle server errors
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
    });
  }
});

// ==================== Add To Cart Route ============================== //
router.post("/add-to-cart", requireSignin, async (req, res) => {
  try {
    const { productId, color, qty, size } = req.body;

    // Ensure productId, color, and qty are provided
    if (!productId || !color || !qty) {
      return res.status(400).json({
        success: false,
        message: "Product ID, color, and quantity are required",
      });
    }
    // Check if the product already exists in the cart for the user
    const existingCartItem = await cartModal.findOne({
      userId: req.user._id, // Assuming user ID is attached to req.user from requireSignin middleware
      productId,
    });
    if (existingCartItem) {
      // If the item already exists, update the quantity
      existingCartItem.qty += qty; // You can adjust how the quantity is handled here
      await existingCartItem.save();
      return res.status(200).json({
        success: true,
        message: "Product quantity updated in cart",
        cartItem: existingCartItem,
      });
    }

    // If the product is not already in the cart, create a new cart item
    const newCartItem = new cartModal({
      userId: req.user._id,
      productId,
      color,
      qty,
    });

    // Save the new cart item to the database
    const savedCartItem = await newCartItem.save();

    // Send success response
    res.status(201).json({
      success: true,
      message: "Product added to cart",
      cartItem: savedCartItem,
    });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding product to cart",
    });
  }
});

router.get("/fetch-cart-items", requireSignin, async (req, res) => {
  try {
    // Fetch cart items for the authenticated user
    const cartItems = await cartModal
      .find({ userId: req.user._id }) // Still using userId to filter the cart items
      .populate("productId", "name description price thumbnail"); // Populate product details

    // Prepare cartItems response excluding sensitive user information
    const responseCartItems = cartItems.map((item) => {
      const { userId, productId, ...itemData } = item.toObject();

      // Rename productId to productDetails in the response
      return {
        ...itemData,
        productInfo: productId, // Renaming productId to productDetails
      };
    });

    // Send success response with the cart items
    res.status(200).json({
      success: true,
      message: "Cart items retrieved successfully",
      cartItems: responseCartItems,
    });
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching cart items",
    });
  }
});

// ==================== Delete Cart Item Route ============================== //
router.delete(
  "/delete-cart-item/:productId",
  requireSignin,
  async (req, res) => {
    try {
      const { productId } = req.params; // Extract productId from URL params
      // Find the cart item for the authenticated user and the specific productId
      const cartItem = await cartModal.findOneAndDelete({
        userId: req.user._id, // Ensure that the cart item belongs to the current user
        productId: productId, // The product to be deleted
      });

      if (!cartItem) {
        return res.status(404).json({
          success: false,
          message: "Cart item not found",
        });
      }

      // Send success response
      res.status(200).json({
        success: true,
        message: "Item removed",
        id: cartItem._id,
      });
    } catch (error) {
      console.error("Error deleting cart item:", error);
      res.status(500).json({
        success: false,
        message: "Server error while deleting cart item",
      });
    }
  }
);

export default router;
