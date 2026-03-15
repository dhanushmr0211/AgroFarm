
const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "farmer-bidding-super-secret-key-2024";
const USER_ID = "cmgdk2mo200018ce7hfpwnjp7"; // From previous step
const BASE_URL = "http://localhost:5001/api";

async function reproduce() {
    try {
        // 1. Generate Token
        const token = jwt.sign({ userId: USER_ID }, JWT_SECRET, { expiresIn: '7d' });
        console.log('generated token (truncated):', token.substring(0, 20) + '...');

        const headers = { Authorization: `Bearer ${token}` };

        // 2. Test GET /auctions/farmer/auctions
        console.log('\nTesting GET /auctions/farmer/auctions...');
        try {
            const res = await axios.get(`${BASE_URL}/auctions/farmer/auctions`, { headers });
            console.log('✅ GET Success:', res.status);
        } catch (err) {
            console.log('❌ GET Failed:', err.response ? err.response.status : err.message);
            if (err.response && err.response.data) console.log('Data:', err.response.data);
        }

        // 3. Test POST /auctions (Create Produce)
        console.log('\nTesting POST /auctions...');
        const produceData = {
            title: 'Debug Tomatoes',
            description: 'Test produce',
            category: 'VEGETABLES',
            quantity: 100,
            basePrice: 50,
            auctionStartTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            auctionEndTime: new Date(Date.now() + 7200000).toISOString(),   // 2 hours from now
            unit: 'kg'
            // Missing 'images' but it has default in route
        };

        try {
            const res = await axios.post(`${BASE_URL}/auctions`, produceData, { headers });
            console.log('✅ POST Success:', res.status);
        } catch (err) {
            console.log('❌ POST Failed:', err.response ? err.response.status : err.message);
            if (err.response && err.response.data) console.log('Data:', err.response.data);
        }

    } catch (err) {
        console.error('Script Error:', err);
    }
}

reproduce();
