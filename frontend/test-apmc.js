// Test APMC API accessibility from frontend perspective
const testAPMCAccess = () => {
  console.log('🔍 Testing APMC API Access from Frontend Perspective');

  // Test from browser console - this is what frontend sees
  const apiUrl = 'http://localhost:5001';
  
  fetch(`${apiUrl}/api/auth/apmcs`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  .then(response => {
    console.log('✅ Response status:', response.status);
    console.log('✅ Response headers:', [...response.headers.entries()]);
    return response.json();
  })
  .then(data => {
    console.log('✅ APMC Data received:', data);
    if (data.success && data.data) {
      console.log('✅ Number of APMCs:', data.data.length);
      data.data.forEach((apmc, index) => {
        console.log(`   ${index + 1}. ${apmc.name} (${apmc.location}) - ID: ${apmc.id}`);
      });
    }
  })
  .catch(error => {
    console.error('❌ APMC fetch failed:', error);
  });
};

// Test the endpoint
testAPMCAccess();