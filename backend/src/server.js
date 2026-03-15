require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

// Import configuration and services
const config = require('./config/projectResources');
const prisma = require('./config/database');
const SocketService = require('./services/socketService');
const notificationService = require('./services/notificationService');

const app = express();
const server = http.createServer(app);

// CORS configuration - Allow Vercel frontend, local dev, and private network
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Allow any *.vercel.app deployment (preview + production)
    const vercelPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

    // Allow any private network IP (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
    const privateNetworkPattern = /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)[\\d.]+:(3000|3001|5173)$/;

    if (allowedOrigins.includes(origin) || vercelPattern.test(origin) || privateNetworkPattern.test(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS rejected origin: ${origin}`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Socket.IO setup with network access
const io = socketIO(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Initialize Socket Service
const socketService = new SocketService(io);
app.set('socketService', socketService);

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting using config
const limiter = rateLimit(config.app.rateLimit);
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Import routes
const authRoutes = require('./routes/auth');
const auctionRoutes = require('./routes/auctions');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const walletRoutes = require('./routes/wallet');
const uploadRoutes = require('./routes/upload');
const reviewRoutes = require('./routes/reviews');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reviews', reviewRoutes);

// APMC endpoints
app.get('/api/auth/apmcs', async (req, res) => {
  try {
    // Fetch APMCs from database
    const apmcs = await prisma.aPMC.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        location: true,
        state: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: apmcs
    });
  } catch (error) {
    console.error('Fetch APMCs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch APMCs'
    });
  }
});

// Auction automation cron jobs
// Check for auctions that should start
cron.schedule('* * * * *', async () => { // Every minute
  try {
    const auctionsToStart = await prisma.produce.findMany({
      where: {
        status: 'UPCOMING',
        auctionStartTime: {
          lte: new Date()
        }
      }
    });

    for (const auction of auctionsToStart) {
      await prisma.produce.update({
        where: { id: auction.id },
        data: { status: 'LIVE' }
      });

      await socketService.broadcastAuctionStart(auction.id);
      console.log(`🚀 Auction started: ${auction.title}`);
    }
  } catch (error) {
    console.error('Auction start cron error:', error);
  }
});

// Check for auctions that should end
cron.schedule('* * * * *', async () => { // Every minute
  try {
    const auctionsToEnd = await prisma.produce.findMany({
      where: {
        status: 'LIVE',
        auctionEndTime: {
          lte: new Date()
        }
      },
      include: {
        winningBid: true
      }
    });

    for (const auction of auctionsToEnd) {
      await prisma.produce.update({
        where: { id: auction.id },
        data: { status: 'COMPLETED' }
      });

      // Finalize bids: Mark winner as WON, others as LOST
      if (auction.winningBidId) {
        // 1. Mark winning bid as WON
        await prisma.bid.update({
          where: { id: auction.winningBidId },
          data: { status: 'WON' }
        });

        // 2. Mark other ACTIVE bids as LOST
        await prisma.bid.updateMany({
          where: {
            produceId: auction.id,
            id: { not: auction.winningBidId },
            status: 'ACTIVE'
          },
          data: { status: 'LOST' }
        });

        console.log(`🏆 Winning bid stored for ${auction.title}: ₹${auction.winningBid.amount} by ${auction.winningBid.bidderId}`);
      }

      await socketService.broadcastAuctionEnd(auction.id);
      console.log(`🏁 Auction ended: ${auction.title}`);
    }
  } catch (error) {
    console.error('Auction end cron error:', error);
  }
});

// Send auction ending warnings (10 minutes before end)
cron.schedule('* * * * *', async () => { // Every minute
  try {
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
    const endingSoonAuctions = await prisma.produce.findMany({
      where: {
        status: 'LIVE',
        auctionEndTime: {
          gte: new Date(),
          lte: tenMinutesFromNow
        }
      }
    });

    for (const auction of endingSoonAuctions) {
      await notificationService.sendAuctionEndingNotification(auction.id);
    }
  } catch (error) {
    console.error('Auction ending warning cron error:', error);
  }
});

// Session automation
// Start sessions
cron.schedule('* * * * *', async () => {
  try {
    const sessionsToStart = await prisma.auctionSession.findMany({
      where: { status: 'SCHEDULED', startTime: { lte: new Date() } }
    });
    for (const s of sessionsToStart) {
      await prisma.auctionSession.update({ where: { id: s.id }, data: { status: 'LIVE' } });
      await socketService.broadcastSessionStart(s.id);
      console.log(`🚀 Session started: ${s.id}`);
    }
  } catch (error) {
    console.error('Session start cron error:', error);
  }
});

// End sessions
cron.schedule('* * * * *', async () => {
  try {
    const sessionsToEnd = await prisma.auctionSession.findMany({
      where: { status: 'LIVE', endTime: { lte: new Date() } }
    });
    for (const s of sessionsToEnd) {
      await prisma.auctionSession.update({ where: { id: s.id }, data: { status: 'COMPLETED' } });
      await socketService.broadcastSessionEnd(s.id);
      console.log(`🏁 Session ended: ${s.id}`);
    }
  } catch (error) {
    console.error('Session end cron error:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('👋 Process terminated');
  });
});

// Start server - SINGLE INSTANCE ONLY
const PORT = process.env.PORT || 5001;
const os = require('os');

// Get network IP for mobile access
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const networkIP = getNetworkIP();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`✅ LOADED: Fixed Auction Routes (v2)`); // CONFIRMATION LOG
  console.log(`📱 Mobile access: http://${networkIP}:${PORT}`);
  console.log(`🌐 Local access: http://localhost:${PORT}`);
});

module.exports = { app, server, io, socketService };