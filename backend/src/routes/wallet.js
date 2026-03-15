const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../config/database');

// Get wallet balance and escrow summary
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        // Get or create wallet
        let wallet = await prisma.wallet.findUnique({
            where: { userId }
        });

        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: { userId, balance: 0 }
            });
        }

        // Calculate Escrow Balance
        // For Buyer: Locked funds (PENDING or ACCEPTED)
        // For Farmer: Expected earnings (PENDING or ACCEPTED)
        // Note: Escrow funds are theoretically "deducted" from wallet when moved to escrow? 
        // Or just marked? "Wallet Balance" usually implies "Available".
        // "Escrow Balance" implies "Locked".

        let escrowBalance = 0;

        if (role === 'BUYER') {
            const result = await prisma.escrowTransaction.aggregate({
                where: {
                    buyerId: userId,
                    status: { in: ['PENDING', 'ACCEPTED'] }
                },
                _sum: { amount: true }
            });
            escrowBalance = result._sum.amount || 0;
        } else if (role === 'FARMER') {
            const result = await prisma.escrowTransaction.aggregate({
                where: {
                    farmerId: userId,
                    status: { in: ['PENDING', 'ACCEPTED'] }
                },
                _sum: { amount: true }
            });
            escrowBalance = result._sum.amount || 0;
        }

        res.json({
            success: true,
            data: {
                balance: wallet.balance,
                escrowBalance
            }
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
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const where = { userId: req.user.id };

        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: parseInt(limit)
        });

        const total = await prisma.transaction.count({ where });

        // Format for frontend
        const formattedTransactions = transactions.map(t => ({
            id: t.id,
            type: t.type === 'WALLET_TOPUP' || t.type === 'REFUND' || t.type === 'SALES_REVENUE' ? 'credit' : 'debit',
            amount: t.amount,
            description: t.description || t.type,
            date: t.createdAt.toLocaleDateString(),
            time: t.createdAt.toLocaleTimeString(),
            status: t.status.toLowerCase()
        }));

        res.json({
            success: true,
            data: formattedTransactions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions'
        });
    }
});

// Get escrow transactions details
router.get('/escrow', authenticateToken, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.id;

        const where = role === 'BUYER' ? { buyerId: userId } : { farmerId: userId };

        // Fetch active escrow transactions
        const escrowItems = await prisma.escrowTransaction.findMany({
            where: {
                ...where,
                status: { in: ['PENDING', 'ACCEPTED'] }
            },
            include: {
                bid: {
                    include: { produce: true }
                },
                farmer: { select: { name: true } },
                buyer: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formattedEscrow = escrowItems.map(item => ({
            id: item.id,
            amount: item.amount,
            description: item.bid?.produce?.title || 'Unknown Item',
            farmer: item.farmer?.name,
            buyer: item.buyer?.name,
            date: item.createdAt.toLocaleDateString(),
            expectedRelease: 'Pending Delivery', // Logic could be improved based on delivery date
            status: item.status
        }));

        res.json({
            success: true,
            data: formattedEscrow
        });

    } catch (error) {
        console.error('Get escrow error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch escrow details'
        });
    }
});

module.exports = router;
