const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const prisma = require('../config/database');

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        apmc: { select: { name: true, location: true } },
        wallet: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove sensitive data
    const { password, ...userProfile } = user;

    res.json({
      success: true,
      data: userProfile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      profileImage,
      notificationPreferences,
      bio,
      companyName,
      gstNumber
    } = req.body;

    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(profileImage && { profileImage }),
        ...(notificationPreferences && { notificationPreferences }),
        ...(bio && { bio }),
        ...(companyName && { companyName }),
        ...(gstNumber && { gstNumber })
      },
      include: {
        apmc: { select: { name: true, location: true } },
        wallet: true
      }
    });

    // Remove sensitive data
    const { password, ...userProfile } = updatedUser;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: userProfile
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Get user dashboard stats
router.get('/dashboard-stats', authenticateToken, async (req, res) => {
  try {
    let stats = {};

    if (req.user.role === 'FARMER') {
      // Farmer dashboard stats
      const [
        totalAuctions,
        liveAuctions,
        completedAuctions,
        totalEarnings,
        pendingOrders
      ] = await Promise.all([
        prisma.produce.count({ where: { farmerId: req.user.id } }),
        prisma.produce.count({
          where: {
            farmerId: req.user.id,
            status: 'LIVE'
          }
        }),
        prisma.produce.count({
          where: {
            farmerId: req.user.id,
            status: 'COMPLETED'
          }
        }),
        prisma.order.aggregate({
          where: {
            farmerId: req.user.id,
            status: { in: ['CONFIRMED', 'DELIVERED'] }
          },
          _sum: { amount: true }
        }),
        prisma.order.count({
          where: {
            farmerId: req.user.id,
            status: { in: ['CONFIRMED', 'SHIPPED'] }
          }
        })
      ]);

      stats = {
        totalAuctions,
        liveAuctions,
        completedAuctions,
        totalEarnings: totalEarnings._sum.amount || 0,
        pendingOrders
      };

    } else if (req.user.role === 'BUYER') {
      // Buyer dashboard stats
      const [
        totalBids,
        wonBids,
        activeBids,
        totalSpent,
        pendingOrders
      ] = await Promise.all([
        prisma.bid.count({ where: { bidderId: req.user.id } }),
        prisma.bid.count({
          where: {
            bidderId: req.user.id,
            status: 'WON'
          }
        }),
        prisma.bid.count({
          where: {
            bidderId: req.user.id,
            status: 'ACTIVE'
          }
        }),
        prisma.order.aggregate({
          where: {
            buyerId: req.user.id,
            status: { in: ['CONFIRMED', 'DELIVERED'] }
          },
          _sum: { amount: true }
        }),
        prisma.order.count({
          where: {
            buyerId: req.user.id,
            status: { in: ['CONFIRMED', 'SHIPPED'] }
          }
        })
      ]);

      stats = {
        totalBids,
        wonBids,
        activeBids,
        totalSpent: totalSpent._sum.amount || 0,
        pendingOrders
      };

    } else if (req.user.role === 'ADMIN') {
      // Admin dashboard stats
      const [
        totalSessions,
        completedSessions,
        cancelledSessions,
        highestBidRecord
      ] = await Promise.all([
        prisma.auctionSession.count({ where: { createdBy: req.user.id } }),
        prisma.auctionSession.count({ where: { createdBy: req.user.id, status: 'COMPLETED' } }),
        prisma.auctionSession.count({ where: { createdBy: req.user.id, status: 'CANCELLED' } }),
        prisma.bid.findFirst({
          where: {
            status: 'WON',
            produce: {
              session: {
                createdBy: req.user.id
              }
            }
          },
          orderBy: {
            amount: 'desc'
          },
          select: {
            amount: true
          }
        })
      ]);

      stats = {
        totalSessions,
        completedSessions,
        cancelledSessions,
        highestBid: highestBidRecord?.amount || 0
      };
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats'
    });
  }
});

// Get user orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      ...(req.user.role === 'BUYER' ? { buyerId: req.user.id } : { farmerId: req.user.id }),
      ...(status && { status })
    };

    const orders = await prisma.order.findMany({
      where,
      include: {
        buyer: { select: { id: true, name: true } },
        farmer: { select: { id: true, name: true } },
        produce: { select: { title: true, images: true } },
        bid: { select: { amount: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.order.count({ where });

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// Update order status (farmers can update shipping/delivery status)
router.put('/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { buyer: true, farmer: true, produce: true }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (req.user.role === 'FARMER' && order.farmerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this order'
      });
    }

    if (req.user.role === 'BUYER' && order.buyerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this order'
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...(trackingNumber && { trackingNumber }),
        ...(status === 'DELIVERED' && { deliveredAt: new Date() })
      },
      include: {
        buyer: { select: { id: true, name: true } },
        farmer: { select: { id: true, name: true } },
        produce: { select: { title: true } }
      }
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        apmc: { select: { name: true, location: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.user.count({ where });

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Toggle user active status (admin only)
router.put('/:id/toggle-status', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    res.json({
      success: true,
      message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedUser
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle user status'
    });
  }
});

// Admin: Get user statistics
router.get('/statistics', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    // Get total user count
    const totalUsers = await prisma.user.count();

    // Get user count by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        role: true
      }
    });

    // Get active vs inactive users
    const activeUsers = await prisma.user.count({
      where: { isActive: true }
    });

    const inactiveUsers = await prisma.user.count({
      where: { isActive: false }
    });

    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    // Get registrations by APMC
    const usersByApmc = await prisma.user.groupBy({
      by: ['apmcId'],
      _count: {
        apmcId: true
      },
      where: {
        apmcId: {
          not: null
        }
      }
    });

    // Get APMC names for the grouped data
    const apmcIds = usersByApmc.map(item => item.apmcId).filter(Boolean);
    const apmcs = await prisma.aPMC.findMany({
      where: {
        id: {
          in: apmcIds
        }
      },
      select: {
        id: true,
        name: true,
        location: true
      }
    });

    // Map APMC data with user counts
    const usersByApmcWithNames = usersByApmc.map(item => {
      const apmc = apmcs.find(a => a.id === item.apmcId);
      return {
        apmcId: item.apmcId,
        apmcName: apmc ? `${apmc.name}, ${apmc.location}` : 'Unknown APMC',
        userCount: item._count.apmcId
      };
    });

    // Format role data
    const roleStats = {
      FARMER: 0,
      BUYER: 0,
      ADMIN: 0
    };

    usersByRole.forEach(item => {
      roleStats[item.role] = item._count.role;
    });

    const statistics = {
      totalUsers,
      activeUsers,
      inactiveUsers,
      recentRegistrations,
      usersByRole: roleStats,
      usersByApmc: usersByApmcWithNames
    };

    res.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
});

module.exports = router;