const prisma = require('../config/database');

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create APMCs
    const apmcs = await Promise.all([
      prisma.aPMC.create({
        data: {
          name: 'Delhi APMC',
          location: 'Azadpur, Delhi',
          state: 'Delhi',
          pincode: '110033',
          contactInfo: '+91-11-27674567'
        }
      }),
      prisma.aPMC.create({
        data: {
          name: 'Mumbai APMC',
          location: 'Vashi, Navi Mumbai',
          state: 'Maharashtra',
          pincode: '400703',
          contactInfo: '+91-22-27815678'
        }
      }),
      prisma.aPMC.create({
        data: {
          name: 'Bangalore APMC',
          location: 'Yeshwantpur, Bangalore',
          state: 'Karnataka',
          pincode: '560022',
          contactInfo: '+91-80-23456789'
        }
      })
    ]);

    console.log(`✅ Created ${apmcs.length} APMCs`);

    // Create test users
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 10);

    const farmer1 = await prisma.user.create({
      data: {
        email: 'farmer1@example.com',
        phone: '+91-9876543210',
        password: hashedPassword,
        name: 'Rajesh Kumar',
        role: 'FARMER',
        apmcId: apmcs[0].id,
        city: 'Delhi',
        state: 'Delhi',
        address: '123 Farm Road, Delhi'
      }
    });

    const buyer1 = await prisma.user.create({
      data: {
        email: 'buyer1@example.com',
        phone: '+91-9876543211',
        password: hashedPassword,
        name: 'Amit Singh',
        role: 'BUYER',
        city: 'Mumbai',
        state: 'Maharashtra',
        address: '456 Market Street, Mumbai'
      }
    });

    console.log(`✅ Created test users`);

    // Create wallets for users
    await prisma.wallet.createMany({
      data: [
        { userId: farmer1.id, balance: 10000 },
        { userId: buyer1.id, balance: 50000 }
      ]
    });

    // Create sample produces
    const produces = await Promise.all([
      prisma.produce.create({
        data: {
          title: 'Organic Tomatoes',
          description: 'Fresh organic tomatoes grown without pesticides',
          category: 'VEGETABLES',
          variety: 'Cherry Tomatoes',
          quantity: 500,
          unit: 'kg',
          basePrice: 15000,
          grade: 'Grade A',
          harvestDate: new Date(),
          shelfLife: 15,
          storageTemp: '10-15°C',
          certification: 'Organic Certified',
          farmerId: farmer1.id,
          apmcId: apmcs[0].id,
          pickupLocation: 'Delhi APMC, Azadpur',
          auctionStartTime: new Date(Date.now() + 60000), // 1 minute from now
          auctionEndTime: new Date(Date.now() + 3600000), // 1 hour from now
          status: 'UPCOMING',
          images: [
            'https://images.unsplash.com/photo-1546470427-e3e3c8b8e8e8',
            'https://images.unsplash.com/photo-1518977676601-b53f82aba655'
          ]
        }
      }),
      prisma.produce.create({
        data: {
          title: 'Premium Basmati Rice',
          description: 'Long grain basmati rice, aromatic and aged',
          category: 'GRAINS',
          variety: '1121 Basmati',
          quantity: 1000,
          unit: 'kg',
          basePrice: 45000,
          grade: 'Premium',
          harvestDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          shelfLife: 365,
          storageTemp: 'Room temperature',
          certification: 'Export Quality',
          farmerId: farmer1.id,
          apmcId: apmcs[0].id,
          pickupLocation: 'Delhi APMC, Azadpur',
          auctionStartTime: new Date(Date.now() + 120000), // 2 minutes from now
          auctionEndTime: new Date(Date.now() + 7200000), // 2 hours from now
          status: 'UPCOMING'
        }
      })
    ]);

    console.log(`✅ Created ${produces.length} sample produces`);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('Farmer: farmer1@example.com / password123');
    console.log('Buyer: buyer1@example.com / password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedDatabase;