const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function viewAllUsers() {
  console.log('📋 Fetching all users with complete details from database...\n');

  try {
    const users = await prisma.user.findMany({
      include: {
        apmc: {
          select: {
            name: true,
            location: true
          }
        },
        wallet: {
          select: {
            balance: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (users.length === 0) {
      console.log('❌ No users found in the database.');
      return;
    }

    console.log(`✅ Found ${users.length} users:\n`);
    
    // Table header
    console.log('=' .repeat(140));
    console.log('| #  | Name             | Email                    | Phone           | Password Hash                            | Role    | APMC            | Status  | Balance |');
    console.log('=' .repeat(140));

    // Display each user
    users.forEach((user, index) => {
      const num = `${index + 1}`.padEnd(2);
      const name = user.name.substring(0, 15).padEnd(15);
      const email = user.email.substring(0, 23).padEnd(23);
      const phone = user.phone ? user.phone.substring(0, 14).padEnd(14) : 'N/A'.padEnd(14);
      const passwordHash = user.password.substring(0, 38).padEnd(38);
      const role = user.role.padEnd(7);
      const apmc = user.apmc ? user.apmc.name.substring(0, 14).padEnd(14) : 'N/A'.padEnd(14);
      const status = (user.isActive ? 'Active' : 'Inactive').padEnd(7);
      const balance = user.wallet ? `₹${user.wallet.balance}`.padEnd(8) : 'N/A'.padEnd(8);

      console.log(`| ${num} | ${name} | ${email} | ${phone} | ${passwordHash} | ${role} | ${apmc} | ${status} | ${balance} |`);
    });

    console.log('=' .repeat(140));

    // Detailed view for each user
    console.log('\n📋 DETAILED USER INFORMATION:\n');
    
    users.forEach((user, index) => {
      console.log(`━━━ USER ${index + 1} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`👤 Name:           ${user.name}`);
      console.log(`📧 Email:          ${user.email}`);
      console.log(`📱 Phone:          ${user.phone || 'Not provided'}`);
      console.log(`� Password Hash:  ${user.password}`);
      console.log(`👔 Role:           ${user.role}`);
      console.log(`🏢 APMC:           ${user.apmc ? `${user.apmc.name}, ${user.apmc.location}` : 'Not assigned'}`);
      console.log(`📍 Address:        ${user.address || 'Not provided'}`);
      console.log(`✅ Status:         ${user.isActive ? 'Active' : 'Inactive'}`);
      console.log(`💰 Wallet Balance: ${user.wallet ? `₹${user.wallet.balance}` : 'No wallet'}`);
      console.log(`🆔 User ID:        ${user.id}`);
      console.log(`📅 Created:        ${user.createdAt.toLocaleString()}`);
      console.log(`🔄 Updated:        ${user.updatedAt.toLocaleString()}`);
      console.log('');
    });

    // Summary statistics
    console.log('📊 SUMMARY STATISTICS:');
    console.log('═'.repeat(60));
    const summary = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    console.log(`� Total Users: ${users.length}`);
    Object.entries(summary).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} users`);
    });

    const totalBalance = users.reduce((sum, user) => sum + (user.wallet ? user.wallet.balance : 0), 0);
    console.log(`💰 Total System Balance: ₹${totalBalance}`);

    console.log('\n🔐 LOGIN CREDENTIALS (for testing):');
    console.log('═'.repeat(60));
    console.log('Admin:  admin@farmerbidding.com / admin123');
    console.log('Farmer: farmer1@example.com / farmer123');  
    console.log('Buyer:  buyer1@example.com / buyer123');

  } catch (error) {
    console.error('❌ Error fetching users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
viewAllUsers();