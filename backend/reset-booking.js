const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetBookingRequest() {
  try {
    console.log('🔄 Resetting booking request to PENDING status...');

    const result = await prisma.bookingRequest.update({
      where: {
        id: 'cmgdk6b7p00078ce74jvqwd8m'
      },
      data: {
        status: 'PENDING',
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: new Date()
      }
    });

    console.log('✅ Booking request reset successfully!');
    console.log('📄 Updated status:', result.status);
    console.log('💡 Ready for UI testing - approve/reject buttons should work now');

  } catch (error) {
    console.error('❌ Error resetting booking request:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetBookingRequest();