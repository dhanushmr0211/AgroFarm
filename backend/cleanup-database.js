const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function cleanDatabase() {
    try {
        console.log('🧹 Starting database cleanup...');

        // Step 1: Delete all data from dependent tables
        console.log('📝 Deleting notifications...');
        await prisma.notification.deleteMany({});

        console.log('📝 Deleting device tokens...');
        await prisma.deviceToken.deleteMany({});

        console.log('📝 Deleting reviews...');
        await prisma.review.deleteMany({});

        console.log('📝 Deleting chat messages...');
        await prisma.chatMessage.deleteMany({});

        console.log('📝 Deleting escrow transactions...');
        await prisma.escrowTransaction.deleteMany({});

        console.log('📝 Deleting bid history...');
        await prisma.bidHistory.deleteMany({});

        console.log('📝 Deleting orders...');
        await prisma.order.deleteMany({});

        console.log('📝 Deleting transactions...');
        await prisma.transaction.deleteMany({});

        console.log('📝 Deleting bids...');
        await prisma.bid.deleteMany({});

        console.log('📝 Deleting produce...');
        await prisma.produce.deleteMany({});

        console.log('📝 Deleting spot registrations...');
        await prisma.spotRegistration.deleteMany({});

        console.log('📝 Deleting booking requests...');
        await prisma.bookingRequest.deleteMany({});

        console.log('📝 Deleting auction sessions...');
        await prisma.auctionSession.deleteMany({});

        console.log('📝 Deleting wallets...');
        await prisma.wallet.deleteMany({});

        console.log('📝 Deleting all users...');
        await prisma.user.deleteMany({});

        // Step 2: Create 3 fresh users
        console.log('\n👥 Creating 3 new users...');

        const hashedPassword = await bcrypt.hash('password123', 10);

        // Create Admin
        const admin = await prisma.user.create({
            data: {
                email: 'admin@agrofarm.com',
                password: hashedPassword,
                name: 'Admin User',
                role: 'ADMIN',
                phone: '+91 9876543210',
                address: 'AgroFarm HQ, Bangalore'
            }
        });
        console.log('✅ Created Admin:', admin.email);

        // Create Farmer
        const farmer = await prisma.user.create({
            data: {
                email: 'farmer@agrofarm.com',
                password: hashedPassword,
                name: 'Rajesh Kumar',
                role: 'FARMER',
                phone: '+91 9876543211',
                address: 'Village Farm, Karnataka'
            }
        });
        console.log('✅ Created Farmer:', farmer.email);

        // Create Buyer
        const buyer = await prisma.user.create({
            data: {
                email: 'buyer@agrofarm.com',
                password: hashedPassword,
                name: 'Priya Sharma',
                role: 'BUYER',
                phone: '+91 9876543212',
                address: 'Market Street, Mumbai'
            }
        });
        console.log('✅ Created Buyer:', buyer.email);

        // Create wallets for all users
        console.log('\n💰 Creating wallets...');
        await prisma.wallet.create({
            data: { userId: admin.id, balance: 0 }
        });
        await prisma.wallet.create({
            data: { userId: farmer.id, balance: 0 }
        });
        await prisma.wallet.create({
            data: { userId: buyer.id, balance: 10000 } // Give buyer some initial balance
        });
        console.log('✅ Wallets created');

        // Step 3: Verify cleanup
        console.log('\n📊 Database Summary:');
        const userCount = await prisma.user.count();
        const produceCount = await prisma.produce.count();
        const bidCount = await prisma.bid.count();
        const transactionCount = await prisma.transaction.count();
        const walletCount = await prisma.wallet.count();

        console.log(`   Users: ${userCount}`);
        console.log(`   Produce: ${produceCount}`);
        console.log(`   Bids: ${bidCount}`);
        console.log(`   Transactions: ${transactionCount}`);
        console.log(`   Wallets: ${walletCount}`);

        console.log('\n✅ Database cleanup completed successfully!');
        console.log('\n🔑 Login Credentials (password for all: password123):');
        console.log('   Admin:  admin@agrofarm.com');
        console.log('   Farmer: farmer@agrofarm.com');
        console.log('   Buyer:  buyer@agrofarm.com');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

cleanDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
