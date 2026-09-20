import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { connectSocket, getSocket, disconnectSocket } from '../lib/socket';
import { Calendar, Clock, MapPin, Users, TrendingUp, Plus, CheckCircle, AlertCircle, Sparkles, X, Package, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ImageUpload from '../components/ImageUpload';

const APMCBiddingSchedule = () => {
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [apmcSchedules, setApmcSchedules] = useState([]);
  const [userBookings, setUserBookings] = useState([]);
  const [bookingStatus, setBookingStatus] = useState({});
  const [timers, setTimers] = useState({});
  const [loading, setLoading] = useState(false);

  // Farmer Produce & Modal States
  const [farmerProduces, setFarmerProduces] = useState([]);
  const [loadingProduces, setLoadingProduces] = useState(false);
  const [showAddProduceModal, setShowAddProduceModal] = useState(false);
  const [showSelectProduceModal, setShowSelectProduceModal] = useState(false);
  const [selectedSessionForRegistration, setSelectedSessionForRegistration] = useState(null);
  const [selectedProduceId, setSelectedProduceId] = useState('');
  const [produceFormLoading, setProduceFormLoading] = useState(false);
  const [produceFormMessage, setProduceFormMessage] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const [produceFormData, setProduceFormData] = useState({
    title: '',
    category: 'VEGETABLES',
    quantity: '',
    unit: 'kg',
    basePrice: '',
    grade: 'A',
    variety: '',
    description: '',
    location: ''
  });

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
      if (user.role === 'FARMER') {
        fetchFarmerProduces();
      }
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
        // Hide old ended sessions, but keep recent/live ones (fetch from 24h ago)
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await api.get('/auctions/sessions', { params });

      const mapped = (response || [])
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
      const response = await api.get('/auctions/my-booking-requests');
      setUserBookings(response || []);

      // Create a map of session ID to booking status
      const statusMap = {};
      (response || []).forEach(booking => {
        statusMap[booking.sessionId] = booking.status;
      });
      setBookingStatus(statusMap);
    } catch (error) {
      console.error('Failed to fetch booking requests:', error);
    }
  };

  const fetchFarmerProduces = async () => {
    try {
      setLoadingProduces(true);
      const response = await api.get('/auctions/farmer/auctions');
      const list = response.data || response || [];
      setFarmerProduces(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to fetch farmer produces:', error);
    } finally {
      setLoadingProduces(false);
    }
  };

  const handleAddProduceSubmit = async (e) => {
    e.preventDefault();
    setProduceFormLoading(true);
    setProduceFormMessage('');

    try {
      const payload = {
        title: produceFormData.title,
        category: produceFormData.category,
        quantity: parseFloat(produceFormData.quantity),
        unit: produceFormData.unit,
        basePrice: parseFloat(produceFormData.basePrice),
        grade: produceFormData.grade,
        variety: produceFormData.variety || undefined,
        description: produceFormData.description || undefined,
        pickupLocation: produceFormData.location || undefined,
        images: JSON.stringify(uploadedImages),
        auctionStartTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        auctionEndTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await api.post('/auctions', payload);
      const createdItem = response.data || response;

      toast.success(`Produce "${produceFormData.title}" listed successfully!`);
      setShowAddProduceModal(false);
      setUploadedImages([]);
      
      // Refresh produces list
      await fetchFarmerProduces();

      // Automatically select the newly created produce if registration modal was pending
      if (createdItem?.id) {
        setSelectedProduceId(createdItem.id);
      }

      // Reset form
      setProduceFormData({
        title: '',
        category: 'VEGETABLES',
        quantity: '',
        unit: 'kg',
        basePrice: '',
        grade: 'A',
        variety: '',
        description: '',
        location: ''
      });
    } catch (error) {
      console.error('Failed to list produce:', error);
      const errorMsg = error.response?.data?.message || 'Failed to list produce. Please check all fields.';
      setProduceFormMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setProduceFormLoading(false);
    }
  };

  const handleRequestSpotClick = (session) => {
    if (user?.role === 'FARMER') {
      setSelectedSessionForRegistration(session);
      // If farmer already has produce, pre-select the first one if none selected
      if (farmerProduces.length > 0) {
        setSelectedProduceId(farmerProduces[0].id);
      } else {
        setSelectedProduceId('');
      }
      setShowSelectProduceModal(true);
    } else {
      // Buyer direct request
      requestSpotDirect(session.id);
    }
  };

  const requestSpotDirect = async (sessionId) => {
    try {
      setLoading(true);
      await api.post('/auctions/request-spot', {
        sessionId,
        productName: selectedProduct || 'General Produce',
        quantity: 100
      });

      toast.success('Spot requested successfully!');
      fetchUserBookings();
    } catch (error) {
      console.error('Failed to request spot:', error);
      toast.error(error.response?.data?.message || 'Failed to request spot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSpotRegistration = async () => {
    if (!selectedSessionForRegistration) return;
    
    const chosenProduce = farmerProduces.find(p => p.id === selectedProduceId);
    if (!chosenProduce) {
      toast.error('Please select a produce to register with this auction session.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auctions/request-spot', {
        sessionId: selectedSessionForRegistration.id,
        produceId: chosenProduce.id,
        productName: chosenProduce.title,
        quantity: chosenProduce.quantity,
        grade: chosenProduce.grade || 'A'
      });

      toast.success(`Spot requested successfully with "${chosenProduce.title}"!`);
      setShowSelectProduceModal(false);
      setSelectedSessionForRegistration(null);
      fetchUserBookings();
      fetchSessions();
    } catch (error) {
      console.error('Failed to register spot with produce:', error);
      toast.error(error.response?.data?.message || 'Failed to register spot. Please try again.');
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
      if (['scheduled', 'live'].includes(session.status)) {
        return { text: 'Register Spot', color: 'bg-green-600', disabled: false, action: 'request' };
      } else {
        return { text: 'Session Unavailable', color: 'bg-gray-500', disabled: true };
      }
    }
  };

  const handleSessionAction = (session, action) => {
    if (action === 'request') {
      handleRequestSpotClick(session);
    } else if (action === 'join') {
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
        
        {/* Header with Add New Produce CTA */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span>🏛️</span> APMC Bidding Schedule
            </h1>
            <p className="text-gray-600 mt-2">
              Book your spot for today's bidding sessions across different APMCs
            </p>
          </div>

          {user?.role === 'FARMER' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddProduceModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <Plus size={20} />
                <span>Add New Produce</span>
                {farmerProduces.length > 0 && (
                  <span className="ml-1 bg-green-800 text-green-100 text-xs px-2 py-0.5 rounded-full font-medium">
                    {farmerProduces.length} listed
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Product Filter Bar */}
        <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Product:</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">All Products</option>
                {products.map(product => (
                  <option key={product} value={product}>{product}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200 self-start sm:self-auto">
              {user?.role === 'FARMER' ? '🌾 Farmer Portal View' : '🛒 Buyer Portal View'}
            </div>
          </div>
        </div>

        {/* APMC Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSchedules.map(schedule => {
            const buttonConfig = getSessionButtonConfig(schedule);

            return (
              <div key={schedule.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold">{schedule.name}</h3>
                      <div className="flex items-center mt-2 text-green-100">
                        <MapPin size={16} className="mr-1" />
                        <span className="text-sm">{schedule.location}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold tracking-wide uppercase">
                        {schedule.product}
                      </span>
                      <div className="text-xs text-green-100 mt-1">Bidding Session</div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Schedule Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <Calendar size={18} className="mr-2 text-blue-600" />
                      <span className="text-sm font-medium">{schedule.date}</span>
                    </div>
                    <div className="flex items-center text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <Clock size={18} className="mr-2 text-orange-600" />
                      <span className="text-sm font-medium">{schedule.time}</span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-lg font-bold text-gray-900">{schedule.registeredFarmers}</div>
                      <div className="text-xs text-gray-600 font-medium">Farmers</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-lg font-bold text-gray-900">{schedule.registeredBuyers}</div>
                      <div className="text-xs text-gray-600 font-medium">Buyers</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                      <div className="text-lg font-bold text-green-700">₹{schedule.spotPrice}</div>
                      <div className="text-xs text-green-700 font-medium">Spot Fee</div>
                    </div>
                  </div>

                  {/* Price Info */}
                  <div className="bg-amber-50/70 border border-amber-200/60 p-4 rounded-lg mb-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-xs text-gray-600 font-medium uppercase tracking-wider">Last Highest Bid</div>
                        <div className="text-xl font-bold text-green-700">₹{schedule.lastHighestBid}/qtl</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600 font-medium uppercase tracking-wider">Avg Price (7 days)</div>
                        <div className="text-xl font-bold text-blue-700">₹{schedule.avgPrice}/qtl</div>
                      </div>
                    </div>
                  </div>

                  {/* Mentor Info */}
                  <div className="flex items-center mb-6 p-3 bg-blue-50/60 border border-blue-100 rounded-lg">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3 shadow-sm">
                      M
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-blue-900 uppercase">APMC Officer</div>
                      <div className="text-sm font-medium text-gray-800">{schedule.mentor}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleSessionAction(schedule, buttonConfig.action)}
                        disabled={buttonConfig.disabled || loading}
                        className={`flex-1 text-white px-4 py-2.5 rounded-lg font-semibold transition-all shadow-sm ${buttonConfig.color} ${
                          buttonConfig.disabled ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-95 hover:shadow'
                        }`}
                      >
                        {buttonConfig.text}
                      </button>
                      <button
                        onClick={() => handleViewBidHistory(schedule.id)}
                        className="flex-1 bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300 px-4 py-2.5 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-1.5"
                      >
                        <span>📊</span> Bid History
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New APMC Registration Banner */}
        <div className="mt-10 bg-white p-8 rounded-xl shadow-sm border-2 border-dashed border-gray-300 text-center">
          <Plus size={28} className="mx-auto text-gray-400 mb-3" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Don't see your preferred APMC?
          </h3>
          <p className="text-gray-600 mb-5 max-w-md mx-auto text-sm">
            Register with a new APMC to expand your trading reach and access scheduled bidding sessions.
          </p>
          <button className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2.5 rounded-lg shadow transition-colors">
            🏛️ Register with New APMC
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD NEW PRODUCE MODAL (Clean, transferred UI design)                       */}
      {/* ========================================================================= */}
      {showAddProduceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 animate-fadeIn">
            <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <span>🌾</span> List Your Produce
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Enter your produce details. Once listed, you can select it to register for any auction session.
                </p>
              </div>
              <button
                onClick={() => setShowAddProduceModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddProduceSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Product Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={produceFormData.title}
                    onChange={(e) => setProduceFormData({ ...produceFormData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g. Organic Wheat, Fresh Tomatoes"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={produceFormData.category}
                    onChange={(e) => setProduceFormData({ ...produceFormData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  >
                    {['VEGETABLES', 'FRUITS', 'GRAINS', 'PULSES', 'SPICES', 'DAIRY', 'OILSEEDS', 'ORGANIC'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={produceFormData.quantity}
                      onChange={(e) => setProduceFormData({ ...produceFormData, quantity: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-l-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="e.g. 500"
                    />
                    <select
                      value={produceFormData.unit}
                      onChange={(e) => setProduceFormData({ ...produceFormData, unit: e.target.value })}
                      className="bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg px-3.5 py-2.5 text-sm text-gray-700 font-medium"
                    >
                      <option value="kg">kg</option>
                      <option value="quintal">quintal</option>
                      <option value="ton">ton</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Base Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={produceFormData.basePrice}
                    onChange={(e) => setProduceFormData({ ...produceFormData, basePrice: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Minimum starting bid amount"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Grade</label>
                  <select
                    value={produceFormData.grade}
                    onChange={(e) => setProduceFormData({ ...produceFormData, grade: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  >
                    <option value="A+">Grade A+ (Top Premium)</option>
                    <option value="A">Grade A (Premium)</option>
                    <option value="B">Grade B (Standard)</option>
                    <option value="C">Grade C (Fair)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Variety (Optional)</label>
                  <input
                    type="text"
                    value={produceFormData.variety}
                    onChange={(e) => setProduceFormData({ ...produceFormData, variety: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g. Sharbati, Desi, Hybrid"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Farm / Pickup Location (Optional)</label>
                <input
                  type="text"
                  value={produceFormData.location}
                  onChange={(e) => setProduceFormData({ ...produceFormData, location: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g. Village Rampur, Near Main Market"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={produceFormData.description}
                  onChange={(e) => setProduceFormData({ ...produceFormData, description: e.target.value })}
                  rows="3"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Additional details regarding quality, harvest timing, storage, etc..."
                ></textarea>
              </div>

              {produceFormMessage && (
                <div className={`p-3 rounded-lg text-sm font-medium ${
                  produceFormMessage.toLowerCase().includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {produceFormMessage}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddProduceModal(false)}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={produceFormLoading}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold shadow-md disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {produceFormLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Listing Produce...</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>List Produce</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SELECT PRODUCE MODAL (Opened when Farmer clicks "Register Spot")            */}
      {/* ========================================================================= */}
      {showSelectProduceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span>🌾</span> Select Produce to Register
                </h2>
                {selectedSessionForRegistration && (
                  <p className="text-sm text-gray-600 mt-1">
                    For session at <span className="font-semibold text-gray-900">{selectedSessionForRegistration.name}</span> ({selectedSessionForRegistration.product})
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowSelectProduceModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Session Summary Card */}
            {selectedSessionForRegistration && (
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-3.5 mb-5 flex items-center justify-between text-xs sm:text-sm text-emerald-900">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-emerald-700" />
                  <span>{selectedSessionForRegistration.date} at {selectedSessionForRegistration.time}</span>
                </div>
                <div className="font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md">
                  Spot Fee: ₹{selectedSessionForRegistration.spotPrice}
                </div>
              </div>
            )}

            {/* Produce Selection List */}
            {farmerProduces.length === 0 ? (
              <div className="text-center py-8 px-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl mb-6">
                <Package size={36} className="mx-auto text-gray-400 mb-3" />
                <h4 className="text-base font-bold text-gray-900 mb-1">No Produce Listed Yet</h4>
                <p className="text-sm text-gray-600 mb-4 max-w-sm mx-auto">
                  You need to add and list your produce details first before registering for an auction spot.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddProduceModal(true)}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition-colors"
                >
                  <Plus size={16} />
                  <span>Add New Produce Now</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-gray-700">
                    Choose from your listed produce:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddProduceModal(true)}
                    className="text-xs text-green-700 hover:text-green-800 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> Add Another Produce
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {farmerProduces.map((prod) => {
                    const isSelected = selectedProduceId === prod.id;
                    return (
                      <div
                        key={prod.id}
                        onClick={() => setSelectedProduceId(prod.id)}
                        className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-green-600 bg-green-50/70 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-green-600 bg-green-600 text-white' : 'border-gray-400'
                          }`}>
                            {isSelected && <CheckCircle size={14} />}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                              <span>{prod.title}</span>
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-normal">
                                {prod.category}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1 flex items-center gap-3">
                              <span>📦 {prod.quantity} {prod.unit || 'kg'}</span>
                              <span>🏷️ Grade {prod.grade || 'A'}</span>
                              <span className="font-semibold text-green-700">₹{prod.basePrice}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowSelectProduceModal(false)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSpotRegistration}
                disabled={loading || !selectedProduceId || farmerProduces.length === 0}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Registering Spot...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Spot Registration</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APMCBiddingSchedule;