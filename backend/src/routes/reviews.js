const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get reviews for a user
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const revieweeId = userId === 'me' ? req.user.id : userId;

        const reviews = await prisma.review.findMany({
            where: { revieweeId },
            include: {
                reviewer: {
                    select: { id: true, name: true, profileImage: true }
                },
                order: {
                    include: {
                        produce: { select: { title: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: reviews });
    } catch (error) {
        console.error('Fetch reviews error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
    }
});

// Create a review
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { orderId, rating, comment } = req.body;
        const reviewerId = req.user.id;

        // Check if order exists and user is part of it
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.buyerId !== reviewerId && order.farmerId !== reviewerId) {
            return res.status(403).json({ success: false, message: 'Not authorized to review this order' });
        }

        // Determine who is being reviewed
        const revieweeId = order.buyerId === reviewerId ? order.farmerId : order.buyerId;

        // Check if review already exists
        const existingReview = await prisma.review.findUnique({
            where: {
                orderId_reviewerId: {
                    orderId,
                    reviewerId
                }
            }
        });

        if (existingReview) {
            return res.status(400).json({ success: false, message: 'You have already reviewed this order' });
        }

        // Create review
        const review = await prisma.review.create({
            data: {
                orderId,
                reviewerId,
                revieweeId,
                rating: parseInt(rating),
                comment
            }
        });

        res.json({ success: true, data: review });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ success: false, message: 'Failed to create review' });
    }
});

module.exports = router;
