const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const prisma = require('../config/database');

const parseImages = (item) => {
  if (!item) return item;

  // Handle single item
  if (item.produce) { // For nested produce objects (e.g. in bids)
    parseImages(item.produce);
  }

  if (typeof item.images === 'string') {
    try {
      item.images = JSON.parse(item.images);
    } catch (e) {
      item.images = [];
    }
  } else if (!item.images) {
    item.images = [];
  }
  return item;
};

// Get APMCs (for dropdown) - MOVED TO TOP
router.get('/apmcs', authenticateToken, async (req, res) => {
  try {
    const apmcs = await prisma.aPMC.findMany({
      where: { isActive: true },
      select: { id: true, name: true, location: true }
    });
    res.json(apmcs);
  } catch (error) {
    console.error('Get APMCs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch APMCs' });
  }
});

// Get current user's (Farmer/Buyer) booking requests - MOVED TO TOP TO AVOID 404
router.get('/my-booking-requests', authenticateToken, authorizeRoles('FARMER', 'BUYER'), async (req, res) => {
  try {
    const requests = await prisma.bookingRequest.findMany({
      where: { userId: req.user.id },
      include: {
        session: { // Include session details to match frontend expectations if needed, or stick to apmc
          include: { apmc: { select: { name: true, location: true } } }
        },
        reviewer: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Get booking requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking requests' });
  }
});

// Get all sessions (Admin, Farmer, Buyer) - MOVED TO TOP
router.get('/sessions', authenticateToken, authorizeRoles('ADMIN', 'FARMER', 'BUYER'), async (req, res) => {
  try {
    const sessions = await prisma.auctionSession.findMany({
      include: {
        apmc: { select: { name: true, location: true } },
        registrations: { select: { id: true } },
        _count: { select: { registrations: true } }
      },
      orderBy: { startTime: 'desc' }
    });

    const sessionsWithCounts = sessions.map(session => ({
      ...session,
      participants: session.registrations,
      // Computed fields for frontend display
      title: `${session.apmc.name} Auction Session`,
      description: `Auction session at ${session.apmc.name}`,
      dateTime: session.startTime,
      duration: Math.round((new Date(session.endTime) - new Date(session.startTime)) / 60000), // Duration in minutes
      maxParticipants: session.capacityFarmers + session.capacityBuyers
    }));

    res.json(sessionsWithCounts);
  } catch (error) {
    console.error('Get all sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

// Get all booking requests (Admin) - MOVED TO TOP
router.get('/booking-requests', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const requests = await prisma.bookingRequest.findMany({
      include: {
        user: { select: { name: true, email: true } },
        session: {
          include: {
            apmc: { select: { name: true, location: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const finalRequests = requests.map(req => ({
      ...req,
      farmer: req.user,
      apmc: req.session?.apmc
    }));

    res.json(finalRequests);
  } catch (error) {
    console.error('Get all booking requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking requests' });
  }
});

// Admin: Create session
router.post('/sessions', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { title, apmcId, dateTime, duration, maxParticipants, description } = req.body;
    if (!title || !apmcId || !dateTime) {
      return res.status(400).json({ success: false, message: 'title, apmcId, dateTime are required' });
    }

    const startTime = new Date(dateTime);
    const endTime = new Date(startTime.getTime() + (duration || 60) * 60000); // Add duration in minutes

    const session = await prisma.auctionSession.create({
      data: {
        apmcId,
        category: 'GENERAL', // Default category
        startTime,
        endTime,
        capacityFarmers: parseInt(maxParticipants) || 50,
        capacityBuyers: 100,
        createdBy: req.user.id,
        status: 'SCHEDULED'
      },
      include: {
        apmc: { select: { id: true, name: true, location: true } }
      }
    });

    // Add title and description to response (stored in session metadata if needed)
    const response = {
      ...session,
      title,
      description,
      dateTime: startTime, // Frontend expects dateTime
      duration: duration || 60,
      maxParticipants: parseInt(maxParticipants) || 50
    };

    res.status(201).json({ success: true, data: response });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ success: false, message: 'Failed to create session' });
  }
});

// Admin: Update session
router.put('/sessions/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, status, capacityFarmers, capacityBuyers } = req.body;
    const session = await prisma.auctionSession.update({
      where: { id },
      data: {
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime && { endTime: new Date(endTime) }),
        ...(status && { status }),
        ...(capacityFarmers && { capacityFarmers: parseInt(capacityFarmers) }),
        ...(capacityBuyers && { capacityBuyers: parseInt(capacityBuyers) })
      }
    });
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ success: false, message: 'Failed to update session' });
  }
});

// Admin: Dismiss/Cancel session
router.patch('/sessions/:id/dismiss', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    // First, check if session exists and is in SCHEDULED status
    const existingSession = await prisma.auctionSession.findUnique({
      where: { id }
    });

    if (!existingSession) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (existingSession.status !== 'SCHEDULED' && existingSession.status !== 'LIVE') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel session. Current status: ${existingSession.status}. Only SCHEDULED or LIVE sessions can be cancelled.`
      });
    }

    // Update session status to CANCELLED (or COMPLETED if it was LIVE)
    const newStatus = existingSession.status === 'LIVE' ? 'COMPLETED' : 'CANCELLED';
    const actionText = existingSession.status === 'LIVE' ? 'ended' : 'cancelled';

    const updatedSession = await prisma.auctionSession.update({
      where: { id },
      data: {
        status: newStatus,
        ...(existingSession.status === 'LIVE' ? { endTime: new Date() } : {})
      },
      include: {
        apmc: { select: { id: true, name: true, location: true } }
      }
    });

    // TODO: Notify participants about cancellation/end
    console.log(`📅 Session ${actionText}: ${id} by admin ${req.user.id}`);

    res.json({
      success: true,
      data: updatedSession,
      message: `Session ${actionText} successfully`
    });
  } catch (error) {
    console.error('Dismiss session error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel session' });
  }
});

// Public: List sessions by APMC and category/date
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { apmcId, category, from, to, status } = req.query;

    // Support comma-separated statuses, e.g. SCHEDULED,LIVE
    let statusFilter = undefined;
    if (status) {
      const statuses = String(status)
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (statuses.length === 1) {
        statusFilter = statuses[0];
      } else if (statuses.length > 1) {
        statusFilter = { in: statuses };
      }
    }

    // Default time filter: from now onward if no explicit range given
    const timeFilter = (from || to)
      ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined }
      : { gte: new Date() };

    const where = {
      ...(apmcId && { apmcId }),
      ...(category && { category: String(category).toUpperCase() }),
      ...(statusFilter ? { status: statusFilter } : {}),
      startTime: timeFilter
    };
    const sessions = await prisma.auctionSession.findMany({
      where,
      include: {
        apmc: { select: { id: true, name: true, location: true } },
        _count: { select: { registrations: true, produce: true } }
      },
      orderBy: { startTime: 'asc' },
      take: 50
    });

    // Transform data to match frontend expectations
    const transformedSessions = sessions.map(session => ({
      id: session.id,
      title: `${session.apmc.name} Auction Session`,
      description: `Auction session at ${session.apmc.name}`,
      dateTime: session.startTime,
      duration: Math.round((new Date(session.endTime) - new Date(session.startTime)) / 60000), // Duration in minutes
      maxParticipants: session.capacityFarmers + session.capacityBuyers,
      status: session.status,
      apmc: session.apmc,
      // send participants as a number
      participants: session._count.registrations || 0
    }));

    res.json(transformedSessions);
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to list sessions' });
  }
});

// Booking: request spot (farmer/buyer) - requires admin approval
router.post('/sessions/:id/request', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const role = req.user.role; // FARMER or BUYER
    if (!['FARMER', 'BUYER'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Only farmers or buyers can request spots' });
    }
    const session = await prisma.auctionSession.findUnique({ where: { id } });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (new Date(session.startTime) <= new Date()) {
      return res.status(400).json({ success: false, message: 'Cannot request after session start' });
    }

    const request = await prisma.bookingRequest.upsert({
      where: { sessionId_userId: { sessionId: id, userId: req.user.id } },
      update: { message, status: 'PENDING' },
      create: { sessionId: id, userId: req.user.id, role, message, status: 'PENDING' }
    });
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error('Request session error:', error);
    res.status(500).json({ success: false, message: 'Failed to request session' });
  }
});

// Get all APMCs (public endpoint)
router.get('/apmcs', async (req, res) => {
  try {
    console.log('Fetching APMCs...');
    // Try different model name casings
    let apmcs;
    try {
      apmcs = await prisma.aPMC.findMany({
        orderBy: { name: 'asc' }
      });
    } catch (caseError) {
      console.log('Trying alternative casing...');
      apmcs = await prisma.apmc.findMany({
        orderBy: { name: 'asc' }
      });
    }
    console.log('APMCs found:', apmcs.length);
    res.json(apmcs);
  } catch (error) {
    console.error('Get APMCs error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch APMCs', error: error.message });
  }
});

// Admin: List booking requests
router.get('/booking-requests', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { status, sessionId } = req.query;
    const where = {
      ...(status && { status }),
      ...(sessionId && { sessionId })
    };
    const requests = await prisma.bookingRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        session: {
          include: {
            apmc: { select: { name: true, location: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform data to match frontend expectations
    const transformedRequests = requests.map(request => ({
      id: request.id,
      farmer: {
        name: request.user.name,
        email: request.user.email
      },
      apmc: request.session?.apmc || { name: 'Unknown APMC' },
      productName: 'Mixed Produce', // Default as we don't have specific product in booking request
      grade: 'A',
      quantity: 100,
      requestedDate: request.createdAt,
      status: request.status
    }));

    res.json(transformedRequests);
  } catch (error) {
    console.error('List booking requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to list booking requests' });
  }
});

// Admin: Approve/Reject booking request
router.patch('/booking-requests/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, message } = req.body; // APPROVED or REJECTED
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be APPROVED or REJECTED' });
    }

    const request = await prisma.bookingRequest.findUnique({
      where: { id },
      include: {
        session: {
          include: {
            apmc: true
          }
        },
        user: true
      }
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    console.log('Processing booking request:', {
      id: request.id,
      status,
      sessionId: request.sessionId,
      userId: request.userId,
      role: request.role
    });

    // Update request
    const updatedRequest = await prisma.bookingRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        message: message || request.message
      }
    });

    // If approved, create spot registration
    if (status === 'APPROVED') {
      try {
        await prisma.spotRegistration.upsert({
          where: { sessionId_userId: { sessionId: request.sessionId, userId: request.userId } },
          update: { status: 'BOOKED' },
          create: {
            sessionId: request.sessionId,
            userId: request.userId,
            role: request.role,
            status: 'BOOKED'
          }
        });
        console.log('Spot registration created/updated successfully');
      } catch (spotError) {
        console.error('Error creating spot registration:', spotError);
        // Continue with notification even if spot registration fails
      }
    }

    // Send notification to user
    try {
      await prisma.notification.create({
        data: {
          userId: request.userId,
          title: `Booking Request ${status}`,
          body: `Your booking request for ${request.session?.apmc?.name || 'the session'} has been ${status.toLowerCase()}`,
          type: 'GENERAL'
        }
      });
      console.log('Notification sent successfully');
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Continue even if notification fails
    }

    res.json({ success: true, data: updatedRequest });
  } catch (error) {
    console.error('Update booking request error:', error);
    res.status(500).json({ success: false, message: 'Failed to update booking request' });
  }
});

// Farmer: Get own booking requests
router.get('/farmer/booking-requests', authenticateToken, authorizeRoles('FARMER'), async (req, res) => {
  try {
    const { status } = req.query;
    const where = {
      userId: req.user.id,
      ...(status && { status })
    };

    const requests = await prisma.bookingRequest.findMany({
      where,
      include: {
        session: {
          include: {
            apmc: { select: { id: true, name: true, location: true } }
          }
        },
        reviewer: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: requests.map(request => ({
        id: request.id,
        status: request.status,
        createdAt: request.createdAt,
        reviewedAt: request.reviewedAt,
        sessionId: request.sessionId,
        session: request.session ? {
          id: request.session.id,
          status: request.session.status,
          category: request.session.category,
          startTime: request.session.startTime,
          endTime: request.session.endTime,
          apmc: request.session.apmc
        } : null,
        apmc: request.session?.apmc || { name: 'Unknown APMC', location: 'Unknown Location' },
        reviewedBy: request.reviewer ? {
          id: request.reviewer.id,
          name: request.reviewer.name
        } : null
      }))
    });
  } catch (error) {
    console.error('Get farmer booking requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking requests' });
  }
});

// Bid history & analytics
router.get('/bid-history', authenticateToken, async (req, res) => {
  try {
    const { apmcId, product, range = '7days' } = req.query;

    if (!apmcId) {
      return res.status(400).json({ success: false, message: 'apmcId is required' });
    }

    const rangeDays = range === '90days' ? 90 : range === '30days' ? 30 : 7;
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    // Fetch completed sessions for given APMC and optional product
    const sessions = await prisma.produce.findMany({
      where: {
        apmcId,
        status: 'COMPLETED',
        auctionEndTime: { gte: since },
        ...(product && { category: product.toUpperCase() })
      },
      include: {
        winningBid: {
          include: { bidder: { select: { name: true } } }
        },
        farmer: { select: { name: true } },
        bids: true
      },
      orderBy: { auctionEndTime: 'desc' },
      take: 50
    });

    const history = sessions.map((s) => {
      const prices = s.bids.map(b => b.amount);
      const highest = prices.length ? Math.max(...prices) : s.basePrice;
      const lowest = prices.length ? Math.min(...prices) : s.basePrice;
      const avg = prices.length ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length)) : s.basePrice;
      return {
        id: s.id,
        date: s.auctionEndTime,
        product: s.title,
        highestBid: highest,
        lowestBid: lowest,
        avgBid: avg,
        totalBids: s.bids.length,
        winningFarmer: s.farmer.name,
        winningBuyer: s.winningBid?.bidder?.name || null,
        quantity: s.quantity,
        quality: s.grade || 'STANDARD'
      };
    });

    // Basic analytics
    const totalVolume = sessions.reduce((sum, s) => sum + s.quantity, 0);
    const avgBidsPerSession = sessions.length ? Math.round(sessions.reduce((sum, s) => sum + s.bids.length, 0) / sessions.length) : 0;
    const avgPriceIncrease = 0; // placeholder without baseline data

    return res.json({
      success: true,
      data: { history, analytics: { totalVolume, avgBidsPerSession, avgPriceIncrease } }
    });

  } catch (error) {
    console.error('Get bid history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bid history' });
  }
});

// Chat endpoints
router.get('/sessions/:id/chat', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: id },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100
    });
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get chat messages' });
  }
});

// Get single session details
router.get('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await prisma.auctionSession.findUnique({
      where: { id },
      include: {
        apmc: { select: { id: true, name: true, location: true } },
        _count: { select: { registrations: true, produce: true } }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Get starting price from active or next upcoming produce
    const activeProduce = await prisma.produce.findFirst({
      where: {
        sessionId: id,
        status: { in: ['LIVE', 'UPCOMING'] }
      },
      orderBy: [
        { status: 'asc' }, // LIVE before UPCOMING
        { auctionStartTime: 'asc' }
      ]
    });

    // Transform data to match frontend expectations
    const transformedSession = {
      id: session.id,
      title: `${session.apmc.name} Auction Session`,
      description: `Auction session at ${session.apmc.name}`,
      dateTime: session.startTime,
      duration: Math.round((new Date(session.endTime) - new Date(session.startTime)) / 60000), // Duration in minutes
      maxParticipants: session.capacityFarmers + session.capacityBuyers,
      status: session.status,
      apmc: session.apmc,
      participants: session._count.registrations || 0,
      startingPrice: activeProduce ? (activeProduce.currentBid || activeProduce.basePrice) : 0
    };

    res.json(transformedSession);
  } catch (error) {
    console.error('Get session details error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch session details' });
  }
});

// Get session with farmer queue
router.get('/sessions/:id/queue', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await prisma.auctionSession.findUnique({
      where: { id },
      include: {
        registrations: {
          where: { role: 'FARMER', status: 'BOOKED' },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' }
        },
        produce: {
          where: { status: { in: ['UPCOMING', 'LIVE'] } },
          include: { farmer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.produce) {
      session.produce = session.produce.map(parseImages);
    }

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Get session queue error:', error);
    res.status(500).json({ success: false, message: 'Failed to get session queue' });
  }
});

// Escrow: Accept/Reject bid
router.post('/escrow/:bidId/accept', authenticateToken, async (req, res) => {
  try {
    const { bidId } = req.params;
    const { accept } = req.body; // true/false

    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        produce: { include: { farmer: true } },
        bidder: true
      }
    });

    if (!bid) return res.status(404).json({ success: false, message: 'Bid not found' });
    if (bid.produce.farmerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the farmer can accept/reject' });
    }

    const escrow = await prisma.escrowTransaction.findUnique({
      where: { bidId }
    });

    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' });

    const updateData = accept
      ? { status: 'ACCEPTED', acceptedAt: new Date() }
      : { status: 'REJECTED', rejectedAt: new Date() };

    await prisma.escrowTransaction.update({
      where: { bidId },
      data: updateData
    });

    // Update produce status if accepted
    if (accept) {
      await prisma.produce.update({
        where: { id: bid.produceId },
        data: { status: 'COMPLETED' }
      });
    }

    res.json({ success: true, message: `Bid ${accept ? 'accepted' : 'rejected'}` });
  } catch (error) {
    console.error('Escrow accept/reject error:', error);
    res.status(500).json({ success: false, message: 'Failed to process escrow' });
  }
});

// Get all live auctions
router.get('/live', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      status: 'LIVE',
      auctionEndTime: { gt: new Date() },
      ...(category && { category }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const auctions = await prisma.produce.findMany({
      where,
      include: {
        farmer: { select: { id: true, name: true } },
        apmc: { select: { name: true, location: true } },
        bids: {
          where: { status: 'ACTIVE' },
          orderBy: { amount: 'desc' },
          take: 1,
          include: { bidder: { select: { name: true } } }
        },
        _count: { select: { bids: true } }
      },
      orderBy: { auctionEndTime: 'asc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.produce.count({ where });

    res.json({
      success: true,
      data: auctions.map(parseImages),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get live auctions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live auctions'
    });
  }
});

// Get upcoming auctions
router.get('/upcoming', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const auctions = await prisma.produce.findMany({
      where: {
        status: 'UPCOMING',
        auctionStartTime: { gt: new Date() }
      },
      include: {
        farmer: { select: { id: true, name: true } },
        apmc: { select: { name: true, location: true } }
      },
      orderBy: { auctionStartTime: 'asc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.produce.count({
      where: {
        status: 'UPCOMING',
        auctionStartTime: { gt: new Date() }
      }
    });

    res.json({
      success: true,
      data: auctions.map(parseImages),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get upcoming auctions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming auctions'
    });
  }
});

// Get auction details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const auction = await prisma.produce.findUnique({
      where: { id },
      include: {
        farmer: { select: { id: true, name: true, profileImage: true } },
        apmc: { select: { name: true, location: true } },
        bids: {
          where: { status: { in: ['ACTIVE', 'WON'] } },
          include: { bidder: { select: { id: true, name: true } } },
          orderBy: { amount: 'desc' },
          take: 10
        },
        winningBid: {
          include: { bidder: { select: { name: true } } }
        },
        _count: { select: { bids: true } }
      }
    });

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    res.json({
      success: true,
      data: parseImages(auction)
    });
  } catch (error) {
    console.error('Get auction details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch auction details'
    });
  }
});

// Place bid (handled via Socket.IO, but keep REST endpoint for backup)
router.post('/:id/bid', authenticateToken, async (req, res) => {
  try {
    const { id: produceId } = req.params;
    const { amount, quantity } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid bid amount is required'
      });
    }

    // Get auction details
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
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    if (produce.status !== 'LIVE') {
      return res.status(400).json({
        success: false,
        message: 'Auction is not currently live'
      });
    }

    if (produce.farmerId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot bid on your own produce'
      });
    }

    const currentHighestBid = produce.bids[0]?.amount || produce.basePrice;
    if (amount <= currentHighestBid) {
      return res.status(400).json({
        success: false,
        message: `Bid must be higher than current bid of ₹${currentHighestBid}`
      });
    }

    // Create bid
    const newBid = await prisma.bid.create({
      data: {
        amount,
        quantity: quantity || produce.quantity,
        bidderId: req.user.id,
        produceId,
        status: 'ACTIVE'
      },
      include: {
        bidder: { select: { id: true, name: true } }
      }
    });

    // Update produce
    await prisma.produce.update({
      where: { id: produceId },
      data: {
        currentBid: amount,
        winningBidId: newBid.id
      }
    });

    res.json({
      success: true,
      message: 'Bid placed successfully',
      data: newBid
    });

  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place bid'
    });
  }
});

// Get user's bids
router.get('/user/bids', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      bidderId: req.user.id,
      ...(status && { status })
    };

    const bids = await prisma.bid.findMany({
      where,
      include: {
        produce: {
          select: {
            id: true,
            title: true,
            images: true,
            auctionEndTime: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.bid.count({ where });

    res.json({
      success: true,
      data: bids.map(bid => {
        if (bid.produce) parseImages(bid.produce);
        return bid;
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get user bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user bids'
    });
  }
});

// Create new auction (farmers only)
router.post('/', authenticateToken, authorizeRoles('FARMER'), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      variety,
      quantity,
      unit = 'kg',
      basePrice,
      grade,
      harvestDate,
      shelfLife,
      storageTemp,
      certification,
      auctionStartTime,
      auctionEndTime,
      pickupLocation,
      images = []
    } = req.body;

    console.log('Create Auction Request:', {
      body: req.body,
      user: req.user
    });

    // Validation
    if (!title || !category || !quantity || !basePrice || !auctionStartTime || !auctionEndTime) {
      console.log('Missing required fields:', { title, category, quantity, basePrice, auctionStartTime, auctionEndTime });
      return res.status(400).json({
        success: false,
        message: 'Required fields: title, category, quantity, basePrice, auctionStartTime, auctionEndTime'
      });
    }

    const startTime = new Date(auctionStartTime);
    const endTime = new Date(auctionEndTime);

    // Only validate start time for standalone auctions (no session)
    if (!req.body.sessionId && startTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Auction start time must be in the future'
      });
    }

    if (endTime <= startTime) {
      return res.status(400).json({
        success: false,
        message: 'Auction end time must be after start time'
      });
    }

    // Get user's APMC
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { apmcId: true }
    });

    // Optional: session binding and timing enforcement
    let sessionId = null;
    if (req.body.sessionId) {
      const session = await prisma.auctionSession.findUnique({ where: { id: req.body.sessionId } });
      if (!session) {
        return res.status(400).json({ success: false, message: 'Invalid sessionId' });
      }
      if (session.apmcId !== user.apmcId) {
        return res.status(400).json({ success: false, message: 'Session does not belong to your APMC' });
      }

      // Allow listing even if session has started (for late joiners/just-in-time listing)
      // but ensure session hasn't ENDED
      if (['COMPLETED', 'CANCELLED'].includes(session.status)) {
        return res.status(400).json({ success: false, message: 'Cannot list in a completed or cancelled session' });
      }

      sessionId = session.id;
    }

    const produce = await prisma.produce.create({
      data: {
        title,
        description,
        category,
        variety,
        quantity: parseFloat(quantity),
        unit,
        basePrice: parseFloat(basePrice),
        grade,
        harvestDate: harvestDate ? new Date(harvestDate) : null,
        shelfLife: shelfLife ? parseInt(shelfLife) : null,
        storageTemp,
        certification,
        farmerId: req.user.id,
        apmcId: user.apmcId,
        pickupLocation,
        auctionStartTime: sessionId ? new Date(startTime) : startTime,
        auctionEndTime: sessionId ? new Date(endTime) : endTime,
        sessionId,
        images: JSON.stringify(images),
        status: startTime <= new Date() ? 'LIVE' : 'UPCOMING'
      },
      include: {
        farmer: { select: { name: true } },
        apmc: { select: { name: true, location: true } }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Auction created successfully',
      data: produce
    });

  } catch (error) {
    console.error('Create auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create auction'
    });
  }
});

// Get farmer's auctions
router.get('/farmer/auctions', authenticateToken, authorizeRoles('FARMER'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      farmerId: req.user.id,
      ...(status && { status })
    };

    const auctions = await prisma.produce.findMany({
      where,
      include: {
        apmc: { select: { name: true, location: true } },
        bids: {
          where: { status: 'ACTIVE' },
          orderBy: { amount: 'desc' },
          take: 1
        },
        _count: { select: { bids: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.produce.count({ where });

    res.json({
      success: true,
      data: auctions.map(parseImages),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get farmer auctions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch farmer auctions'
    });
  }
});

// Get session participants
router.get('/sessions/:id/participants', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const participants = await prisma.bookingRequest.findMany({
      where: {
        sessionId: id,
        status: 'APPROVED'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    const participantsList = participants.map(p => p.user);

    res.json(participantsList);
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participants'
    });
  }
});

// Get session bids
router.get('/sessions/:id/bids', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const bids = await prisma.bid.findMany({
      where: {
        produce: { sessionId: id }
      },
      include: {
        bidder: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: {
        amount: 'desc'
      }
    });

    res.json(bids);
  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bids'
    });
  }
});

// Place a bid
router.post('/sessions/:id/bid', authenticateToken, authorizeRoles('BUYER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, quantity = 1 } = req.body;

    // Check if session is live
    const session = await prisma.auctionSession.findUnique({
      where: { id }
    });

    if (!session || session.status !== 'LIVE') {
      return res.status(400).json({
        success: false,
        message: 'Session is not active for bidding'
      });
    }

    // Check if user is approved for this session
    const booking = await prisma.bookingRequest.findFirst({
      where: {
        sessionId: id,
        userId: req.user.id,
        status: 'APPROVED'
      }
    });

    if (!booking) {
      return res.status(403).json({
        success: false,
        message: 'You are not approved to bid in this session'
      });
    }

    // Find the currently LIVE produce for this session
    let activeProduce = await prisma.produce.findFirst({
      where: {
        sessionId: id,
        status: 'LIVE'
      },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          take: 1
        }
      }
    });

    // If no LIVE produce, look for UPCOMING produce to auto-activate
    if (!activeProduce) {
      const nextProduce = await prisma.produce.findFirst({
        where: {
          sessionId: id,
          status: 'UPCOMING'
        },
        orderBy: { auctionStartTime: 'asc' }
      });

      if (nextProduce) {
        // Auto-activate the produce
        activeProduce = await prisma.produce.update({
          where: { id: nextProduce.id },
          data: { status: 'LIVE' },
          include: {
            bids: {
              orderBy: { amount: 'desc' },
              take: 1
            }
          }
        });
        console.log(`Auto-activated produce ${activeProduce.id} for session ${id}`);
      } else {
        // Fallback: Check for APPROVED booking request to auto-create produce
        // This handles cases where farmer was approved but didn't list item manually
        const approvedBooking = await prisma.bookingRequest.findFirst({
          where: {
            sessionId: id,
            status: 'APPROVED',
            role: 'FARMER'
          },
          orderBy: { createdAt: 'asc' }
        });

        if (approvedBooking) {
          // Get farmer's APMC for the produce record
          const farmerId = approvedBooking.userId;
          const farmer = await prisma.user.findUnique({
            where: { id: farmerId },
            select: { apmcId: true }
          });

          // Create new Produce from Booking Request
          activeProduce = await prisma.produce.create({
            data: {
              title: approvedBooking.productName || 'Fresh Produce',
              description: approvedBooking.message || 'Auto-generated from booking request',
              category: 'GENERAL',
              quantity: parseFloat(approvedBooking.quantity) || 100,
              unit: 'kg',
              basePrice: 1000, // Default base price
              farmerId: farmerId,
              apmcId: farmer?.apmcId,
              sessionId: id,
              auctionStartTime: new Date(),
              auctionEndTime: new Date(Date.now() + 60 * 60000), // 1 hour duration
              status: 'LIVE'
            },
            include: {
              bids: true // Empty initially
            }
          });
          console.log(`Auto-created produce ${activeProduce.id} from booking ${approvedBooking.id}`);
        }
      }
    }

    if (!activeProduce) {
      return res.status(400).json({
        success: false,
        message: 'No active or upcoming produce found for bidding in this session'
      });
    }

    const currentHighestBid = activeProduce.bids[0]?.amount || activeProduce.basePrice;

    if (amount <= currentHighestBid) {
      return res.status(400).json({
        success: false,
        message: `Bid must be higher than current highest bid of ₹${currentHighestBid}`
      });
    }

    // Create the bid linked to the active produce
    const bid = await prisma.bid.create({
      data: {
        produceId: activeProduce.id,
        bidderId: req.user.id,
        amount: parseFloat(amount),
        quantity: parseInt(quantity),
        status: 'ACTIVE'
      },
      include: {
        bidder: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    // Update the produce with the new highest bid
    await prisma.produce.update({
      where: { id: activeProduce.id },
      data: {
        currentBid: parseFloat(amount),
        winningBidId: bid.id
      }
    });

    res.json({
      success: true,
      data: bid
    });

  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place bid: ' + error.message
    });
  }
});

// Request spot for session
router.post('/request-spot', authenticateToken, async (req, res) => {
  try {
    const { sessionId, productName, quantity, grade } = req.body;

    // Check if user already has a request for this session
    const existingRequest = await prisma.bookingRequest.findFirst({
      where: {
        sessionId,
        userId: req.user.id
      }
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a request for this session'
      });
    }

    const booking = await prisma.bookingRequest.create({
      data: {
        sessionId,
        userId: req.user.id,
        role: req.user.role, // Required field from schema
        productName: productName || 'Mixed Produce',
        quantity: parseInt(quantity) || 100,
        grade: grade || 'A',
        status: 'PENDING'
      }
    });

    res.json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Request spot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request spot'
    });
  }
});



// Clear all booking requests for farmer
router.delete('/farmer/booking-requests/clear-all', authenticateToken, authorizeRoles('FARMER'), async (req, res) => {
  try {
    await prisma.bookingRequest.deleteMany({
      where: {
        userId: req.user.id
      }
    });

    res.json({
      success: true,
      message: 'All booking requests cleared successfully'
    });
  } catch (error) {
    console.error('Clear all booking requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear booking requests'
    });
  }
});

// Delete single booking request
router.delete('/farmer/booking-requests/:id', authenticateToken, authorizeRoles('FARMER'), async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.bookingRequest.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking request not found'
      });
    }

    await prisma.bookingRequest.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Booking request deleted successfully'
    });
  } catch (error) {
    console.error('Delete booking request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete booking request'
    });
  }
});

// Admin: Clear all non-live sessions (SCHEDULED, COMPLETED, CANCELLED)
router.delete('/admin/sessions/clear-non-live', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    // 1. Find sessions to satisfy the condition
    const sessionsToDelete = await prisma.auctionSession.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'COMPLETED', 'CANCELLED']
        }
      },
      select: { id: true }
    });

    const sessionIds = sessionsToDelete.map(s => s.id);

    if (sessionIds.length === 0) {
      return res.json({
        success: true,
        message: 'No non-live sessions found to clear',
        count: 0
      });
    }

    console.log(`Clearing ${sessionIds.length} sessions:`, sessionIds);

    // 2. Perform manual cascade delete/unlink in a transaction
    await prisma.$transaction([
      // Delete dependent BookingRequests
      prisma.bookingRequest.deleteMany({
        where: { sessionId: { in: sessionIds } }
      }),
      // Delete dependent SpotRegistrations
      prisma.spotRegistration.deleteMany({
        where: { sessionId: { in: sessionIds } }
      }),
      // Delete dependent ChatMessages
      prisma.chatMessage.deleteMany({
        where: { sessionId: { in: sessionIds } }
      }),
      // Unlink Produce (set sessionId = null)
      prisma.produce.updateMany({
        where: { sessionId: { in: sessionIds } },
        data: { sessionId: null }
      }),
      // Delete dependent EscrowTransactions
      prisma.escrowTransaction.deleteMany({
        where: { sessionId: { in: sessionIds } }
      }),
      // Finally, delete the Sessions
      prisma.auctionSession.deleteMany({
        where: { id: { in: sessionIds } }
      })
    ]);

    res.json({
      success: true,
      message: `Cleared ${sessionIds.length} non-live sessions and related data successfully`,
      count: sessionIds.length
    });
  } catch (error) {
    console.error('Clear non-live sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear non-live sessions: ' + error.message
    });
  }
});

// Admin: Clear all processed booking requests (APPROVED, REJECTED)
router.delete('/admin/booking-requests/clear-processed', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const deletedRequests = await prisma.bookingRequest.deleteMany({
      where: {
        status: {
          in: ['APPROVED', 'REJECTED']
        }
      }
    });

    res.json({
      success: true,
      message: `Cleared ${deletedRequests.count} processed booking requests successfully`,
      count: deletedRequests.count
    });
  } catch (error) {
    console.error('Clear processed booking requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear processed booking requests'
    });
  }
});

// Track user presence (API based fallback)
router.post('/sessions/:id/enter', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // We assume produceId is passed or we find active produce for session
    // Actually socketService tracks by produceId for auctions. 
    // If we track session exit, we need session logic. 
    // But user asked for "bid should end", which is Auction level.
    // So let's find the active produce for this session.

    const produce = await prisma.produce.findFirst({
      where: { sessionId: id, status: 'LIVE' }
    });

    if (produce) {
      const socketService = req.app.get('socketService');
      socketService.enterAuction(produce.id, req.user.id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Enter session error:', error);
    res.status(500).json({ success: false });
  }
});

router.post('/sessions/:id/exit', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const produce = await prisma.produce.findFirst({
      where: { sessionId: id, status: 'LIVE' }
    });

    if (produce) {
      const socketService = req.app.get('socketService');
      socketService.leaveAuction(produce.id, req.user.id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Exit session error:', error);
    res.status(500).json({ success: false });
  }
});

router.post('/sessions/:id/end', authenticateToken, authorizeRoles('FARMER'), async (req, res) => {
  try {
    const { id } = req.params;

    // Find active produce for this session
    const produce = await prisma.produce.findFirst({
      where: { sessionId: id, status: 'LIVE' },
      include: { bids: { orderBy: { amount: 'desc' }, take: 1 } }
    });

    if (!produce) {
      return res.status(404).json({ success: false, message: 'No live auction found for this session' });
    }

    // Verify ownership
    if (produce.farmerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not the owner of this auction' });
    }

    // Trigger end auction
    const socketService = req.app.get('socketService');
    await socketService.endAuction(produce.id);

    res.json({
      success: true,
      message: 'Auction ended successfully',
      winningBid: produce.bids[0] || null
    });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ success: false, message: 'Failed to end auction' });
  }
});

module.exports = router;