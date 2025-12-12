import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { connectSocket, getSocket, disconnectSocket } from '../lib/socket';
import { Calendar, Clock, MapPin, Users, TrendingUp, Plus } from 'lucide-react';

const APMCBiddingSchedule = () => {
  const { user, token } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [apmcSchedules, setApmcSchedules] = useState([]);
  const [userBookings, setUserBookings] = useState([]);
  const [bookingStatus, setBookingStatus] = useState({});
  const [timers, setTimers] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Available products for filter dropdown
  const products = [
    'Wheat',
    'Rice',
    'Maize',
    'Potato',
    'Onion',
    'Tomato',
    'Cotton',
    'Sugarcane'
  ];

  // Timer effect for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const newTimers = {};
      
      apmcSchedules.forEach(session => {
        const sessionStart = new Date(session.dateTime);
        const timeUntilStart = Math.ceil((sessionStart - now) / (1000 * 60)); // minutes
        
        if (timeUntilStart > 0) {
          if (timeUntilStart > 60) {
            const hours = Math.ceil(timeUntilStart / 60);
            newTimers[session.id] = `${hours}h`;
          } else {
            newTimers[session.id] = `${timeUntilStart}m`;
          }
        } else {
          newTimers[session.id] = 'Live';
        }
      });
      
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [apmcSchedules]);

  useEffect(() => {
    fetchSessions();
    if (user) {
      fetchUserBookings();
    }

    // Connect to socket for real-time updates
    const token = localStorage.getItem('token');
    const socket = connectSocket(() => token);

    function onNotification(notification) {
      if (notification.type === 'BOOKING_APPROVED' || notification.type === 'BOOKING_REJECTED') {
        fetchUserBookings(); // Refresh booking status
      }
    }

    socket.on('notification', onNotification);

    return () => {
      if (socket) {
        socket.off('notification', onNotification);
      }
    };
  }, [selectedProduct, user]);

  const fetchSessions = async () => {
    try {
      const params = {
        // Only filter by category if explicitly chosen
        ...(selectedProduct && { category: selectedProduct }),
        // Hide already-ended sessions by fetching from now onwards
        from: new Date().toISOString()
      };
      const response = await axios.get('/api/auctions/sessions', { 
        params
      });
      
      const mapped = (response.data || [])
        // Show only upcoming or live sessions to farmers
        .filter(s => ['SCHEDULED', 'LIVE'].includes(s.status))
        .map(s => ({
        id: s.id,
        name: s.apmc?.name || 'Unknown APMC',
        location: s.apmc?.location || 'Unknown Location',
        product: s.category || 'Mixed',
        date: new Date(s.dateTime).toLocaleDateString(),
        time: new Date(s.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateTime: s.dateTime,
        status: s.status.toLowerCase(),
        duration: s.duration || 60,
        // backend returns _count.registrations; transformed as number in 'participants'
        registeredFarmers: typeof s.participants === 'number' ? s.participants : (s.participants?.length || 0),
        registeredBuyers: 0,
        lastHighestBid: '2500',
        avgPrice: '2300',
        mentor: 'APMC Officer',
        spotPrice: 50
      }));
      setApmcSchedules(mapped);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setApmcSchedules([]);
    }
  };

  const fetchUserBookings = async () => {
    try {
      const response = await axios.get('/api/auctions/farmer/booking-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserBookings(response.data.data || []);
      
      // Create a map of session ID to booking status
      const statusMap = {};
      (response.data.data || []).forEach(booking => {
        statusMap[booking.sessionId] = booking.status;
      });
      setBookingStatus(statusMap);
    } catch (error) {
      console.error('Failed to fetch booking requests:', error);
    }
  };

  const requestSpot = async (sessionId) => {
    try {
      setLoading(true);
      await axios.post('/api/auctions/request-spot', {
        sessionId,
        productName: selectedProduct || 'Mixed Produce',
        quantity: 100,
        grade: 'A'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Spot requested successfully!');
      fetchUserBookings(); // Refresh booking status
    } catch (error) {
      console.error('Failed to request spot:', error);
      alert('Failed to request spot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSessionButtonConfig = (session) => {
    const now = new Date();
    const sessionStart = new Date(session.dateTime);
    const sessionEnd = new Date(sessionStart.getTime() + (session.duration * 60 * 1000));
    const userBooking = bookingStatus[session.id];

    if (userBooking === 'PENDING') {
      return { text: 'Requested', color: 'bg-yellow-500', disabled: true };
    } else if (userBooking === 'APPROVED') {
      if (now < sessionStart) {
        const timerText = timers[session.id] || 'Calculating...';
        return { text: `You can join after ${timerText}`, color: 'bg-blue-500', disabled: true };
      } else if (now >= sessionStart && now <= sessionEnd) {
        return { text: 'Join Now', color: 'bg-green-500', disabled: false, action: 'join' };
      } else {
        return { text: 'Session Ended', color: 'bg-gray-500', disabled: true };
      }
    } else if (userBooking === 'REJECTED') {
      return { text: 'Request Rejected', color: 'bg-red-500', disabled: true };
    } else {
      // No booking yet
      if (session.status === 'scheduled') {
        return { text: 'Request Spot', color: 'bg-green-600', disabled: false, action: 'request' };
      } else {
        return { text: 'Session Unavailable', color: 'bg-gray-500', disabled: true };
      }
    }
  };

  const handleSessionAction = (session, action) => {
    if (action === 'request') {
      requestSpot(session.id);
    } else if (action === 'join') {
      // Navigate to live bidding session
      window.open(`/session/${session.id}`, '_blank');
    }
  };

  const handleViewBidHistory = (apmcId) => {
    window.open(`/bid-history/${apmcId}`, '_blank');
  };

  const filteredSchedules = selectedProduct 
    ? apmcSchedules.filter(schedule => schedule.product.toLowerCase() === selectedProduct.toLowerCase())
    : apmcSchedules;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            🏛️ APMC Bidding Schedule
          </h1>
          <p className="text-gray-600 mt-2">
            Book your spot for today's bidding sessions across different APMCs
          </p>
        </div>

        {/* Product Filter */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Select Product:</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Products</option>
              {products.map(product => (
                <option key={product} value={product}>{product}</option>
              ))}
            </select>
            <div className="ml-auto text-sm text-gray-500">
              {user?.role === 'FARMER' ? '🌾 Farmer View' : '🛒 Buyer View'}
            </div>
          </div>
        </div>

        {/* APMC Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSchedules.map(schedule => {
            const buttonConfig = getSessionButtonConfig(schedule);
            
            return (
              <div key={schedule.id} className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold">{schedule.name}</h3>
                      <div className="flex items-center mt-2 text-green-100">
                        <MapPin size={16} className="mr-1" />
                        <span className="text-sm">{schedule.location}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{schedule.product}</div>
                      <div className="text-sm text-green-100">Bidding</div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Schedule Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center text-gray-600">
                      <Calendar size={16} className="mr-2 text-blue-500" />
                      <span className="text-sm">{schedule.date}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Clock size={16} className="mr-2 text-orange-500" />
                      <span className="text-sm">{schedule.time}</span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-gray-900">{schedule.registeredFarmers}</div>
                      <div className="text-xs text-gray-600">Farmers</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-gray-900">{schedule.registeredBuyers}</div>
                      <div className="text-xs text-gray-600">Buyers</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">₹{schedule.spotPrice}</div>
                      <div className="text-xs text-gray-600">Spot Fee</div>
                    </div>
                  </div>

                  {/* Price Info */}
                  <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm text-gray-600">Last Highest Bid</div>
                        <div className="text-xl font-bold text-green-600">₹{schedule.lastHighestBid}/qtl</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Avg Price (7 days)</div>
                        <div className="text-xl font-bold text-blue-600">₹{schedule.avgPrice}/qtl</div>
                      </div>
                    </div>
                  </div>

                  {/* Mentor Info */}
                  <div className="flex items-center mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3">
                      M
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">APMC Mentor</div>
                      <div className="text-sm text-gray-600">{schedule.mentor}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleSessionAction(schedule, buttonConfig.action)}
                        disabled={buttonConfig.disabled || loading}
                        className={`flex-1 text-white px-4 py-2 rounded-lg font-medium transition-colors ${buttonConfig.color} ${
                          buttonConfig.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                        }`}
                      >
                        {buttonConfig.text}
                      </button>
                      <button
                        onClick={() => handleViewBidHistory(schedule.id)}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        📊 Bid History
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New APMC Registration */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow border-2 border-dashed border-gray-300">
          <div className="text-center">
            <Plus size={24} className="mx-auto text-gray-400 mb-2" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Don't see your preferred APMC?
            </h3>
            <p className="text-gray-600 mb-4">
              Register with a new APMC to access more bidding sessions
            </p>
            <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              🏛️ Register with New APMC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APMCBiddingSchedule;