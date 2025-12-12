const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetFarmerPassword() {
  console.log('🔐 Resetting farmer password...\n');

  try {
    // Hash the new password
    const newPassword = 'farmer123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the farmer's password
    const updatedUser = await prisma.user.update({
      where: { email: 'dhanushmr0211@gmail.com' },
      data: { password: hashedPassword },
      select: { id: true, email: true, name: true, role: true }
    });

    console.log('✅ Password updated successfully!');
    console.log(`   User: ${updatedUser.name} (${updatedUser.email})`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   New Password: ${newPassword}`);

  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetFarmerPassword();