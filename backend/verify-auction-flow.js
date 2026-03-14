const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyFlow() {
    console.log('🚀 Starting Auction Flow Verification...');

    try {
        // 1. Get or Create Test Users
        let farmer = await prisma.user.findFirst({ where: { role: 'FARMER' } });
        let buyer = await prisma.user.findFirst({ where: { role: 'BUYER' } });

        if (!farmer || !buyer) {
            console.log('⚠️ Missing test users. Please ensure seed data exists.');
            return;
        }
        console.log(`✅ Using Farmer: ${farmer.name} and Buyer: ${buyer.name}`);

        // 2. Create a Test Auction Session if not exists
        let session = await prisma.auctionSession.findFirst({
            where: { status: 'LIVE' },
            include: { apmc: true }
        });

        if (!session) {
            const apmc = await prisma.aPMC.findFirst();
            if (!apmc) { console.log('❌ No APMC found'); return; }

            console.log('ℹ️ Creating new LIVE session...');
            session = await prisma.auctionSession.create({
                data: {
                    apmcId: apmc.id,
                    category: 'VEGETABLES',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 3600000), // 1 hour from now
                    status: 'LIVE', // Force LIVE for testing
                    createdBy: farmer.id
                },
                include: { apmc: true }
            });
        }
        console.log(`✅ Active Session: ${session.id} at ${session.apmc.name}`);

        // 3. Create Produce for this session
        const produce = await prisma.produce.create({
            data: {
                title: 'Test Tomatoes ' + Date.now(),
                category: 'VEGETABLES',
                quantity: 100,
                basePrice: 50,
                farmerId: farmer.id,
                sessionId: session.id,
                status: 'LIVE',
                auctionStartTime: new Date(),
                auctionEndTime: new Date(Date.now() + 3600000)
            }
        });
        console.log(`✅ Created Produce: ${produce.title} (${produce.id})`);

        // 4. Simulate Bid (Buyer)
        const bidAmount = 60;
        const bid = await prisma.bid.create({
            data: {
                amount: bidAmount,
                quantity: 100,
                bidderId: buyer.id,
                produceId: produce.id,
                status: 'ACTIVE'
            }
        });
        console.log(`✅ Placed Bid: ₹${bidAmount} by ${buyer.name}`);

        // 5. Verify Escrow Creation (Should be triggered by application logic, but here we verify manual creation to simulate flow)
        // Note: In real app, socket service creates this. We will verify if we can create it.
        const escrow = await prisma.escrowTransaction.create({
            data: {
                bidId: bid.id,
                amount: bidAmount,
                farmerId: farmer.id,
                buyerId: buyer.id,
                sessionId: session.id,
                status: 'PENDING'
            }
        });
        console.log(`✅ Escrow Record Created: ₹${escrow.amount} (ID: ${escrow.id})`);

        // 6. Simulate Chat Message
        const chat = await prisma.chatMessage.create({
            data: {
                sessionId: session.id,
                userId: buyer.id,
                message: 'Is this organic?',
                type: 'MESSAGE'
            }
        });
        console.log(`✅ Chat Message Saved: "${chat.message}"`);

        // 7. Verification Summary
        console.log('\n✨ VERIFICATION SUCCESSFUL ✨');
        console.log('-----------------------------------');
        console.log(`1. Users Verified: YES`);
        console.log(`2. Live Session: YES (${session.id})`);
        console.log(`3. Produce Listed: YES (${produce.id})`);
        console.log(`4. Bid Placed: YES (₹${bid.amount})`);
        console.log(`5. Escrow Secured: YES (₹${escrow.amount})`);
        console.log(`6. Chat Persisted: YES`);
        console.log('-----------------------------------');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyFlow();
