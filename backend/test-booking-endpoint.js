const axios = require('axios');

async function testFarmerBookingEndpoint() {
  console.log('🧪 Testing Farmer Booking Requests Endpoint\n');

  const BACKEND_URL = 'http://localhost:5001';

  try {
    // 1. Login as farmer
    console.log('1️⃣ Logging in as farmer...');
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'dhanushmr0211@gmail.com',
      password: 'farmer123'
    });

    const farmerToken = loginResponse.data.token;
    console.log('   ✅ Farmer login successful');

    // 2. Test the new booking requests endpoint
    console.log('\n2️⃣ Testing farmer booking requests endpoint...');
    const bookingResponse = await axios.get(`${BACKEND_URL}/api/auctions/farmer/booking-requests`, {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      }
    });

    console.log('   ✅ Endpoint working!');
    console.log(`   📊 Found ${bookingResponse.data.data.length} booking requests`);
    
    if (bookingResponse.data.data.length > 0) {
      bookingResponse.data.data.forEach((booking, index) => {
        console.log(`\n   ${index + 1}. Booking Request:`);
        console.log(`      Status: ${booking.status}`);
        console.log(`      APMC: ${booking.apmc.name} - ${booking.apmc.location}`);
        console.log(`      Created: ${new Date(booking.createdAt).toLocaleString()}`);
        if (booking.reviewedBy) {
          console.log(`      Reviewed by: ${booking.reviewedBy.name}`);
        }
      });
    }

    console.log('\n🎉 SUCCESS: Farmer booking endpoint is working correctly!');
    console.log('📱 Frontend should now be able to fetch booking requests.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   URL:', error.config?.url);
    }
  }
}

testFarmerBookingEndpoint();