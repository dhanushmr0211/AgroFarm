const axios = require('axios');

async function testNotificationsAPI() {
  console.log('🧪 Testing Notifications API for Farmer\n');

  const BACKEND_URL = 'http://localhost:5001';

  // First, login as the farmer (dhanush) to get their token
  console.log('1️⃣ Logging in as farmer...');
  let farmerToken;
  try {
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'dhanushmr0211@gmail.com',
      password: 'farmer123' // This might be the wrong password
    });
    
    farmerToken = loginResponse.data.token;
    console.log('   ✅ Farmer login successful');
  } catch (error) {
    console.log('   ❌ Farmer login failed:', error.response?.data?.message || error.message);
    console.log('   🔍 Trying different password...');
    
    // Try with a different password since this user was created via registration
    try {
      const loginResponse2 = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email: 'dhanushmr0211@gmail.com',
        password: 'dhanush123' // Common password pattern
      });
      
      farmerToken = loginResponse2.data.token;
      console.log('   ✅ Farmer login successful with alternate password');
    } catch (error2) {
      console.log('   ❌ Both login attempts failed');
      console.log('   💡 The farmer user might need to be recreated or password reset');
      return;
    }
  }

  // Test notifications API
  console.log('\n2️⃣ Fetching farmer notifications...');
  try {
    const notificationsResponse = await axios.get(`${BACKEND_URL}/api/notifications`, {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      }
    });

    const notifications = notificationsResponse.data.data;
    console.log(`   ✅ Found ${notifications.items ? notifications.items.length : notifications.length} notifications`);
    
    if (notifications.items) {
      // Paginated response
      notifications.items.forEach((notif, index) => {
        console.log(`   ${index + 1}. ${notif.title} - ${notif.isRead ? 'Read' : 'Unread'}`);
        console.log(`      ${notif.body}`);
      });
    } else if (Array.isArray(notifications)) {
      // Array response
      notifications.forEach((notif, index) => {
        console.log(`   ${index + 1}. ${notif.title} - ${notif.isRead ? 'Read' : 'Unread'}`);
        console.log(`      ${notif.body}`);
      });
    }
    
  } catch (error) {
    console.log('   ❌ Failed to fetch notifications:', error.response?.data?.message || error.message);
  }

  // Test booking requests for farmer
  console.log('\n3️⃣ Checking farmer\'s booking requests...');
  try {
    const bookingResponse = await axios.get(`${BACKEND_URL}/api/auctions/booking-requests`, {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      }
    });

    console.log('   ✅ Booking requests fetched');
    console.log('   📄 Response:', bookingResponse.data);
    
  } catch (error) {
    console.log('   ❌ Failed to fetch booking requests:', error.response?.data?.message || error.message);
  }

  console.log('\n🎉 Test completed!');
}

testNotificationsAPI().catch(console.error);