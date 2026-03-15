const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkBookingRequests() {
  console.log('🔍 Checking booking requests in database...\n');

  try {
    const requests = await prisma.bookingRequest.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        session: {
          include: {
            apmc: {
              select: {
                id: true,
                name: true,
                location: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Found ${requests.length} booking requests:\n`);

    if (requests.length === 0) {
      console.log('❌ No booking requests found.');
      console.log('💡 This might be why approve/reject buttons show errors.');
      return;
    }

    requests.forEach((request, index) => {
      console.log(`━━━ REQUEST ${index + 1} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🆔 ID: ${request.id}`);
      console.log(`👤 User: ${request.user?.name} (${request.user?.email})`);
      console.log(`👔 Role: ${request.role}`);
      console.log(`🏢 APMC: ${request.session?.apmc?.name}, ${request.session?.apmc?.location}`);
      console.log(`📅 Session ID: ${request.sessionId}`);
      console.log(`📊 Status: ${request.status}`);
      console.log(`📝 Message: ${request.message || 'No message'}`);
      console.log(`📅 Created: ${request.createdAt.toLocaleString()}`);
      console.log(`📅 Updated: ${request.updatedAt.toLocaleString()}`);
      
      if (request.reviewedBy) {
        console.log(`👨‍💼 Reviewed By: ${request.reviewedBy}`);
        console.log(`📅 Reviewed At: ${request.reviewedAt?.toLocaleString()}`);
      }
      console.log('');
    });

    console.log('📊 Status Summary:');
    const statusCounts = requests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} requests`);
    });

    // Check if we have any data structure issues
    const invalidRequests = requests.filter(req => !req.user || !req.session?.apmc);
    if (invalidRequests.length > 0) {
      console.log('\n⚠️ Found requests with missing data:');
      invalidRequests.forEach(req => {
        console.log(`   - Request ${req.id}: Missing ${!req.user ? 'user' : 'session/apmc'} data`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking booking requests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBookingRequests();