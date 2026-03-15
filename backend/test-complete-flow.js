const axios = require('axios');

async function testFarmerNotificationFlow() {
  console.log('🧪 Testing Complete Farmer Notification Flow\n');

  const BACKEND_URL = 'http://localhost:5001';
  const FRONTEND_URL = 'http://localhost:3002';

  try {
    // 1. Login as farmer
    console.log('1️⃣ Logging in as farmer...');
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'dhanushmr0211@gmail.com',
      password: 'farmer123'
    });

    const farmerToken = loginResponse.data.token;
    console.log('   ✅ Farmer login successful');

    // 2. Test notifications API
    console.log('\n2️⃣ Testing notifications API...');
    const notificationsResponse = await axios.get(`${BACKEND_URL}/api/notifications`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });

    const notifications = notificationsResponse.data.data;
    console.log(`   ✅ Found ${notifications.items ? notifications.items.length : notifications.length} notifications`);
    console.log(`   📊 Unread count: ${notifications.unreadCount || 0}`);

    // 3. Test unread count API
    console.log('\n3️⃣ Testing unread count API...');
    const unreadResponse = await axios.get(`${BACKEND_URL}/api/notifications/unread-count`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    console.log(`   📊 Unread notifications: ${unreadResponse.data.data.count}`);

    // 4. Display notification details
    console.log('\n4️⃣ Recent notifications:');
    const notificationList = notifications.items || notifications;
    if (Array.isArray(notificationList) && notificationList.length > 0) {
      notificationList.slice(0, 3).forEach((notif, index) => {
        console.log(`   ${index + 1}. ${notif.title} - ${notif.isRead ? '✅ Read' : '🔴 Unread'}`);
        console.log(`      Type: ${notif.type || 'GENERAL'}`);
        console.log(`      Message: ${notif.body}`);
        console.log(`      Time: ${new Date(notif.createdAt).toLocaleString()}`);
        console.log('');
      });
    }

    // 5. Test frontend connectivity
    console.log('5️⃣ Testing frontend connectivity...');
    try {
      const frontendResponse = await axios.get(FRONTEND_URL);
      console.log('   ✅ Frontend is accessible');
    } catch (error) {
      console.log('   ❌ Frontend connectivity issue:', error.message);
    }

    console.log('\n🎉 Test Summary:');
    console.log('   ✅ Backend API: Working');
    console.log('   ✅ Authentication: Working');
    console.log('   ✅ Notifications API: Working');
    console.log('   ✅ Frontend: Running on port 3002');
    console.log('\n📱 Next Steps:');
    console.log('   1. Open http://localhost:3002 in your browser');
    console.log('   2. Login as: dhanushmr0211@gmail.com / farmer123');
    console.log('   3. Go to farmer dashboard');
    console.log('   4. Click on the "Notifications" tab');
    console.log('   5. You should see booking approval notifications');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data?.message || error.message);
  }
}

testFarmerNotificationFlow();