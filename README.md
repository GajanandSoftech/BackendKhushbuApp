# Khushi Glossary Store - Backend Server

Complete Node.js Express backend for the Khushi Glossary mobile grocery delivery app with Supabase database integration.

## 🚀 Features

- **RESTful API** with Express.js
- **Supabase** database integration
- **JWT Authentication** with OTP verification
- **MVC Architecture** for clean code organization
- **Input Validation** with express-validator
- **Error Handling** with custom middleware
- **Rate Limiting** for API protection
- **CORS** configuration
- **File Upload** support with Multer
- **Security** with Helmet.js

## 📁 Project Structure

```
app-server/
├── src/
│   ├── config/
│   │   └── supabase.js          # Supabase client configuration
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   ├── productController.js  # Product CRUD operations
│   │   ├── categoryController.js # Category management
│   │   ├── cartController.js     # Shopping cart operations
│   │   ├── orderController.js    # Order management
│   │   └── addressController.js  # User address management
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication middleware
│   │   ├── errorHandler.js      # Global error handler
│   │   └── validate.js          # Input validation middleware
│   ├── routes/
│   │   ├── auth.js              # Auth routes
│   │   ├── products.js          # Product routes
│   │   ├── categories.js        # Category routes
│   │   ├── cart.js              # Cart routes
│   │   ├── orders.js            # Order routes
│   │   └── addresses.js         # Address routes
│   ├── utils/
│   │   └── jwt.js               # JWT helper functions
│   ├── app.js                   # Express app configuration
│   └── server.js                # Server entry point
├── uploads/                     # File upload directory
├── .env.example                 # Environment variables template
├── package.json                 # Dependencies
└── README.md                    # Documentation
```

## 🛠️ Installation

### 1. Install Dependencies

```bash
cd app-server
npm install
```

### 2. Setup Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006
```

### 3. Setup Supabase Database

Run the SQL schema in your Supabase project (see `database-schema.sql`)

### 4. Start the Server

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

Server will run on `http://localhost:5000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with phone/password
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP
- `GET /api/auth/profile` - Get user profile (protected)
- `PUT /api/auth/profile` - Update user profile (protected)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID
- `GET /api/categories/:categoryId/subcategories` - Get subcategories
- `POST /api/categories` - Create category (admin)
- `PUT /api/categories/:id` - Update category (admin)
- `DELETE /api/categories/:id` - Delete category (admin)

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/featured` - Get featured products
- `GET /api/products/search?q=query` - Search products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Cart
- `GET /api/cart` - Get user cart (protected)
- `POST /api/cart/items` - Add item to cart (protected)
- `PUT /api/cart/items/:id` - Update cart item (protected)
- `DELETE /api/cart/items/:id` - Remove item from cart (protected)
- `DELETE /api/cart` - Clear cart (protected)

### Orders
- `POST /api/orders` - Create new order (protected)
- `GET /api/orders` - Get user orders (protected)
- `GET /api/orders/:id` - Get order by ID (protected)
- `POST /api/orders/:id/cancel` - Cancel order (protected)
- `GET /api/orders/admin/all` - Get all orders (admin)
- `PUT /api/orders/:id/status` - Update order status (admin)

### Addresses
- `GET /api/addresses` - Get user addresses (protected)
- `GET /api/addresses/:id` - Get address by ID (protected)
- `POST /api/addresses` - Create address (protected)
- `PUT /api/addresses/:id` - Update address (protected)
- `DELETE /api/addresses/:id` - Delete address (protected)

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Protected routes require the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

## 📝 Request Examples

### Register User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "phone": "9876543210",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "phone": "9876543210",
  "password": "password123"
}
```

### Get Products with Filters
```bash
GET /api/products?category_id=<uuid>&search=apple&min_price=10&max_price=100&page=1&limit=20
```

### Add to Cart
```bash
POST /api/cart/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "<product_uuid>",
  "quantity": 2
}
```

### Create Order
```bash
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "address_id": "<address_uuid>",
  "payment_method": "cod",
  "delivery_instructions": "Ring the bell twice"
}
```

## 🔧 Database Schema

The backend requires the following tables in Supabase:

- `users` - User accounts
- `otp_verifications` - OTP storage for verification
- `categories` - Product categories
- `subcategories` - Product subcategories
- `products` - Product inventory
- `cart_items` - Shopping cart items
- `addresses` - User delivery addresses
- `orders` - Order records
- `order_items` - Order line items

See `database-schema.sql` for the complete schema.

## 🛡️ Security Features

- **Helmet.js** - Sets security HTTP headers
- **CORS** - Configurable cross-origin requests
- **Rate Limiting** - Prevents API abuse
- **JWT** - Secure token-based authentication
- **Bcrypt** - Password hashing
- **Input Validation** - Validates all user inputs

## 📦 Dependencies

- `express` - Web framework
- `@supabase/supabase-js` - Supabase client
- `jsonwebtoken` - JWT authentication
- `bcryptjs` - Password hashing
- `express-validator` - Input validation
- `cors` - CORS middleware
- `helmet` - Security headers
- `morgan` - HTTP request logger
- `multer` - File upload handling
- `dotenv` - Environment variables

## 🧪 Testing

Test the API health:
```bash
curl http://localhost:5000/health
```

## 🚀 Deployment

1. Set `NODE_ENV=production` in environment
2. Configure production Supabase credentials
3. Update `ALLOWED_ORIGINS` with your frontend URLs
4. Use a strong `JWT_SECRET`
5. Deploy to your preferred hosting (Heroku, Railway, Render, etc.)

## 📄 License

ISC

## 👥 Support

For issues or questions, please contact the development team.
