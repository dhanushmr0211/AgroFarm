const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const prisma = require('../config/database');

// Create Razorpay order
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const order = await paymentService.createOrder(
      amount, // Amount in rupees
      currency,
      receipt || `order_${Date.now()}`
    );

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order'
    });
  }
});

// Verify payment
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      type = 'WALLET_TOPUP',
      amount
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification parameters missing'
      });
    }

    console.log('Verifying payment with:', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature?.substring(0, 10) + '...' // Log partial signature for security
    });

    const isValid = paymentService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    console.log('Signature validation result:', isValid);

    if (!isValid) {
      console.error('Signature verification failed');
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Create transaction record
    const transaction = await paymentService.createTransaction({
      userId: req.user.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amount: amount / 100, // Convert back from paise
      type,
      status: 'COMPLETED'
    });

    // Handle different payment types
    if (type === 'WALLET_TOPUP') {
      await paymentService.topupWallet(req.user.id, amount / 100);
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: transaction
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    console.error('Request body:', req.body);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
});

// Get user wallet
router.get('/wallet', authenticateToken, async (req, res) => {
  try {
    const wallet = await paymentService.getWallet(req.user.id);
    
    res.json({
      success: true,
      data: wallet
    });

  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet details'
    });
  }
});

// Get transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;

    const transactions = await paymentService.getTransactionHistory({
      userId: req.user.id,
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      status
    });

    res.json({
      success: true,
      data: transactions
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction history'
    });
  }
});

// Process bid payment (after winning auction)
router.post('/process-bid-payment', authenticateToken, async (req, res) => {
  try {
    const { bidId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!bidId) {
      return res.status(400).json({
        success: false,
        message: 'Bid ID is required'
      });
    }

    // Get bid details
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        produce: true,
        bidder: true
      }
    });

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    if (bid.bidderId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to pay for this bid'
      });
    }

    if (bid.status !== 'WON') {
      return res.status(400).json({
        success: false,
        message: 'Can only pay for winning bids'
      });
    }

    // Verify payment if Razorpay details provided
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const isValid = paymentService.verifyPaymentSignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment signature'
        });
      }

      // Create transaction record
      await paymentService.createTransaction({
        userId: req.user.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: bid.amount,
        type: 'BID_PAYMENT',
        status: 'COMPLETED',
        bidId
      });
    }

    // Update bid payment status
    await prisma.bid.update({
      where: { id: bidId },
      data: { paymentStatus: 'PAID' }
    });

    // Create order
    const order = await prisma.order.create({
      data: {
        buyerId: req.user.id,
        farmerId: bid.produce.farmerId,
        produceId: bid.produceId,
        bidId,
        quantity: bid.quantity,
        amount: bid.amount,
        status: 'CONFIRMED',
        deliveryAddress: req.body.deliveryAddress || '',
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      }
    });

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: { order, transaction: bid }
    });

  } catch (error) {
    console.error('Process bid payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process bid payment'
    });
  }
});

module.exports = router;