const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkNotifications() {
  console.log('🔔 Checking notifications in database...\n');

  try {
    const notifications = await prisma.notification.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Found ${notifications.length} notifications:\n`);

    if (notifications.length === 0) {
      console.log('❌ No notifications found.');
      console.log('💡 This explains why the farmer didn\'t get notified.');
      return;
    }

    notifications.forEach((notification, index) => {
      console.log(`━━━ NOTIFICATION ${index + 1} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🆔 ID: ${notification.id}`);
      console.log(`👤 User: ${notification.user?.name} (${notification.user?.email})`);
      console.log(`📄 Title: ${notification.title}`);
      console.log(`📝 Body: ${notification.body}`);
      console.log(`🏷️ Type: ${notification.type}`);
      console.log(`👁️ Read: ${notification.isRead ? 'Yes' : 'No'}`);
      console.log(`📅 Created: ${notification.createdAt.toLocaleString()}`);
      console.log('');
    });

    // Check for recent booking-related notifications
    const bookingNotifications = notifications.filter(n => 
      n.title.toLowerCase().includes('booking') || 
      n.body.toLowerCase().includes('booking') ||
      n.body.toLowerCase().includes('approved') ||
      n.body.toLowerCase().includes('rejected')
    );

    console.log(`📊 Booking-related notifications: ${bookingNotifications.length}`);

  } catch (error) {
    console.error('❌ Error checking notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNotifications();