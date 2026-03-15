const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllUsersExceptAdmin() {
  try {
    console.log('🗑️  Starting cleanup - keeping only admin account...\n');
    
    // First, let's see what we have
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
    
    console.log(`📋 Found ${allUsers.length} users in database:`);
    allUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ${user.role}`);
    });
    console.log('');

    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: {
        role: 'ADMIN'
      }
    });

    if (!adminUser) {
      console.log('❌ No admin user found! Aborting cleanup.');
      return;
    }

    console.log(`✅ Admin user found: ${adminUser.name} (${adminUser.email})`);
    console.log('🔄 Starting deletion process...\n');

    // Get all non-admin users
    const nonAdminUsers = await prisma.user.findMany({
      where: {
        role: {
          not: 'ADMIN'
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    if (nonAdminUsers.length === 0) {
      console.log('✅ No non-admin users to delete. Database already clean!');
      return;
    }

    const userIds = nonAdminUsers.map(user => user.id);

    console.log(`🗑️  Deleting ${nonAdminUsers.length} non-admin users:`);
    nonAdminUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ${user.role}`);
    });
    console.log('');

    // Delete in correct order due to foreign key constraints
    
    // 1. Delete notifications for non-admin users
    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        userId: {
          in: userIds
        }
      }
    });
    console.log(`✅ Deleted ${deletedNotifications.count} notifications`);

    // 2. Delete transactions for non-admin users
    const deletedTransactions = await prisma.transaction.deleteMany({
      where: {
        userId: {
          in: userIds
        }
      }
    });
    console.log(`✅ Deleted ${deletedTransactions.count} transactions`);

    // 3. Delete wallets for non-admin users
    const deletedWallets = await prisma.wallet.deleteMany({
      where: {
        userId: {
          in: userIds
        }
      }
    });
    console.log(`✅ Deleted ${deletedWallets.count} wallets`);

    // 4. Delete bids by non-admin users
    const deletedBids = await prisma.bid.deleteMany({
      where: {
        bidderId: {
          in: userIds
        }
      }
    });
    console.log(`✅ Deleted ${deletedBids.count} bids`);

    // 5. Delete auction sessions created by non-admin users
    const deletedSessions = await prisma.auctionSession.deleteMany({
      where: {
        createdBy: {
          in: userIds
        }
      }
    });
    console.log(`✅ Deleted ${deletedSessions.count} auction sessions`);

    // 6. Delete produce by farmers (this will also delete related auctions)
    const deletedProduce = await prisma.produce.deleteMany({
      where: {
        farmerId: {
          in: userIds
        }
      }
    });
    console.log(`✅ Deleted ${deletedProduce.count} produce listings`);

    // 7. Finally, delete the non-admin users
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: {
          not: 'ADMIN'
        }
      }
    });
    console.log(`✅ Deleted ${deletedUsers.count} users`);

    // Verify final state
    const remainingUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    console.log('\n🎉 Cleanup completed successfully!');
    console.log(`📊 Remaining users: ${remainingUsers.length}`);
    remainingUsers.forEach(user => {
      console.log(`  ✅ ${user.name} (${user.email}) - ${user.role}`);
    });

    // Show summary
    console.log('\n📈 CLEANUP SUMMARY:');
    console.log('═'.repeat(40));
    console.log(`🗑️  Users deleted: ${deletedUsers.count}`);
    console.log(`📧 Notifications deleted: ${deletedNotifications.count}`);
    console.log(`💰 Wallets deleted: ${deletedWallets.count}`);
    console.log(`🎯 Bids deleted: ${deletedBids.count}`);
    console.log(`📦 Products deleted: ${deletedProduce.count}`);
    console.log(`🔄 Transactions deleted: ${deletedTransactions.count}`);
    console.log(`⏰ Sessions deleted: ${deletedSessions.count}`);
    console.log(`👤 Remaining users: ${remainingUsers.length} (Admin only)`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
deleteAllUsersExceptAdmin();