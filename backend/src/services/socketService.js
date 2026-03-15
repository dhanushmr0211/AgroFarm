const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const notificationService = require('../services/notificationService');

class SocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socket.id
    this.auctionRooms = new Map(); // produceId -> Set of user IDs
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, name: true, role: true, isActive: true }
        });

        if (!user || !user.isActive) {
          return next(new Error('Authentication error: Invalid user'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 User ${socket.user.name} (${socket.userId}) connected`);

      // Store user connection
      this.connectedUsers.set(socket.userId, socket.id);

      // Join user to their personal room for notifications
      socket.join(`user_${socket.userId}`);

      this.setupBiddingHandlers(socket);
      this.setupAuctionHandlers(socket);
      this.setupNotificationHandlers(socket);

      socket.on('disconnect', () => {
        console.log(`🔌 User ${socket.user.name} (${socket.userId}) disconnected`);
        this.connectedUsers.delete(socket.userId);

        // Remove from auction rooms
        this.auctionRooms.forEach((users, produceId) => {
          if (users.has(socket.userId)) {
            users.delete(socket.userId);

            // Notify others
            socket.to(`auction_${produceId}`).emit('user_left_auction', {
              userId: socket.userId,
              userName: socket.user.name,
              participantCount: users.size
            });

            // Check if room is empty and auction is active
            if (users.size === 0) {
              this.checkAndEndAuction(produceId);
            }
          }
        });
      });
    });
  }

  setupBiddingHandlers(socket) {
    // Join session room
    socket.on('join_session', async (data) => {
      try {
        const { sessionId } = data;

        // Validate session exists and is live
        const session = await prisma.auctionSession.findUnique({
          where: { id: sessionId },
          include: {
            apmc: { select: { name: true, location: true } },
            registrations: {
              where: { status: 'BOOKED' },
              include: { user: { select: { id: true, name: true, role: true } } }
            }
          }
        });

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        if (session.status !== 'LIVE') {
          socket.emit('error', { message: 'Session is not currently live' });
          return;
        }

        // Join session room
        socket.join(`session_${sessionId}`);

        // Add user to session room tracking
        if (!this.auctionRooms.has(sessionId)) {
          this.auctionRooms.set(sessionId, new Set());
        }
        this.auctionRooms.get(sessionId).add(socket.userId);

        // Send current session state
        const sessionState = {
          session,
          participants: session.registrations,
          participantCount: this.auctionRooms.get(sessionId).size
        };

        socket.emit('session_joined', sessionState);

        // Notify other participants
        socket.to(`session_${sessionId}`).emit('user_joined_session', {
          userId: socket.userId,
          userName: socket.user.name,
          participantCount: this.auctionRooms.get(sessionId).size
        });

        console.log(`📺 User ${socket.user.name} joined session ${sessionId}`);

      } catch (error) {
        console.error('Join session error:', error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // Leave session room
    socket.on('leave_session', (data) => {
      const { sessionId } = data;

      socket.leave(`session_${sessionId}`);

      if (this.auctionRooms.has(sessionId)) {
        this.auctionRooms.get(sessionId).delete(socket.userId);

        socket.to(`session_${sessionId}`).emit('user_left_session', {
          userId: socket.userId,
          userName: socket.user.name,
          participantCount: this.auctionRooms.get(sessionId).size
        });
      }
    });

    // Send chat message
    socket.on('send_message', async (data) => {
      try {
        const { sessionId, message, type = 'MESSAGE' } = data;

        // Validate session
        const session = await prisma.auctionSession.findUnique({
          where: { id: sessionId }
        });

        if (!session || session.status !== 'LIVE') {
          socket.emit('error', { message: 'Session not found or not live' });
          return;
        }

        // Save message
        const chatMessage = await prisma.chatMessage.create({
          data: {
            sessionId,
            userId: socket.userId,
            message,
            type
          },
          include: { user: { select: { id: true, name: true, role: true } } }
        });

        // Broadcast to session
        this.io.to(`session_${sessionId}`).emit('new_message', chatMessage);

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Join auction room
    socket.on('join_auction', async (data) => {
      try {
        const { produceId } = data;

        // Validate produce exists and auction is live
        const produce = await prisma.produce.findUnique({
          where: { id: produceId },
          include: {
            farmer: { select: { id: true, name: true } },
            bids: {
              where: { status: 'ACTIVE' },
              include: { bidder: { select: { id: true, name: true } } },
              orderBy: { amount: 'desc' },
              take: 10
            }
          }
        });

        if (!produce) {
          socket.emit('error', { message: 'Auction not found' });
          return;
        }

        if (produce.status !== 'LIVE') {
          socket.emit('error', { message: 'Auction is not currently live' });
          return;
        }

        // Join auction room
        socket.join(`auction_${produceId}`);

        // Add user to auction room tracking
        if (!this.auctionRooms.has(produceId)) {
          this.auctionRooms.set(produceId, new Set());
        }
        this.auctionRooms.get(produceId).add(socket.userId);

        // Send current auction state
        const auctionState = {
          produce,
          currentBid: produce.bids[0] || null,
          participantCount: this.auctionRooms.get(produceId).size,
          recentBids: produce.bids.slice(0, 5)
        };

        socket.emit('auction_joined', auctionState);

        // Notify other participants
        socket.to(`auction_${produceId}`).emit('user_joined_auction', {
          userId: socket.userId,
          userName: socket.user.name,
          participantCount: this.auctionRooms.get(produceId).size
        });

        console.log(`📺 User ${socket.user.name} joined auction for ${produce.title}`);

      } catch (error) {
        console.error('Join auction error:', error);
        socket.emit('error', { message: 'Failed to join auction' });
      }
    });

    // Leave auction room
    socket.on('leave_auction', (data) => {
      const { produceId } = data;

      socket.leave(`auction_${produceId}`);

      if (this.auctionRooms.has(produceId)) {
        this.auctionRooms.get(produceId).delete(socket.userId);

        socket.to(`auction_${produceId}`).emit('user_left_auction', {
          userId: socket.userId,
          userName: socket.user.name,
          participantCount: this.auctionRooms.get(produceId).size
        });
      }
    });

    // Place bid
    socket.on('place_bid', async (data) => {
      try {
        const { produceId, amount, quantity } = data;

        // Validate bid
        const produce = await prisma.produce.findUnique({
          where: { id: produceId },
          include: {
            bids: {
              where: { status: 'ACTIVE' },
              orderBy: { amount: 'desc' },
              take: 1
            }
          }
        });

        if (!produce) {
          socket.emit('bid_error', { message: 'Auction not found' });
          return;
        }

        if (produce.status !== 'LIVE') {
          socket.emit('bid_error', { message: 'Auction is not currently live' });
          return;
        }

        if (new Date() > produce.auctionEndTime) {
          socket.emit('bid_error', { message: 'Auction has ended' });
          return;
        }

        // Check if user is the farmer (farmers can't bid on their own produce)
        if (produce.farmerId === socket.userId) {
          socket.emit('bid_error', { message: 'Farmers cannot bid on their own produce' });
          return;
        }

        // Validate bid amount
        const currentHighestBid = produce.bids[0]?.amount || produce.basePrice;
        const minimumBid = currentHighestBid + (produce.basePrice * 0.01); // 1% increment

        if (amount <= currentHighestBid) {
          socket.emit('bid_error', {
            message: `Bid must be higher than current bid of ₹${currentHighestBid}`
          });
          return;
        }

        if (amount < minimumBid) {
          socket.emit('bid_error', {
            message: `Minimum bid increment is ₹${Math.ceil(minimumBid - currentHighestBid)}`
          });
          return;
        }

        // Check user's wallet balance
        const wallet = await prisma.wallet.findUnique({
          where: { userId: socket.userId }
        });

        if (!wallet || wallet.balance < amount) {
          socket.emit('bid_error', {
            message: 'Insufficient wallet balance. Please add funds to continue bidding.'
          });
          return;
        }

        // Create new bid
        const newBid = await prisma.bid.create({
          data: {
            amount,
            quantity: quantity || produce.quantity,
            bidderId: socket.userId,
            produceId,
            status: 'ACTIVE'
          },
          include: {
            bidder: { select: { id: true, name: true } }
          }
        });

        // Update produce current bid
        await prisma.produce.update({
          where: { id: produceId },
          data: {
            currentBid: amount,
            winningBidId: newBid.id
          }
        });

        // Create bid history entry
        await prisma.bidHistory.create({
          data: {
            bidId: newBid.id,
            amount,
            timestamp: new Date()
          }
        });

        // Create escrow transaction
        await prisma.escrowTransaction.create({
          data: {
            bidId: newBid.id,
            amount,
            farmerId: produce.farmerId,
            buyerId: socket.userId,
            sessionId: produce.sessionId
          }
        });

        // Broadcast new bid to all auction participants
        this.io.to(`auction_${produceId}`).emit('new_bid', {
          bid: newBid,
          currentBid: amount,
          bidderId: socket.userId,
          bidderName: socket.user.name,
          timestamp: new Date()
        });

        // Send bid confirmation to bidder
        socket.emit('bid_placed', {
          bid: newBid,
          message: 'Bid placed successfully!'
        });

        // Send notification to outbid users
        await notificationService.sendBidUpdateNotification(newBid.id, newBid);

        console.log(`💰 New bid of ₹${amount} placed by ${socket.user.name} on ${produce.title}`);

      } catch (error) {
        console.error('Place bid error:', error);
        socket.emit('bid_error', { message: 'Failed to place bid. Please try again.' });
      }
    });
  }

  setupAuctionHandlers(socket) {
    // Get auction updates
    socket.on('get_auction_updates', async (data) => {
      try {
        const { produceId } = data;

        const produce = await prisma.produce.findUnique({
          where: { id: produceId },
          include: {
            bids: {
              where: { status: 'ACTIVE' },
              include: { bidder: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          }
        });

        if (produce) {
          socket.emit('auction_updates', {
            currentBid: produce.currentBid,
            recentBids: produce.bids,
            participantCount: this.auctionRooms.get(produceId)?.size || 0
          });
        }

      } catch (error) {
        console.error('Get auction updates error:', error);
      }
    });
  }

  setupNotificationHandlers(socket) {
    // Get unread notification count
    socket.on('get_notification_count', async () => {
      try {
        const unreadCount = await prisma.notification.count({
          where: { userId: socket.userId, isRead: false }
        });

        socket.emit('notification_count', { unreadCount });
      } catch (error) {
        console.error('Get notification count error:', error);
      }
    });

    // Mark notifications as read
    socket.on('mark_notifications_read', async (data) => {
      try {
        const { notificationIds } = data;

        await prisma.notification.updateMany({
          where: {
            userId: socket.userId,
            id: { in: notificationIds }
          },
          data: { isRead: true }
        });

        socket.emit('notifications_marked_read', { notificationIds });
      } catch (error) {
        console.error('Mark notifications read error:', error);
      }
    });
  }

  // Broadcast auction start
  async broadcastAuctionStart(produceId) {
    try {
      const produce = await prisma.produce.findUnique({
        where: { id: produceId },
        include: {
          farmer: { select: { name: true } }
        }
      });

      if (produce) {
        this.io.emit('auction_started', {
          produce,
          message: `Auction started for ${produce.title} by ${produce.farmer.name}`
        });

        console.log(`📺 Auction started for ${produce.title}`);
      }
    } catch (error) {
      console.error('Broadcast auction start error:', error);
    }
  }

  // Broadcast auction end
  async broadcastAuctionEnd(produceId) {
    try {
      const produce = await prisma.produce.findUnique({
        where: { id: produceId },
        include: {
          winningBid: {
            include: {
              bidder: { select: { id: true, name: true } }
            }
          }
        }
      });

      if (produce) {
        // Broadcast to auction room
        this.io.to(`auction_${produceId}`).emit('auction_ended', {
          produce,
          winningBid: produce.winningBid,
          message: produce.winningBid
            ? `Auction ended! Winner: ${produce.winningBid.bidder.name} with ₹${produce.winningBid.amount}`
            : 'Auction ended with no bids'
        });

        // Send notification to winner
        if (produce.winningBid) {
          await notificationService.sendAuctionWonNotification(produce.winningBid.id);
        }

        console.log(`🏁 Auction ended for ${produce.title}`);
      }
    } catch (error) {
      console.error('Broadcast auction end error:', error);
    }
  }

  async broadcastSessionStart(sessionId) {
    try {
      const session = await prisma.auctionSession.findUnique({
        where: { id: sessionId },
        include: {
          apmc: { select: { name: true, location: true } },
          registrations: { select: { userId: true } }
        }
      });
      if (session) {
        const userIds = session.registrations.map(r => r.userId);
        userIds.forEach(uid => this.sendNotificationToUser(uid, {
          title: 'Session Started',
          body: `Bidding session for ${session.category} at ${session.apmc.name} has started`,
          type: 'AUCTION_START',
          data: JSON.stringify({ sessionId })
        }));
      }
    } catch (error) {
      console.error('Broadcast session start error:', error);
    }
  }

  async broadcastSessionEnd(sessionId) {
    try {
      const session = await prisma.auctionSession.findUnique({
        where: { id: sessionId },
        include: { registrations: { select: { userId: true } }, apmc: true }
      });
      if (session) {
        const userIds = session.registrations.map(r => r.userId);
        userIds.forEach(uid => this.sendNotificationToUser(uid, {
          title: 'Session Ended',
          body: `Bidding session at ${session.apmc.name} has ended`,
          type: 'AUCTION_END',
          data: JSON.stringify({ sessionId })
        }));
      }
    } catch (error) {
      console.error('Broadcast session end error:', error);
    }
  }

  // Send notification to specific user
  async sendNotificationToUser(userId, notification) {
    const userSocketId = this.connectedUsers.get(userId);
    if (userSocketId) {
      this.io.to(`user_${userId}`).emit('notification', notification);
    }
  }

  // Broadcast to all users
  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get auction participants
  getAuctionParticipants(produceId) {
    return this.auctionRooms.get(produceId)?.size || 0;
  }
  // Check and end auction if empty
  async checkAndEndAuction(produceId) {
    try {
      // Small delay to allow reconnection or race conditions
      setTimeout(async () => {
        const users = this.auctionRooms.get(produceId);
        if (users && users.size > 0) return; // Someone joined back

        await this.endAuction(produceId);
      }, 5000); // 5 second grace period
    } catch (error) {
      console.error('Check and end auction error:', error);
    }
  }

  // Force end auction (Manual or Auto)
  async endAuction(produceId) {
    try {
      const produce = await prisma.produce.findUnique({
        where: { id: produceId },
        include: { winningBid: true }
      });

      if (produce && produce.status === 'LIVE') {
        console.log(`🛑 Ending auction ${produce.title}...`);

        await prisma.produce.update({
          where: { id: produceId },
          data: { status: 'COMPLETED' }
        });

        // Finalize bids
        if (produce.winningBidId) {
          await prisma.bid.update({
            where: { id: produce.winningBidId },
            data: { status: 'WON' }
          });
          await prisma.bid.updateMany({
            where: {
              produceId: produce.id,
              id: { not: produce.winningBidId },
              status: 'ACTIVE'
            },
            data: { status: 'LOST' }
          });
          console.log(`🏆 Winning bid stored for ${produce.title}`);
        }

        await this.broadcastAuctionEnd(produceId);
      }
    } catch (error) {
      console.error('End auction error:', error);
    }
  }
  // API-based presence tracking
  enterAuction(produceId, userId) {
    if (!this.auctionRooms.has(produceId)) {
      this.auctionRooms.set(produceId, new Set());
    }
    this.auctionRooms.get(produceId).add(userId);
    console.log(`👤 API User ${userId} active in auction ${produceId}`);
  }

  leaveAuction(produceId, userId) {
    if (this.auctionRooms.has(produceId)) {
      const users = this.auctionRooms.get(produceId);
      users.delete(userId);
      console.log(`👤 API User ${userId} left auction ${produceId}. Remaining: ${users.size}`);

      if (users.size === 0) {
        this.checkAndEndAuction(produceId);
      }
    }
  }
}

module.exports = SocketService;