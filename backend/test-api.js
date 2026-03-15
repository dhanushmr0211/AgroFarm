// Test script for API endpoints
const axios = require('axios');

const API_BASE = 'http://localhost:5001';

async function testLogin() {
  console.log('\n=== Testing Login ===');
  
  try {
    const response = await axios.post(`${API_BASE}/api/auth/login`, {
      email: 'admin@farmerbidding.com',
      password: 'admin123'
    });
    
    console.log('✅ Login successful');
    console.log('User:', response.data.user.name, '- Role:', response.data.user.role);
    return response.data.token;
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testRegistration() {
  console.log('\n=== Testing Registration ===');
  
  // First, get the APMC IDs
  try {
    const apmcResponse = await axios.get(`${API_BASE}/api/auth/apmcs`);
    const apmcId = apmcResponse.data.data[0].id; // Use the first APMC's actual ID
    
    const response = await axios.post(`${API_BASE}/api/auth/register`, {
      name: 'Test User',
      email: `testuser${Date.now()}@example.com`,
      phone: `+91-9${Math.floor(Math.random() * 1000000000)}`,
      password: 'test123',
      role: 'FARMER',
      apmcId: apmcId
    });
    
    console.log('✅ Registration successful');
    console.log('User:', response.data.user.name, '- Role:', response.data.user.role);
    return response.data.token;
  } catch (error) {
    console.log('❌ Registration failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testUserStatistics(token) {
  console.log('\n=== Testing User Statistics ===');
  
  try {
    const response = await axios.get(`${API_BASE}/api/users/statistics`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ User statistics retrieved successfully');
    console.log('Total Users:', response.data.data.totalUsers);
    console.log('Active Users:', response.data.data.activeUsers);
    console.log('Farmers:', response.data.data.usersByRole.FARMER);
    console.log('Buyers:', response.data.data.usersByRole.BUYER);
    console.log('Admins:', response.data.data.usersByRole.ADMIN);
    console.log('Recent registrations (30 days):', response.data.data.recentRegistrations);
    console.log('Users by APMC:', response.data.data.usersByApmc);
  } catch (error) {
    console.log('❌ User statistics failed:', error.response?.data?.message || error.message);
  }
}

async function testAPMCs() {
  console.log('\n=== Testing APMCs ===');
  
  try {
    const response = await axios.get(`${API_BASE}/api/auth/apmcs`);
    
    console.log('✅ APMCs retrieved successfully');
    console.log('APMCs available:', response.data.data.length);
    response.data.data.forEach(apmc => {
      console.log(`  - ${apmc.name} (${apmc.location})`);
    });
  } catch (error) {
    console.log('❌ APMCs failed:', error.response?.data?.message || error.message);
  }
}

async function runTests() {
  console.log('🧪 Starting API Tests...');
  
  // Test APMCs first
  await testAPMCs();
  
  // Test login
  const adminToken = await testLogin();
  
  // Test user statistics with admin token
  if (adminToken) {
    await testUserStatistics(adminToken);
  }
  
  // Test registration
  await testRegistration();
  
  console.log('\n🏁 Tests completed!');
}

runTests().catch(console.error);