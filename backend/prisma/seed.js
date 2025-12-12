const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  try {
    // Create APMCs
    const apmcs = await Promise.all([
      prisma.aPMC.create({
        data: {
          name: 'Delhi APMC',
          location: 'Delhi',
          state: 'Delhi',
          pincode: '110001',
          contactEmail: 'admin@delhiapmc.gov.in',
          contactPhone: '+91-11-23456789'
        }
      }),
      prisma.aPMC.create({
        data: {
          name: 'Mumbai APMC',
          location: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          contactEmail: 'admin@mumbaipmc.gov.in',
          contactPhone: '+91-22-23456789'
        }
      }),
      prisma.aPMC.create({
        data: {
          name: 'Bangalore APMC',
          location: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
          contactEmail: 'admin@bangaloreapmc.gov.in',
          contactPhone: '+91-80-23456789'
        }
      })
    ]);

    console.log('APMCs created:', apmcs.length);

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@farmerbidding.com',
        password: adminPassword,
        name: 'System Admin',
        phone: '+91-9999999999',
        role: 'ADMIN',
        address: 'Admin Office, Delhi'
      }
    });

    // Create wallet for admin
    await prisma.wallet.create({
      data: {
        userId: admin.id,
        balance: 0
      }
    });

    console.log('Admin user created');

    // Create sample farmers
    const farmerPassword = await bcrypt.hash('farmer123', 10);
    const farmers = await Promise.all([
      prisma.user.create({
        data: {
          email: 'farmer1@example.com',
          password: farmerPassword,
          name: 'Rajesh Kumar',
          phone: '+91-9876543210',
          role: 'FARMER',
          address: 'Village Rampur, Delhi',
          apmcId: apmcs[0].id
        }
      }),
      prisma.user.create({
        data: {
          email: 'farmer2@example.com',
          password: farmerPassword,
          name: 'Suresh Patel',
          phone: '+91-9876543211',
          role: 'FARMER',
          address: 'Village Kandivali, Mumbai',
          apmcId: apmcs[1].id
        }
      }),
      prisma.user.create({
        data: {
          email: 'farmer3@example.com',
          password: farmerPassword,
          name: 'Mahesh Gowda',
          phone: '+91-9876543212',
          role: 'FARMER',
          address: 'Village Whitefield, Bangalore',
          apmcId: apmcs[2].id
        }
      })
    ]);

    // Create wallets for farmers
    await Promise.all(farmers.map(farmer => 
      prisma.wallet.create({
        data: {
          userId: farmer.id,
          balance: 0
        }
      })
    ));

    console.log('Farmers created:', farmers.length);

    // Create sample buyers
    const buyerPassword = await bcrypt.hash('buyer123', 10);
    const buyers = await Promise.all([
      prisma.user.create({
        data: {
          email: 'buyer1@example.com',
          password: buyerPassword,
          name: 'Amit Sharma',
          phone: '+91-8765432109',
          role: 'BUYER',
          address: 'Connaught Place, Delhi',
          apmcId: apmcs[0].id
        }
      }),
      prisma.user.create({
        data: {
          email: 'buyer2@example.com',
          password: buyerPassword,
          name: 'Priya Singh',
          phone: '+91-8765432108',
          role: 'BUYER',
          address: 'Andheri East, Mumbai',
          apmcId: apmcs[1].id
        }
      }),
      prisma.user.create({
        data: {
          email: 'buyer3@example.com',
          password: buyerPassword,
          name: 'Rahul Reddy',
          phone: '+91-8765432107',
          role: 'BUYER',
          address: 'Koramangala, Bangalore',
          apmcId: apmcs[2].id
        }
      })
    ]);

    // Create wallets for buyers with some balance
    await Promise.all(buyers.map(buyer => 
      prisma.wallet.create({
        data: {
          userId: buyer.id,
          balance: 10000 // Starting balance for testing
        }
      })
    ));

    console.log('Buyers created:', buyers.length);

    // Create sample produce/auctions
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const inThreeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const inFourHours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const produces = await Promise.all([
      prisma.produce.create({
        data: {
          title: 'Fresh Organic Tomatoes',
          description: 'Premium quality organic tomatoes, freshly harvested',
          category: 'VEGETABLES',
          variety: 'Roma',
          quantity: 500,
          unit: 'kg',
          basePrice: 25,
          currentBid: 28,
          grade: 'A',
          harvestDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          shelfLife: 7,
          storageTemp: '4-8°C',
          certification: 'Organic Certified',
          images: '["https://images.unsplash.com/photo-1592924357228-91a4daadcfea"]',
          farmerId: farmers[0].id,
          apmcId: apmcs[0].id,
          pickupLocation: 'Farm Gate, Village Rampur',
          auctionStartTime: now,
          auctionEndTime: inTwoHours,
          status: 'LIVE'
        }
      }),
      prisma.produce.create({
        data: {
          title: 'Premium Basmati Rice',
          description: 'Aged basmati rice with excellent aroma and taste',
          category: 'GRAINS',
          variety: 'Pusa Basmati 1121',
          quantity: 1000,
          unit: 'kg',
          basePrice: 80,
          grade: 'PREMIUM',
          harvestDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          shelfLife: 365,
          storageTemp: 'Room Temperature',
          certification: 'ISO 22000',
          images: '["https://images.unsplash.com/photo-1586201375761-83865001e31c"]',
          farmerId: farmers[1].id,
          apmcId: apmcs[1].id,
          pickupLocation: 'Warehouse, Kandivali',
          auctionStartTime: inOneHour,
          auctionEndTime: inThreeHours,
          status: 'UPCOMING'
        }
      }),
      prisma.produce.create({
        data: {
          title: 'Fresh Mangoes',
          description: 'Sweet and juicy Alphonso mangoes',
          category: 'FRUITS',
          variety: 'Alphonso',
          quantity: 200,
          unit: 'kg',
          basePrice: 150,
          currentBid: 165,
          grade: 'A',
          harvestDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          shelfLife: 5,
          storageTemp: '12-15°C',
          certification: 'GI Tagged',
          images: '["https://images.unsplash.com/photo-1553279765-969c4394f30c"]',
          farmerId: farmers[2].id,
          apmcId: apmcs[2].id,
          pickupLocation: 'Cold Storage, Whitefield',
          auctionStartTime: now,
          auctionEndTime: inFourHours,
          status: 'LIVE'
        }
      })
    ]);

    console.log('Produce created:', produces.length);

    // Create sample bids
    const bids = await Promise.all([
      // Bids for tomatoes
      prisma.bid.create({
        data: {
          amount: 26,
          quantity: 500,
          bidderId: buyers[0].id,
          produceId: produces[0].id,
          status: 'OUTBID'
        }
      }),
      prisma.bid.create({
        data: {
          amount: 28,
          quantity: 500,
          bidderId: buyers[1].id,
          produceId: produces[0].id,
          status: 'ACTIVE'
        }
      }),
      // Bids for mangoes
      prisma.bid.create({
        data: {
          amount: 155,
          quantity: 200,
          bidderId: buyers[2].id,
          produceId: produces[2].id,
          status: 'OUTBID'
        }
      }),
      prisma.bid.create({
        data: {
          amount: 165,
          quantity: 200,
          bidderId: buyers[0].id,
          produceId: produces[2].id,
          status: 'ACTIVE'
        }
      })
    ]);

    // Update winning bids for produce
    await prisma.produce.update({
      where: { id: produces[0].id },
      data: { winningBidId: bids[1].id }
    });

    await prisma.produce.update({
      where: { id: produces[2].id },
      data: { winningBidId: bids[3].id }
    });

    console.log('Bids created:', bids.length);

    // Create sample notifications
    await Promise.all([
      prisma.notification.create({
        data: {
          userId: buyers[0].id,
          title: 'Bid Placed Successfully',
          body: 'Your bid of ₹26/kg for Fresh Organic Tomatoes has been placed',
          type: 'BID_UPDATE'
        }
      }),
      prisma.notification.create({
        data: {
          userId: buyers[1].id,
          title: 'You are winning!',
          body: 'Your bid of ₹28/kg for Fresh Organic Tomatoes is currently the highest',
          type: 'BID_UPDATE'
        }
      }),
      prisma.notification.create({
        data: {
          userId: farmers[0].id,
          title: 'New Bid Received',
          body: 'New bid of ₹28/kg received for your Fresh Organic Tomatoes',
          type: 'BID_UPDATE'
        }
      })
    ]);

    console.log('Sample notifications created');

    console.log('Database seeded successfully!');
    console.log('\nTest Accounts:');
    console.log('Admin: admin@farmerbidding.com / admin123');
    console.log('Farmers:');
    console.log('  farmer1@example.com / farmer123 (Rajesh Kumar)');
    console.log('  farmer2@example.com / farmer123 (Suresh Patel)');
    console.log('  farmer3@example.com / farmer123 (Mahesh Gowda)');
    console.log('Buyers:');
    console.log('  buyer1@example.com / buyer123 (Amit Sharma)');
    console.log('  buyer2@example.com / buyer123 (Priya Singh)');
    console.log('  buyer3@example.com / buyer123 (Rahul Reddy)');

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });