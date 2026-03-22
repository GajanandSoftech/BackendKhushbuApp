const { supabase } = require("../config/supabase");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// Register new user
const register = async (req, res, next) => {
  try {
    const { phone, name, email, password } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: "Phone number already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: user, error } = await supabase
      .from("users")
      .insert({
        phone,
        name,
        email,
        password: hashedPassword,
        role: "user",
      })
      .select()
      .single();

    if (error) throw error;

    // Generate token
    const token = generateToken(user.id, user.role);

    // 📧 Send Welcome Email
    if (user.email) {
      const logoUrl = "https://khushbumart.in/pwa-512x512.png";

      const playStoreLink = "https://play.google.com/store/apps/details?id=com.anonymous.clientmobile";
      const appStoreLink = "https://apps.apple.com/in/app/khushbu-mart/id6758760045";

      await resend.emails.send({
        from: "Khushbu Mart <noreply@khushbumart.in>",
        to: user.email,
        subject: "Welcome to Khushbu Mart",
        html: `
    <div style="font-family: Arial, sans-serif; background:#f4f4f4;">
      <div style="margin:auto; background:#ffffff; padding:30px; border-radius:8px; text-align:center;">

        <h2 style="color:#28a745;">Welcome to Khushbu Mart 🥦🍎</h2>

        <p style="color:#555;">Hello ${user.name || ""},</p>

        <p style="color:#555;">
          Thank you for registering with <b>Khushbu Mart</b>!
        </p>

        <p style="color:#555;">
          You can now order fresh fruits 🍎 and vegetables 🥦 directly from our app,
          delivered quickly to your doorstep.
        </p>

        <p style="color:#888; font-size:13px; margin-top:15px; line-height:1.5;">
  <b>Note:</b> If your account is inactive, please contact us on this number 
  <a href="tel:+919904667665" style="color:#28a745; text-decoration:none;">
    +91 99046 67665
  </a>, <a href="tel:+917043752207" style="color:#28a745; text-decoration:none;">
    +91 70437 52207
  </a> 
  to activate your account.
</p>

        <a href="https://khushbumart.in/open-app"
           style="display:inline-block;
                  padding:12px 20px;
                  background-color:#28a745;
                  color:#ffffff;
                  text-decoration:none;
                  border-radius:5px;
                  margin:20px 0;">
          Start Shopping
        </a>

        <hr style="margin:25px 0;" />

        <p style="color:#555;">
          Enjoying the app? We'd love your feedback ❤️
        </p>

        <!-- Play Store Button -->
      <a href="${playStoreLink}"
         style="display:inline-block;
                padding:12px 18px;
                background-color:#28a745;
                color:#ffffff;
                text-decoration:none;
                border-radius:5px;
                margin:8px;">
        📱 Review on Play Store
      </a>

      <br/>

      <!-- App Store Button -->
      <a href="${appStoreLink}"
         style="display:inline-block;
                padding:12px 18px;
                background-color:#000000;
                color:#ffffff;
                text-decoration:none;
                border-radius:5px;
                margin:8px;">
        🍎 Review on App Store
      </a>

        <hr style="margin:25px 0;" />

        <!-- Logo -->
        <div style="margin-top:20px;">
          <img src="${logoUrl}"
               alt="Khushbu Mart"
               width="140"
               style="display:block; margin:0 auto; border-radius:16%;" />
        </div>

        <div style="margin-top:20px; font-size:12px; color:#777; text-align:center;">
  
  <a href="https://khushbumart.in/privacy-policy"
     style="color:#28a745; text-decoration:none; margin:0 5px;">
    Privacy Policy
  </a>

  |

  <a href="https://khushbumart.in/terms-and-conditions"
     style="color:#28a745; text-decoration:none; margin:0 5px;">
    Terms & Conditions
  </a>

  |

  <a href="https://khushbumart.in/return-and-refund-policy"
     style="color:#28a745; text-decoration:none; margin:0 5px;">
    Return & Refund Policy
  </a>

</div>

        <p style="font-size:12px; color:#aaa; margin-top:10px;">
          © ${new Date().getFullYear()} Khushbu Mart. All rights reserved.
        </p>

      </div>
    </div>
    `,
      });
    }

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    // Get user
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
const getProfile = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, phone, email, role, is_active, created_at")
      .eq("id", req.userId)
      .single();

    if (error) throw error;

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

// Update user profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    const { data: user, error } = await supabase
      .from("users")
      .update({ name, email, updated_at: new Date().toISOString() })
      .eq("id", req.userId)
      .select("id, name, phone, email, role")
      .single();

    if (error) throw error;

    res.json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};

// Change user password
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Get user
    const { data: user, error } = await supabase
      .from("users")
      .select("id, password")
      .eq("id", req.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password and update
    const hashed = await bcrypt.hash(newPassword, 10);

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ password: hashed, updated_at: new Date().toISOString() })
      .eq("id", req.userId)
      .select("id")
      .single();

    if (updateError) throw updateError;

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};

// Delete user account
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.userId;

    // Delete user's orders
    await supabase.from("orders").delete().eq("user_id", userId);

    // Delete user's addresses
    await supabase.from("addresses").delete().eq("user_id", userId);

    // Delete user's cart items
    await supabase.from("cart").delete().eq("user_id", userId);

    // Delete the user account
    const { error } = await supabase.from("users").delete().eq("id", userId);

    if (error) throw error;

    res.json({
      message:
        "Account successfully deleted. All associated data has been removed.",
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ error: "Identifier required" });
    }

    // 1️⃣ Find user by phone or email
    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("phone", identifier)
      .single();

    if (!user) {
      const { data: u2 } = await supabase
        .from("users")
        .select("*")
        .eq("email", identifier)
        .single();
      user = u2;
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const today = new Date().toISOString().split("T")[0];

    let requestCount = user.forgot_password_count || 0;
    let lastDate = user.forgot_password_last_date;

    if (lastDate !== today) {
      requestCount = 0;
    }

    if (requestCount >= 2) {
      return res.status(429).json({
        error: "Forgot password limit reached. Try again tomorrow.",
      });
    }

    // 2️⃣ Generate Secure Reset Token
    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    // 3️⃣ Save token in DB (NOT password)
    await supabase
      .from("users")
      .update({
        reset_password_token: hashedToken,
        reset_password_expires: expiry,
        forgot_password_count: requestCount + 1,
        forgot_password_last_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // 4️⃣ Create Reset Link
    const resetLink = `https://khushbumart.in/reset-password-app/${resetToken}`;

    // 5️⃣ Send Email
    if (user.email) {
      const logoUrl = "https://www.khushbumart.in/assets/logo-BOxJi_O8.png";
      await resend.emails.send({
        from: "Khushbu Mart <noreply@khushbumart.in>",
        to: user.email,
        subject: "Password Reset Request — Khushbu Mart",
        html: `
    <div style="font-family: Arial, sans-serif; background:#f4f4f4; padding:20px;">
      <div style="max-width:500px; margin:auto; background:#ffffff; padding:30px; border-radius:8px; text-align:center;">

        <h2 style="color:#333;">Password Reset Request</h2>

        <p style="color:#555;">Hello ${user.name || ""},</p>

        <p style="color:#555;">
          We received a request to reset your password.
        </p>

        <a href="${resetLink}"
           style="display:inline-block;
                  padding:12px 20px;
                  background-color:#28a745;
                  color:#ffffff;
                  text-decoration:none;
                  border-radius:5px;
                  margin:20px 0;">
          Reset Password
        </a>

        <p style="color:#888; font-size:14px;">
          This link will expire in 15 minutes.
        </p>

        <p style="color:#888; font-size:13px;">
          If you did not request this, please ignore this email.
        </p>

        <hr style="margin:25px 0;" />

        <!-- Logo at the End -->
        <div style="margin-top:20px;">
          <img src="${logoUrl}"
               alt="Khushbu Mart"
               width="140"
               style="display:block; margin:0 auto;  border-radius:16%;" />
        </div>

        <p style="font-size:12px; color:#aaa; margin-top:10px;">
          © ${new Date().getFullYear()} Khushbu Mart
        </p>

      </div>
    </div>
  `,
      });
    }

    return res.json({
      message: "Reset link sent successfully",
      remainingAttempts: 2 - (requestCount + 1),
      emailSent: !!user.email,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  forgotPassword,
};
