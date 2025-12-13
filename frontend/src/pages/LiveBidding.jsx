import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { connectSocket, getSocket, disconnectSocket } from '../lib/socket';
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
  const intervalRef = useRef();

  useEffect(() => {
    fetchSessionDetails();

    const token = localStorage.getItem('token');
    const socket = connectSocket(() => token);

    function onConnect() {
      socket.emit('join_session', { sessionId });
    }
    function onSessionJoined(payload) {
      setSession(payload.session);
      setParticipants(payload.participants || []);
      setCurrentBid(payload.session.startingPrice || 0);
      calculateTimeRemaining(payload.session);
      setLoading(false);
    }
    function onNewMessage(payload) {
      // Handle chat messages if needed
    }
    function onUserJoined(data) {
      setParticipants(prev => [...prev, { id: data.userId, name: data.userName, role: 'BUYER' }]);
    }
    function onUserLeft(data) {
      setParticipants(prev => prev.filter(p => p.id !== data.userId));
    }

    socket.on('connect', onConnect);
    socket.on('session_joined', onSessionJoined);
    socket.on('new_message', onNewMessage);
    socket.on('user_joined_session', onUserJoined);
    socket.on('user_left_session', onUserLeft);

    return () => {
      try {
        const s = getSocket();
        if (s && s.connected) {
          s.emit('leave_session', { sessionId });
        }
      } catch { }
      if (socket) {
        socket.off('connect', onConnect);
        socket.off('session_joined', onSessionJoined);
        socket.off('new_message', onNewMessage);
        socket.off('user_joined_session', onUserJoined);
        socket.off('user_left_session', onUserLeft);
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

  const startRealTimeUpdates = () => {
    intervalRef.current = setInterval(() => {
      if (session) {
        calculateTimeRemaining(session);
      }
    }, 1000); // Only update timer, not data
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
      setMessage('Failed to submit bid. Please try again.');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Session not found</h2>
        </div>
      </div>
    );
  }

  const isActive = session.status === 'LIVE';
  const hasEnded = timeRemaining === 0 && session.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-gray-50">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveBidding;