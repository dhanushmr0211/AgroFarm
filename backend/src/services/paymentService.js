const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../config/database');

class PaymentService {
  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      console.warn('⚠️ Razorpay keys not configured. Payments are disabled in this environment.');
      this.razorpay = null;
    } else {
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      });
    }
  }

  // Create Razorpay order
  async createOrder(amount, currency = 'INR', receipt) {
    try {
      if (!this.razorpay) throw new Error('Payments disabled: missing Razorpay keys');
      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Amount in smallest currency unit (paise)
        currency,
        receipt,
        payment_capture: 1
      });

      return order;
    } catch (error) {
      console.error('Razorpay order creation error:', error);
      throw new Error('Failed to create payment order');
    }
  }

  // Verify Razorpay payment signature
  verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    if (!process.env.RAZORPAY_KEY_SECRET) return false;
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === razorpaySignature;
  }

  // Process bid payment
  async processBidPayment(bidId, paymentData) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

    try {
      // Verify signature
      const isValidSignature = this.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValidSignature) {
        throw new Error('Invalid payment signature');
      }

      // Get bid details
      const bid = await prisma.bid.findUnique({
        where: { id: bidId },
        include: {
          produce: true,
          bidder: {
            include: { wallet: true }
          }
        }
      });

      if (!bid) {
        throw new Error('Bid not found');
      }

      // Check if payment already exists
      const existingTransaction = await prisma.transaction.findUnique({
        where: { bidId }
      });

      if (existingTransaction) {
        throw new Error('Payment already processed for this bid');
      }

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          amount: bid.amount,
          currency: 'INR',
          status: 'COMPLETED',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          payerId: bid.bidderId,
          bidId: bid.id
        }
      });

      // Update bid status to WON
      await prisma.bid.update({
        where: { id: bidId },
        data: { status: 'WON' }
      });

      // Create order
      const order = await prisma.order.create({
        data: {
          buyerId: bid.bidderId,
          produceId: bid.produceId,
          quantity: bid.quantity || bid.produce.quantity,
          totalAmount: bid.amount,
          status: 'CONFIRMED'
        }
      });

      // Update transaction with order ID
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { orderId: order.id }
      });

      return {
        transaction,
        order,
        message: 'Payment successful and order created'
      };

    } catch (error) {
      console.error('Payment processing error:', error);
      
      // Create failed transaction record
      await prisma.transaction.create({
        data: {
          amount: 0,
          currency: 'INR',
          status: 'FAILED',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          payerId: paymentData.userId,
          bidId: bidId
        }
      });

      throw error;
    }
  }

  // Process wallet top-up
  async processWalletTopup(userId, amount, paymentData) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

    try {
      // Verify signature
      const isValidSignature = this.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValidSignature) {
        throw new Error('Invalid payment signature');
      }

      // Update wallet balance
      const wallet = await prisma.wallet.upsert({
        where: { userId },
        update: {
          balance: {
            increment: amount
          }
        },
        create: {
          userId,
          balance: amount
        }
      });

      return wallet;

    } catch (error) {
      console.error('Wallet topup error:', error);
      throw error;
    }
  }

  // Get payment details
  async getPaymentDetails(paymentId) {
    try {
      if (!this.razorpay) throw new Error('Payments disabled: missing Razorpay keys');
      const payment = await this.razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error('Get payment details error:', error);
      throw new Error('Failed to fetch payment details');
    }
  }

  // Refund payment
  async refundPayment(paymentId, amount, reason = 'Requested by customer') {
    try {
      if (!this.razorpay) throw new Error('Payments disabled: missing Razorpay keys');
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: Math.round(amount * 100),
        notes: {
          reason
        }
      });

      return refund;
    } catch (error) {
      console.error('Refund error:', error);
      throw new Error('Failed to process refund');
    }
  }

  // Get user wallet
  async getWallet(userId) {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { userId }
      });

      return {
        balance: wallet?.balance || 0,
        escrowBalance: wallet?.escrowBalance || 0
      };
    } catch (error) {
      console.error('Get wallet error:', error);
      throw new Error('Failed to fetch wallet details');
    }
  }

  // Get transaction history
  async getTransactionHistory({ userId, page = 1, limit = 20, type, status }) {
    try {
      const skip = (page - 1) * limit;
      
      const where = {
        OR: [
          { payerId: userId },
          { receiverId: userId }
        ]
      };

      if (type) where.type = type;
      if (status) where.status = status;

      const transactions = await prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          payer: { select: { name: true } },
          receiver: { select: { name: true } },
          bid: { select: { amount: true } },
          order: { select: { id: true } }
        }
      });

      const total = await prisma.transaction.count({ where });

      return {
        transactions: transactions.map(t => ({
          id: t.id,
          type: t.payerId === userId ? 'debit' : 'credit',
          amount: t.amount,
          description: this.getTransactionDescription(t),
          date: t.createdAt.toISOString().split('T')[0],
          time: t.createdAt.toLocaleTimeString(),
          status: t.status.toLowerCase()
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Get transaction history error:', error);
      throw new Error('Failed to fetch transaction history');
    }
  }

  // Top up wallet
  async topupWallet(userId, amount) {
    try {
      const wallet = await prisma.wallet.upsert({
        where: { userId },
        update: {
          balance: { increment: amount }
        },
        create: {
          userId,
          balance: amount
        }
      });

      return wallet;
    } catch (error) {
      console.error('Top up wallet error:', error);
      throw new Error('Failed to top up wallet');
    }
  }

  // Create transaction
  async createTransaction(data) {
    try {
      const transaction = await prisma.transaction.create({
        data: {
          payerId: data.userId,
          amount: data.amount,
          status: data.status || 'PENDING',
          razorpayOrderId: data.razorpayOrderId,
          razorpayPaymentId: data.razorpayPaymentId,
          type: data.type || 'WALLET_TOPUP',
          bidId: data.bidId
        }
      });

      return transaction;
    } catch (error) {
      console.error('Create transaction error:', error);
      throw new Error('Failed to create transaction');
    }
  }

  // Helper method to generate transaction descriptions
  getTransactionDescription(transaction) {
    switch (transaction.type) {
      case 'WALLET_TOPUP':
        return 'Wallet top-up via Razorpay';
      case 'BID_PAYMENT':
        return `Payment for bid #${transaction.bidId}`;
      case 'REFUND':
        return 'Payment refund';
      case 'COMMISSION':
        return 'Platform commission';
      default:
        return 'Transaction';
    }
  }
}

module.exports = new PaymentService();