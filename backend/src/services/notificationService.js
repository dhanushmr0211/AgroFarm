const admin = require('firebase-admin');
const prisma = require('../config/database');

class NotificationService {
  constructor() {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      try {
        // Use service account key file for Firebase initialization
        const serviceAccount = require('../config/firebase/firebase-key.json');

        if (process.env.NODE_ENV !== 'development') {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
            databaseURL: process.env.FIREBASE_DATABASE_URL
          });
          console.log('✅ Firebase Admin initialized successfully');
          console.log(`📁 Project ID: ${serviceAccount.project_id}`);
        } else {
          console.log('⚠️ Firebase disabled for development mode');
          console.log('📝 Push notifications will use mock data');
        }
      } catch (error) {
        console.log('⚠️ Firebase Admin initialization failed:', error.message);
        console.log('📝 Push notifications will be disabled');
      }
    }

    // Store FCM configuration
    this.fcmServerKey = process.env.FCM_SERVER_KEY;
    this.fcmSenderId = process.env.FCM_SENDER_ID;

    if (this.fcmServerKey && this.fcmSenderId) {
      console.log('✅ FCM credentials configured');
      console.log(`📱 FCM Sender ID: ${this.fcmSenderId}`);
    } else {
      console.log('⚠️ FCM credentials not configured. Push notifications may be limited.');
    }
  }

  // Save device token
  async saveDeviceToken(userId, token, platform = 'web') {
    try {
      await prisma.deviceToken.upsert({
        where: { token },
        update: {
          userId,
          platform,
          updatedAt: new Date()
        },
        create: {
          userId,
          token,
          platform
        }
      });

      console.log(`📱 Device token saved for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Save device token error:', error);
      throw new Error('Failed to save device token');
    }
  }

  // Remove device token
  async removeDeviceToken(token) {
    try {
      await prisma.deviceToken.delete({
        where: { token }
      });
      return true;
    } catch (error) {
      console.error('Remove device token error:', error);
      return false;
    }
  }

  // Send push notification to specific user
  async sendToUser(userId, notification, data = {}) {
    try {
      // Get user's device tokens
      const deviceTokens = await prisma.deviceToken.findMany({
        where: { userId }
      });

      if (deviceTokens.length === 0) {
        console.log(`📱 No device tokens found for user ${userId}`);
        return { success: false, message: 'No device tokens found' };
      }

      const tokens = deviceTokens.map(dt => dt.token);

      // Save notification to database
      await prisma.notification.create({
        data: {
          userId,
          title: notification.title,
          body: notification.body,
          type: data.type || 'GENERAL',
          data: JSON.stringify(data)
        }
      });

      // Send push notification if Firebase is initialized
      if (admin.apps.length > 0) {
        const message = {
          notification,
          data: {
            ...data,
            userId: userId.toString()
          },
          tokens
        };

        const response = await admin.messaging().sendMulticast(message);

        // Remove invalid tokens
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });

        if (failedTokens.length > 0) {
          await prisma.deviceToken.deleteMany({
            where: {
              token: { in: failedTokens }
            }
          });
        }

        console.log(`📨 Push notification sent to user ${userId}: ${response.successCount}/${tokens.length} successful`);

        return {
          success: true,
          successCount: response.successCount,
          failureCount: response.failureCount
        };
      } else {
        console.log(`📝 Notification saved to database for user ${userId} (Firebase not configured)`);
        return { success: true, message: 'Notification saved (push disabled)' };
      }

    } catch (error) {
      console.error('Send notification error:', error);
      throw error;
    }
  }

  // Send notification to multiple users
  async sendToMultipleUsers(userIds, notification, data = {}) {
    try {
      const results = await Promise.allSettled(
        userIds.map(userId => this.sendToUser(userId, notification, data))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { successful, failed };
    } catch (error) {
      console.error('Send bulk notifications error:', error);
      throw error;
    }
  }

  // Send bid update notification
  async sendBidUpdateNotification(bidId, newBid) {
    try {
      const bid = await prisma.bid.findUnique({
        where: { id: bidId },
        include: {
          produce: true,
          bidder: true
        }
      });

      if (!bid) return;

      // Notify the previous highest bidder
      const previousBids = await prisma.bid.findMany({
        where: {
          produceId: bid.produceId,
          id: { not: bidId },
          status: 'ACTIVE'
        },
        include: { bidder: true },
        orderBy: { amount: 'desc' },
        take: 1
      });

      if (previousBids.length > 0) {
        const previousBidder = previousBids[0].bidder;
        await this.sendToUser(
          previousBidder.id,
          {
            title: 'You\'ve been outbid!',
            body: `Someone placed a higher bid of ₹${newBid.amount} on ${bid.produce.title}`
          },
          {
            type: 'bid_outbid',
            produceId: bid.produceId,
            bidId: newBid.id
          }
        );
      }

      // Update previous bid status
      await prisma.bid.updateMany({
        where: {
          produceId: bid.produceId,
          id: { not: bidId },
          status: 'ACTIVE'
        },
        data: { status: 'OUTBID' }
      });

    } catch (error) {
      console.error('Send bid update notification error:', error);
    }
  }

  // Send auction ending notification
  async sendAuctionEndingNotification(produceId) {
    try {
      const produce = await prisma.produce.findUnique({
        where: { id: produceId },
        include: {
          bids: {
            include: { bidder: true },
            where: { status: 'ACTIVE' }
          }
        }
      });

      if (!produce || produce.bids.length === 0) return;

      const bidderIds = [...new Set(produce.bids.map(bid => bid.bidderId))];

      await this.sendToMultipleUsers(
        bidderIds,
        {
          title: 'Auction ending soon!',
          body: `The auction for ${produce.title} ends in 10 minutes. Place your final bid now!`
        },
        {
          type: 'auction_ending',
          produceId: produce.id
        }
      );

    } catch (error) {
      console.error('Send auction ending notification error:', error);
    }
  }

  // Send auction won notification
  async sendAuctionWonNotification(bidId) {
    try {
      const bid = await prisma.bid.findUnique({
        where: { id: bidId },
        include: {
          produce: true,
          bidder: true
        }
      });

      if (!bid) return;

      await this.sendToUser(
        bid.bidderId,
        {
          title: 'Congratulations! You won the auction!',
          body: `You won ${bid.produce.title} for ₹${bid.amount}. Complete the payment to confirm your order.`
        },
        {
          type: 'auction_won',
          produceId: bid.produceId,
          bidId: bid.id
        }
      );

    } catch (error) {
      console.error('Send auction won notification error:', error);
    }
  }

  // Send payment confirmation notification
  async sendPaymentConfirmationNotification(transactionId) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          payer: true,
          bid: {
            include: { produce: true }
          }
        }
      });

      if (!transaction) return;

      await this.sendToUser(
        transaction.payerId,
        {
          title: 'Payment Successful!',
          body: `Your payment of ₹${transaction.amount} for ${transaction.bid.produce.title} has been confirmed.`
        },
        {
          type: 'payment_success',
          transactionId: transaction.id,
          orderId: transaction.orderId
        }
      );

    } catch (error) {
      console.error('Send payment confirmation notification error:', error);
    }
  }

  // Get user notifications
  async getUserNotifications(options) {
    try {
      const { userId, page = 1, limit = 20, unreadOnly = false } = options;

      const whereClause = { userId };
      if (unreadOnly) {
        whereClause.isRead = false;
      }

      const notifications = await prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      });

      const total = await prisma.notification.count({
        where: whereClause
      });

      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false }
      });

      return {
        items: notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        unreadCount
      };

    } catch (error) {
      console.error('Get user notifications error:', error);
      throw error;
    }
  }

  // Mark notifications as read
  async markAsRead(userId, notificationIds) {
    try {
      await prisma.notification.updateMany({
        where: {
          userId,
          id: { in: notificationIds }
        },
        data: { isRead: true }
      });

      return true;
    } catch (error) {
      console.error('Mark notifications as read error:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    try {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
      });

      return true;
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      throw error;
    }
  }

  // Helper method to save notification to database
  async saveNotificationToDatabase(userId, notification, data = {}) {
    try {
      return await prisma.notification.create({
        data: {
          userId: userId,
          title: notification.title,
          body: notification.body,
          type: data.type || 'general',
          data: JSON.stringify(data),
          isRead: false
        }
      });
    } catch (error) {
      console.error('Database save error:', error);
      throw error;
    }
  }

  // Helper method to save notification to Firestore
  async saveNotificationToFirestore(userId, notification, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📁 [DEV MODE] Mock Firestore save for user ${userId}:`, notification.title);
      return;
    }

    try {
      const db = admin.firestore();
      const notificationRef = db.collection(this.collections.notifications).doc();

      await notificationRef.set({
        userId: userId,
        title: notification.title,
        body: notification.body,
        type: data.type || 'general',
        data: data,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        projectId: process.env.FIREBASE_PROJECT_ID
      });

      console.log(`📁 Notification saved to Firestore: ${notificationRef.id}`);
    } catch (error) {
      console.error('Firestore save error:', error);
      // Don't throw - this is optional
    }
  }

  // Remove invalid FCM tokens
  async removeInvalidTokens(tokens) {
    try {
      await prisma.deviceToken.updateMany({
        where: { token: { in: tokens } },
        data: { isActive: false }
      });

      console.log(`🗑️ Removed ${tokens.length} invalid FCM tokens`);
    } catch (error) {
      console.error('Remove invalid tokens error:', error);
    }
  }

  // Register device token (alias for compatibility)
  async registerDeviceToken(userId, token, platform = 'web') {
    return this.saveDeviceToken(userId, token, platform);
  }

  // Send notification (alias for compatibility) 
  async sendNotification(options) {
    const { userId, title, body, type, data } = options;
    return this.sendToUser(userId, { title, body }, { type, ...data });
  }
}

module.exports = new NotificationService();