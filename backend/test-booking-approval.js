const axios = require('axios');

async function testBookingApproval() {
  console.log('🧪 Testing Booking Request Approval/Rejection\n');

  const BACKEND_URL = 'http://localhost:5001';
  const BOOKING_REQUEST_ID = 'cmgdk6b7p00078ce74jvqwd8m'; // From the database

  // First, login as admin to get a token
  console.log('1️⃣ Logging in as admin...');
  let adminToken;
  try {
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'admin@farmerbidding.com',
      password: 'admin123'
    });
    
    adminToken = loginResponse.data.token;
    console.log('   ✅ Admin login successful');
  } catch (error) {
    console.log('   ❌ Admin login failed:', error.message);
    return;
  }

  // Test approval
  console.log('\n2️⃣ Testing APPROVAL...');
  try {
    const approvalResponse = await axios.patch(
      `${BACKEND_URL}/api/auctions/booking-requests/${BOOKING_REQUEST_ID}`,
      { status: 'APPROVED' },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('   ✅ Approval successful');
    console.log('   📄 Response:', approvalResponse.data);
  } catch (error) {
    console.log('   ❌ Approval failed');
    console.log('   📄 Status:', error.response?.status);
    console.log('   📄 Message:', error.response?.data?.message);
    console.log('   📄 Full error:', error.response?.data);
  }

  // Reset to PENDING for rejection test
  console.log('\n3️⃣ Resetting to PENDING...');
  try {
    await axios.patch(
      `${BACKEND_URL}/api/auctions/booking-requests/${BOOKING_REQUEST_ID}`,
      { status: 'PENDING' },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('   ✅ Reset successful');
  } catch (error) {
    console.log('   ⚠️ Reset failed, continuing anyway...');
  }

  // Test rejection
  console.log('\n4️⃣ Testing REJECTION...');
  try {
    const rejectionResponse = await axios.patch(
      `${BACKEND_URL}/api/auctions/booking-requests/${BOOKING_REQUEST_ID}`,
      { status: 'REJECTED' },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('   ✅ Rejection successful');
    console.log('   📄 Response:', rejectionResponse.data);
  } catch (error) {
    console.log('   ❌ Rejection failed');
    console.log('   📄 Status:', error.response?.status);
    console.log('   📄 Message:', error.response?.data?.message);
    console.log('   📄 Full error:', error.response?.data);
  }

  // Final reset to PENDING for UI testing
  console.log('\n5️⃣ Resetting to PENDING for UI testing...');
  try {
    await axios.patch(
      `${BACKEND_URL}/api/auctions/booking-requests/${BOOKING_REQUEST_ID}`,
      { status: 'PENDING' },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('   ✅ Final reset successful - ready for UI testing');
  } catch (error) {
    console.log('   ❌ Final reset failed');
  }

  console.log('\n🎉 Test completed!');
  console.log('💡 Now try using the approve/reject buttons in the UI');
}

testBookingApproval().catch(console.error);