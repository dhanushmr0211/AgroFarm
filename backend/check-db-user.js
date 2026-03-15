
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
    try {
        console.log('Checking for user: dhanushmr0211@gmail.com');
        const user = await prisma.user.findUnique({
            where: { email: 'dhanushmr0211@gmail.com' }
        });

        if (user) {
            console.log('✅ User found:', user);
            console.log('Role:', user.role);
            console.log('ID:', user.id);
        } else {
            console.log('❌ User NOT found. The database might have been reset.');
        }
    } catch (error) {
        console.error('❌ Database error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
