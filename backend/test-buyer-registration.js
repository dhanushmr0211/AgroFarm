const axios = require('axios');

async function testBuyerRegistration() {
  console.log('👥 Testing New Buyer Registration\n');

  const BACKEND_URL = 'http://localhost:5001';

  try {
    // First get available APMCs
    console.log('1️⃣ Getting available APMCs...');
    const apmcResponse = await axios.get(`${BACKEND_URL}/api/auth/apmcs`);
    console.log(`   ✅ Found ${apmcResponse.data.data.length} APMCs`);
    
    const firstApmc = apmcResponse.data.data[0];
    console.log(`   Using APMC: ${firstApmc.name} - ${firstApmc.location}`);

    // Test new buyer registration
    console.log('\n2️⃣ Registering new buyer...');
    
    const timestamp = Date.now();
    const newBuyer = {
      name: `Test Buyer ${timestamp}`,
      email: `testbuyer${timestamp}@example.com`,
      phone: `+91-8${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
      password: 'buyer123456',
      role: 'BUYER',
      apmcId: firstApmc.id,
      address: 'Test Address, Test City'
    };

    console.log(`   📝 Registering: ${newBuyer.name}`);
    console.log(`   📧 Email: ${newBuyer.email}`);
    console.log(`   📱 Phone: ${newBuyer.phone}`);
    console.log(`   🏛️ APMC: ${firstApmc.name}`);

    const registerResponse = await axios.post(`${BACKEND_URL}/api/auth/register`, newBuyer);
    
    console.log('\n   ✅ Registration successful!');
    console.log(`   👤 New user: ${registerResponse.data.user.name}`);
    console.log(`   📧 Email: ${registerResponse.data.user.email}`);
    console.log(`   🎯 Role: ${registerResponse.data.user.role}`);
    console.log(`   🔑 Token received: ${registerResponse.data.token ? 'Yes' : 'No'}`);

    // Test login with new user
    console.log('\n3️⃣ Testing login with new buyer...');
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: newBuyer.email,
      password: newBuyer.password
    });

    console.log('   ✅ New buyer login successful!');
    console.log(`   👤 Logged in as: ${loginResponse.data.user.name}`);

    console.log('\n🎉 SUCCESS: Registration and login are both working!');
    console.log('\n📱 Frontend should now work for:');
    console.log('   ✅ Farmer login: dhanushmr0211@gmail.com / farmer123');
    console.log('   ✅ Admin login: admin@farmerbidding.com / admin123');
    console.log('   ✅ New buyer registration: Working');
    console.log('   ✅ New buyer login: Working');

  } catch (error) {
    console.log('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('📋 Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testBuyerRegistration();