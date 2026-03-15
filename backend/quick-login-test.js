const axios = require('axios');

async function quickLoginTest() {
  console.log('🔐 Quick Login Test\n');

  const BACKEND_URL = 'http://localhost:5001';

  try {
    console.log('Testing farmer login...');
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'dhanushmr0211@gmail.com',
      password: 'farmer123'
    });

    console.log('✅ Login successful!');
    console.log(`User: ${loginResponse.data.user.name}`);
    console.log(`Role: ${loginResponse.data.user.role}`);
    console.log('✅ Login endpoint working correctly!');

  } catch (error) {
    console.log('❌ Login failed:', error.message);
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
  }
}

quickLoginTest();