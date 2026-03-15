const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config/projectResources');

class AuthService {
  // Generate JWT token
  generateToken(userId) {
    return jwt.sign(
      { userId },
      config.app.jwt.secret,
      { expiresIn: config.app.jwt.expiresIn }
    );
  }

  // Register new user
  async register(userData) {
    const { email, phone, password, name, role, apmcId } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone }
        ]
      }
    });

    if (existingUser) {
      throw new Error('User with this email or phone already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        name,
        role,
        apmcId: apmcId || null
      },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    // Create wallet for the user
    await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: role === 'BUYER' ? 10000 : 0 // Give buyers some initial balance
      }
    });

    // Generate token
    const token = this.generateToken(user.id);

    return { user, token };
  }

  // Login user
  async login(email, password) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        apmc: true,
        wallet: true
      }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken(user.id);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  // Get user profile
  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        apmc: true,
        wallet: true,
        _count: {
          select: {
            produce: true,
            bids: true,
            buyerOrders: true,
            farmerOrders: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Update user profile
  async updateProfile(userId, updateData) {
    const { email, phone, ...otherData } = updateData;

    // Check if email/phone already exists for other users
    if (email || phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                email ? { email } : {},
                phone ? { phone } : {}
              ].filter(Boolean)
            }
          ]
        }
      });

      if (existingUser) {
        throw new Error('Email or phone already exists');
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...otherData,
        ...(email && { email }),
        ...(phone && { phone })
      },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        profileImage: true,
        address: true,
        updatedAt: true
      }
    });

    return updatedUser;
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    return true;
  }
}

module.exports = new AuthService();