// Project Resource Configuration
// This file centralizes all project resource references for easy management

const config = {
  // Firebase Project Configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'farmer-491ad',
    databaseUrl: process.env.FIREBASE_DATABASE_URL || 'https://farmer-491ad-default-rtdb.firebaseio.com',
    
    // Firestore Collections
    collections: {
      users: process.env.FIRESTORE_USERS_COLLECTION || 'users',
      notifications: process.env.FIRESTORE_NOTIFICATIONS_COLLECTION || 'notifications', 
      auctions: process.env.FIRESTORE_AUCTIONS_COLLECTION || 'auctions',
      bids: process.env.FIRESTORE_BIDS_COLLECTION || 'bids',
      sessions: process.env.FIRESTORE_SESSIONS_COLLECTION || 'auction_sessions',
      apmcs: process.env.FIRESTORE_APMC_COLLECTION || 'apmcs',
      produce: process.env.FIRESTORE_PRODUCE_COLLECTION || 'produce',
      transactions: process.env.FIRESTORE_TRANSACTIONS_COLLECTION || 'transactions',
      wallets: process.env.FIRESTORE_WALLETS_COLLECTION || 'wallets',
      deviceTokens: process.env.FIRESTORE_DEVICE_TOKENS_COLLECTION || 'device_tokens'
    },
    
    // FCM Configuration
    fcm: {
      serverKey: process.env.FCM_SERVER_KEY,
      senderId: process.env.FCM_SENDER_ID,
      
      // FCM Topic Names
      topics: {
        allUsers: 'all-users',
        farmers: 'farmers',
        buyers: 'buyers',
        auctionUpdates: 'auction-updates',
        priceAlerts: 'price-alerts',
        systemNotifications: 'system-notifications'
      }
    }
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
    
    // Table/Model Names (for consistency)
    tables: {
      users: 'User',
      produce: 'Produce',
      bids: 'Bid',
      auctions: 'Auction',
      transactions: 'Transaction',
      notifications: 'Notification',
      deviceTokens: 'DeviceToken',
      apmcs: 'APMC',
      sessions: 'AuctionSession',
      wallets: 'Wallet',
      orders: 'Order',
      reviews: 'Review'
    }
  },

  // External API Configuration
  apis: {
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_1234567890',
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
    },
    
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'farmer-bidding',
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET
    }
  },

  // Application Configuration
  app: {
    port: process.env.PORT || 5001,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // JWT Configuration
    jwt: {
      secret: process.env.JWT_SECRET || 'farmer-bidding-super-secret-key-2024',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    
    // Rate Limiting
    rateLimit: {
      // Allow higher throughput during active sessions
      windowMs: 1 * 60 * 1000, // 1 minute window
      max: 1000, // allow up to 1000 requests per IP per minute
      standardHeaders: true, // return rate limit info in RateLimit-* headers
      legacyHeaders: false // disable X-RateLimit-* headers
    }
  },

  // Notification Templates
  notifications: {
    templates: {
      bidUpdate: {
        title: 'New Bid on Your Auction',
        body: 'Someone placed a bid of ₹{amount} on {produce}'
      },
      auctionWon: {
        title: 'Congratulations! You Won!',
        body: 'You won the auction for {produce} at ₹{amount}'
      },
      auctionEnding: {
        title: 'Auction Ending Soon',
        body: '{produce} auction ends in 10 minutes'
      },
      paymentReceived: {
        title: 'Payment Received',
        body: '₹{amount} received for {produce}'
      },
      sessionStart: {
        title: 'APMC Session Started',
        body: '{apmc} {produce} bidding session is now live'
      }
    }
  },

  // Socket.IO Events
  socketEvents: {
    // Auction Events
    AUCTION_START: 'auction:start',
    AUCTION_END: 'auction:end',
    BID_PLACED: 'bid:placed',
    BID_UPDATE: 'bid:update',
    
    // Session Events  
    SESSION_START: 'session:start',
    SESSION_END: 'session:end',
    SESSION_UPDATE: 'session:update',
    
    // User Events
    USER_JOIN: 'user:join',
    USER_LEAVE: 'user:leave',
    
    // Notification Events
    NOTIFICATION_SENT: 'notification:sent',
    NOTIFICATION_READ: 'notification:read'
  }
};

// Validation function to check if all required configurations are present
const validateConfig = () => {
  const required = [
    'FIREBASE_PROJECT_ID',
    'JWT_SECRET',
    'DATABASE_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn('⚠️ Missing environment variables:', missing.join(', '));
    console.warn('📝 Application will use default values for missing configurations');
  }
  
  console.log('✅ Configuration loaded successfully');
  console.log(`🏛️ Firebase Project: ${config.firebase.projectId}`);
  console.log(`🗄️ Database: ${config.database.url.includes('file:') ? 'SQLite (Development)' : 'PostgreSQL (Production)'}`);
  console.log(`🌐 Environment: ${config.app.nodeEnv}`);
  console.log(`🔌 Server Port: ${config.app.port}`);
};

// Auto-validate on load
validateConfig();

module.exports = config;