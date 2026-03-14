import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { io } from 'socket.io-client';
import {
  Clock,
  Users,
  TrendingUp,
  DollarSign,
  Gavel,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const LiveBidding = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [bidAmount, setBidAmount] = useState('');
  const [bidHistory, setBidHistory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const intervalRef = useRef();

  useEffect(() => {
    fetchSessionDetails();
    fetchBidHistory();
    fetchParticipants();
    fetchChatHistory();

    // Initialize Socket connection
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://10.60.208.200:5001', {
      auth: { token: localStorage.getItem('token') }
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      newSocket.emit('join_session', { sessionId });
    });

    newSocket.on('session_joined', (data) => {
      console.log('Joined session room:', data);
    });

    newSocket.on('new_message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    setSocket(newSocket);

    // Polling fallback
    startRealTimeUpdates();

    return () => {
      newSocket.disconnect();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      const response = await api.get(`/auctions/sessions/${sessionId}`);

      setSession(response);
      setCurrentBid(response.startingPrice || 0);
      calculateTimeRemaining(response);
    } catch (error) {
      console.error('Failed to fetch session details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBidHistory = async () => {
    try {
      const response = await api.get(`/auctions/sessions/${sessionId}/bids`);

      setBidHistory(response || []);
      if (response && response.length > 0) {
        setCurrentBid(response[0].amount);
      }
    } catch (error) {
      console.error('Failed to fetch bid history:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await api.get(`/auctions/sessions/${sessionId}/participants`);

      setParticipants(response || []);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  };

  const calculateTimeRemaining = (sessionData) => {
    const now = new Date();
    const sessionStart = new Date(sessionData.dateTime);
    const sessionEnd = new Date(sessionStart.getTime() + (sessionData.duration * 60 * 1000));

    if (now < sessionStart) {
      setTimeRemaining(Math.max(0, sessionStart - now));
    } else if (now <= sessionEnd) {
      setTimeRemaining(Math.max(0, sessionEnd - now));
    } else {
      setTimeRemaining(0);
    }
  };

  // ... inside LiveBidding component ...

  const fetchChatHistory = async () => {
    try {
      const response = await api.get(`/auctions/sessions/${sessionId}/messages`);
      if (response.success && response.data) {
        setChatMessages(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    }
  };

  const startRealTimeUpdates = () => {
    intervalRef.current = setInterval(() => {
      // Chat is handled by socket, only poll critical data
      fetchBidHistory();
      fetchParticipants();
      if (session) {
        calculateTimeRemaining(session);
      }
    }, 5000); // Reduced polling frequency
  };

  // Farmer Produce Form State
  const [showProduceForm, setShowProduceForm] = useState(false);
  const [myProduce, setMyProduce] = useState(null);
  const [produceFormData, setProduceFormData] = useState({
    title: '',
    category: 'VEGETABLES',
    quantity: '',
    unit: 'kg',
    basePrice: '',
    grade: 'A',
    variety: '',
    description: ''
  });

  useEffect(() => {
    if (user?.role === 'FARMER') {
      checkMyProduce();
    }
  }, [sessionId, user]);

  const checkMyProduce = async () => {
    try {
      const response = await api.get('/auctions/farmer/auctions');
      // Check if any produce is linked to this session
      const sessionProduce = response.data.find(p => p.sessionId === sessionId);
      if (sessionProduce) {
        setMyProduce(sessionProduce);
        setShowProduceForm(false);
      } else {
        setShowProduceForm(true);
      }
    } catch (error) {
      console.error('Failed to check farmer produce:', error);
    }
  };

  useEffect(() => {
    // Notify backend of presence
    const enterSession = async () => {
      try {
        await api.post(`/auctions/sessions/${sessionId}/enter`);
      } catch (error) {
        console.error('Failed to enter session:', error);
      }
    };

    enterSession();

    return () => {
      // Notify backend of exit on unmount
      api.post(`/auctions/sessions/${sessionId}/exit`).catch(console.error);
    };
  }, [sessionId]);

  const handleExit = async () => {
    try {
      if (window.confirm('Are you sure you want to exit the auction? The auction will end if all participants leave.')) {
        await api.post(`/auctions/sessions/${sessionId}/exit`);
        // Navigate based on role
        if (user?.role === 'FARMER') {
          window.location.href = '/farmer/dashboard';
        } else {
          window.location.href = '/buyer/dashboard';
        }
      }
    } catch (error) {
      console.error('Exit error:', error);
    }
  };

  const handleManualEnd = async () => {
    if (window.confirm('Are you sure you want to end the auction now? The current highest bid will be declared the winner.')) {
      try {
        await api.post(`/auctions/sessions/${sessionId}/end`);
        // Stay on page to see results
      } catch (error) {
        console.error('End auction error:', error);
        setMessage('Failed to end auction');
      }
    }
  };

  const handleProduceSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!session) return;

      const payload = {
        ...produceFormData,
        sessionId,
        auctionStartTime: session.dateTime,
        auctionEndTime: new Date(new Date(session.dateTime).getTime() + session.duration * 60000).toISOString()
      };

      await api.post('/auctions', payload);
      setMessage('Produce listed successfully! Buyers can now bid.');
      setShowProduceForm(false);
      checkMyProduce(); // Refresh to see the new produce
      fetchSessionDetails(); // Refresh session details
    } catch (error) {
      console.error('Failed to list produce:', error);
      setMessage(error.response?.data?.message || 'Failed to list produce');
    } finally {
      setLoading(false);
    }
  };

  const submitBid = async () => {
    if (!bidAmount || parseFloat(bidAmount) <= currentBid) {
      setMessage('Bid amount must be higher than current bid');
      return;
    }

    try {
      setBidding(true);
      await api.post(`/auctions/sessions/${sessionId}/bid`, {
        amount: parseFloat(bidAmount),
        quantity: 1
      });

      setBidAmount('');
      setMessage('Bid submitted successfully!');
      fetchBidHistory();
    } catch (error) {
      console.error('Failed to submit bid:', error);
      const errorMsg = error.response?.data?.message || 'Failed to submit bid. Please try again.';
      setMessage(errorMsg);
    } finally {
      setBidding(false);
    }
  };

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading && !showProduceForm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Session not found</h2>
        </div>
      </div>
    );
  }

  const isActive = session?.status === 'LIVE';
  const hasEnded = timeRemaining === 0 && session?.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Farmer Produce Listing Modal */}
      {showProduceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">List Your Produce</h2>
            <p className="text-gray-600 mb-6">Enter details for your produce in this auction session.</p>

            <form onSubmit={handleProduceSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    value={produceFormData.title}
                    onChange={(e) => setProduceFormData({ ...produceFormData, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Fresh Tomatoes"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={produceFormData.category}
                    onChange={(e) => setProduceFormData({ ...produceFormData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    {['VEGETABLES', 'FRUITS', 'GRAINS', 'PULSES', 'SPICES', 'DAIRY', 'OILSEEDS', 'ORGANIC'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <div className="flex">
                    <input
                      type="number"
                      required
                      value={produceFormData.quantity}
                      onChange={(e) => setProduceFormData({ ...produceFormData, quantity: e.target.value })}
                      className="w-full px-3 py-2 border rounded-l-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                    <select
                      value={produceFormData.unit}
                      onChange={(e) => setProduceFormData({ ...produceFormData, unit: e.target.value })}
                      className="bg-gray-50 border border-l-0 rounded-r-md px-3 py-2 text-gray-500"
                    >
                      <option value="kg">kg</option>
                      <option value="ton">ton</option>
                      <option value="quintal">quintal</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={produceFormData.basePrice}
                    onChange={(e) => setProduceFormData({ ...produceFormData, basePrice: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Minimum bid amount"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                  <select
                    value={produceFormData.grade}
                    onChange={(e) => setProduceFormData({ ...produceFormData, grade: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="A">Grade A (Premium)</option>
                    <option value="B">Grade B (Standard)</option>
                    <option value="C">Grade C (Fair)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Variety (Optional)</label>
                  <input
                    type="text"
                    value={produceFormData.variety}
                    onChange={(e) => setProduceFormData({ ...produceFormData, variety: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Desi, Hybrid"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={produceFormData.description}
                  onChange={(e) => setProduceFormData({ ...produceFormData, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional details about the produce..."
                ></textarea>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                {/* Only allow cancel if checking produce failed or user wants to just watch */}
                <button
                  type="button"
                  onClick={() => setShowProduceForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Skip / Watch Only
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Listing...' : 'Start Auction'}
                </button>
              </div>
              {message && (
                <div className={`mt-4 p-3 rounded-lg ${message.toLowerCase().includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {message}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{session.title}</h1>
              <p className="text-gray-600">{session.apmc?.name} - {session.apmc?.location}</p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <Clock className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-gray-900">
                  {timeRemaining > 0 ? formatTime(timeRemaining) : 'Ended'}
                </div>
                <div className="text-xs text-gray-500">Time Left</div>
              </div>
              <div className="text-center">
                <Users className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-gray-900">{participants.length}</div>
                <div className="text-xs text-gray-500">Participants</div>
              </div>
              <div className="text-center">
                <TrendingUp className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-gray-900">{bidHistory.length}</div>
                <div className="text-xs text-gray-500">Total Bids</div>
              </div>
              <button
                onClick={handleExit}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Exit Auction
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Bidding Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  ₹{currentBid.toLocaleString()}
                </div>
                <div className="text-gray-600">Current Highest Bid</div>
                {bidHistory.length > 0 && (
                  <div className="text-sm text-gray-500 mt-2">
                    by {bidHistory[0].bidder?.name || 'Anonymous'}
                  </div>
                )}
              </div>

              {isActive && timeRemaining > 0 && user?.role === 'BUYER' && (
                <div className="border-t pt-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`Minimum: ₹${currentBid + 1}`}
                        min={currentBid + 1}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={submitBid}
                      disabled={bidding || !bidAmount}
                      className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Gavel className="h-5 w-5 mr-2" />
                      {bidding ? 'Bidding...' : 'Place Bid'}
                    </button>
                  </div>
                  {message && (
                    <div className={`mt-4 p-3 rounded-lg ${message.includes('successfully') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                      {message}
                    </div>
                  )}
                </div>
              )}

              {isActive && user?.role === 'FARMER' && (
                <div className="border-t pt-6 text-center">
                  <p className="text-gray-600 mb-4">You are monitoring your live auction</p>
                  <button
                    onClick={handleManualEnd}
                    disabled={currentBid === 0}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {currentBid > 0 ? 'Accept Highest Bid & End Auction' : 'Waiting for Bids...'}
                  </button>
                </div>
              )}

              {!isActive && !hasEnded && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Not Started</h3>
                  <p className="text-gray-600">This bidding session will start at the scheduled time.</p>
                </div>
              )}

              {hasEnded && (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Ended</h3>
                  <p className="text-gray-600">This bidding session has concluded.</p>
                  {bidHistory.length > 0 && (
                    <div className="mt-4">
                      <p className="text-lg font-semibold">
                        Winning Bid: ₹{bidHistory[0].amount.toLocaleString()}
                      </p>
                      <p className="text-gray-600">
                        Winner: {bidHistory[0].bidder?.name || 'Anonymous'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Bid History */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Bids</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {bidHistory.length > 0 ? (
                  bidHistory.map((bid, index) => (
                    <div key={bid.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div>
                        <div className="font-medium text-gray-900">
                          ₹{bid.amount.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          {bid.bidder?.name || 'Anonymous'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(bid.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No bids yet
                  </div>
                )}
              </div>
            </div>

            {/* Participants */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Participants</h3>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {participant.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{participant.name}</div>
                      <div className="text-xs text-gray-500">{participant.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Chat */}
            <div className="bg-white rounded-lg shadow-md p-6 flex flex-col h-96">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Chat</h3>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`p-2 rounded-lg text-sm ${msg.userId === user?.id ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'}`}>
                    <div className="font-bold text-xs mb-1 text-gray-600">{msg.user?.name || 'User'}</div>
                    <div>{msg.message}</div>
                  </div>
                ))}
              </div>
              <div className="flex">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && !!message.trim() && socket && (
                    socket.emit('send_message', { sessionId, message }),
                    setMessage('')
                  )}
                />
                <button
                  onClick={() => {
                    if (socket && message.trim()) {
                      socket.emit('send_message', { sessionId, message });
                      setMessage('');
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveBidding;
