import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  CheckCircle,
  ChevronRight,
  Timer,
  Package,
  Image as ImageIcon,
  ArrowRight,
  LogOut,
  Eye,
  Award,
  XCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const TURN_DURATION_SECONDS = 300; // 5 minutes

const LiveBidding = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();

  // Core state
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Queue state
  const [queue, setQueue] = useState([]);
  const [activeProduce, setActiveProduce] = useState(null);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [totalTurns, setTotalTurns] = useState(0);
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);

  // Bidding state
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);
  const [currentBid, setCurrentBid] = useState(0);

  // Participants & chat
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Announcements
  const [announcements, setAnnouncements] = useState([]);

  // Active produce image gallery
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Refs
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const chatEndRef = useRef(null);
  const timeoutCalledRef = useRef(false);

  // ─── Fetch queue data ───────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      const response = await api.get(`/auctions/sessions/${sessionId}/queue`);
      const data = response.data || response;

      if (data.session) setSession(data.session);

      const queueData = data.queue || [];
      setQueue(queueData);
      setTotalTurns(data.totalTurns || queueData.length);
      setCurrentTurnIndex(data.currentTurnIndex || 0);

      const active = data.activeProduce;
      if (active) {
        // Parse images
        if (typeof active.images === 'string') {
          try { active.images = JSON.parse(active.images); } catch { active.images = []; }
        }
        if (!active.images) active.images = [];
        setActiveProduce(active);
        const highestBid = active.bids?.[0]?.amount || active.currentBid || active.basePrice || 0;
        setCurrentBid(highestBid);
        setBidHistory(active.bids || []);

        // Calculate time remaining
        if (active.auctionEndTime) {
          const remaining = Math.max(0, new Date(active.auctionEndTime) - new Date());
          setTimeRemainingMs(remaining);
          timeoutCalledRef.current = remaining <= 0;
        }
      } else {
        setActiveProduce(null);
        setTimeRemainingMs(0);
        setCurrentBid(0);
        setBidHistory([]);
      }

      // Also parse images for queue items
      queueData.forEach(p => {
        if (typeof p.images === 'string') {
          try { p.images = JSON.parse(p.images); } catch { p.images = []; }
        }
        if (!p.images) p.images = [];
      });

    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // ─── Fetch participants ────────────────────────────────────
  const fetchParticipants = useCallback(async () => {
    try {
      const response = await api.get(`/auctions/sessions/${sessionId}/participants`);
      setParticipants(response || []);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  }, [sessionId]);

  // ─── Fetch chat history ────────────────────────────────────
  const fetchChatHistory = useCallback(async () => {
    try {
      const response = await api.get(`/auctions/sessions/${sessionId}/chat`);
      if (response.success && response.data) {
        setChatMessages(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    }
  }, [sessionId]);

  // ─── Timer countdown ──────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (timeRemainingMs > 0 && activeProduce) {
      timerRef.current = setInterval(() => {
        setTimeRemainingMs(prev => {
          const next = prev - 1000;
          if (next <= 0) {
            clearInterval(timerRef.current);
            // Auto-trigger timeout if this is the active farmer or any buyer
            if (!timeoutCalledRef.current) {
              timeoutCalledRef.current = true;
              handleTimeout();
            }
            return 0;
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeProduce?.id, timeRemainingMs > 0]);

  // ─── Polling for queue updates ─────────────────────────────
  useEffect(() => {
    fetchQueue();
    fetchParticipants();
    fetchChatHistory();

    pollRef.current = setInterval(() => {
      fetchQueue();
      fetchParticipants();
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, fetchQueue, fetchParticipants, fetchChatHistory]);

  // ─── Socket setup ──────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    const sock = connectSocket(() => token);

    sock.on('connect', () => {
      console.log('Connected to socket server');
      sock.emit('join_session', { sessionId });
    });

    sock.on('session_joined', (data) => {
      console.log('Joined session room:', data);
    });

    sock.on('new_message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    sock.on('turn_changed', () => {
      fetchQueue();
      timeoutCalledRef.current = false;
    });

    sock.on('turn_accepted', () => {
      fetchQueue();
      timeoutCalledRef.current = false;
    });

    sock.on('turn_timeout', () => {
      fetchQueue();
      timeoutCalledRef.current = false;
    });

    sock.on('session_completed', () => {
      fetchQueue();
    });

    sock.on('new_bid', (data) => {
      fetchQueue(); // Refresh to get latest bid data
    });

    setSocket(sock);

    // Enter session
    api.post(`/auctions/sessions/${sessionId}/enter`).catch(console.error);

    return () => {
      sock.disconnect();
      api.post(`/auctions/sessions/${sessionId}/exit`).catch(console.error);
    };
  }, [sessionId]);

  // ─── Auto-scroll chat ─────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ─── Actions ───────────────────────────────────────────────
  const submitBid = async () => {
    const amt = parseFloat(bidAmount);
    if (!amt || amt <= currentBid) {
      toast.error(`Bid must be higher than ₹${currentBid}`);
      return;
    }

    try {
      setBidding(true);
      await api.post(`/auctions/sessions/${sessionId}/bid`, {
        amount: amt,
        quantity: 1
      });
      toast.success('Bid placed successfully!');
      setBidAmount('');
      fetchQueue();
    } catch (error) {
      console.error('Failed to submit bid:', error);
      toast.error(error.response?.data?.message || 'Failed to submit bid');
    } finally {
      setBidding(false);
    }
  };

  const handleAcceptBid = async () => {
    if (!window.confirm(`Accept the highest bid of ₹${currentBid} and exit the auction?`)) return;

    try {
      const response = await api.post(`/auctions/sessions/${sessionId}/accept-turn`);
      const msg = response.message || 'Bid accepted!';
      toast.success(msg);
      setAnnouncements(prev => [...prev, { type: 'accept', message: msg, time: new Date() }]);
      fetchQueue();
    } catch (error) {
      console.error('Failed to accept turn:', error);
      toast.error(error.response?.data?.message || 'Failed to accept bid');
    }
  };

  const handlePassTurn = async () => {
    if (!window.confirm('Pass your turn without selling? Your produce will not be sold.')) return;

    try {
      const response = await api.post(`/auctions/sessions/${sessionId}/timeout-turn`);
      const msg = response.message || 'Turn passed.';
      toast.success(msg);
      setAnnouncements(prev => [...prev, { type: 'pass', message: msg, time: new Date() }]);
      fetchQueue();
    } catch (error) {
      console.error('Failed to pass turn:', error);
      toast.error(error.response?.data?.message || 'Failed to pass turn');
    }
  };

  const handleTimeout = async () => {
    try {
      const response = await api.post(`/auctions/sessions/${sessionId}/timeout-turn`);
      const msg = response.message || 'Turn timed out.';
      setAnnouncements(prev => [...prev, { type: 'timeout', message: `⏰ ${msg}`, time: new Date() }]);
      toast(msg, { icon: '⏰' });
      fetchQueue();
    } catch (error) {
      console.error('Timeout turn error:', error);
    }
  };

  const handleExit = async () => {
    if (window.confirm('Are you sure you want to exit the auction?')) {
      try {
        await api.post(`/auctions/sessions/${sessionId}/exit`);
        window.location.href = user?.role === 'FARMER' ? '/farmer/dashboard' : '/buyer/dashboard';
      } catch (error) {
        console.error('Exit error:', error);
      }
    }
  };

  const sendChatMessage = () => {
    if (socket && chatInput.trim()) {
      socket.emit('send_message', { sessionId, message: chatInput.trim() });
      setChatInput('');
    }
  };

  // ─── Helpers ───────────────────────────────────────────────
  const formatTimer = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeRemainingMs <= 30000) return 'text-red-600'; // last 30s
    if (timeRemainingMs <= 60000) return 'text-orange-500'; // last 1min
    return 'text-emerald-600';
  };

  const isMyTurn = activeProduce?.farmerId === user?.id;
  const amIFarmerInQueue = queue.some(p => p.farmerId === user?.id);
  const myQueueItem = queue.find(p => p.farmerId === user?.id);
  const myQueuePosition = myQueueItem ? queue.findIndex(p => p.id === myQueueItem.id) + 1 : -1;
  const isSessionCompleted = session?.status === 'COMPLETED';
  const isSessionLive = session?.status === 'LIVE';

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading auction session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Session not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HEADER BAR                                                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                {session.apmc?.name || 'Auction'} — Live Session
              </h1>
              <p className="text-xs text-gray-500">{session.apmc?.location}</p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-center">
                <Users className="h-4 w-4 text-blue-600 mx-auto" />
                <div className="text-xs font-medium text-gray-700">{participants.length}</div>
              </div>
              <div className="text-center">
                <TrendingUp className="h-4 w-4 text-purple-600 mx-auto" />
                <div className="text-xs font-medium text-gray-700">{bidHistory.length} bids</div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                isSessionLive ? 'bg-green-100 text-green-700 animate-pulse' :
                isSessionCompleted ? 'bg-gray-100 text-gray-600' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {session.status}
              </span>
              <button
                onClick={handleExit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition text-sm font-medium"
              >
                <LogOut className="h-4 w-4" />
                Exit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TURN BANNER & TIMER                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeProduce && isSessionLive && (
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <span className="text-sm font-bold">Turn {currentTurnIndex} / {totalTurns}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-green-100">Currently Bidding On</div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    🌾 {activeProduce.farmer?.name}'s {activeProduce.title}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`text-center bg-white/10 backdrop-blur-sm rounded-xl px-5 py-2 ${
                  timeRemainingMs <= 30000 ? 'animate-pulse ring-2 ring-red-400' : ''
                }`}>
                  <Timer className="h-5 w-5 mx-auto mb-0.5" />
                  <div className={`text-2xl font-mono font-bold ${timeRemainingMs <= 30000 ? 'text-red-200' : ''}`}>
                    {formatTimer(timeRemainingMs)}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-green-200">Remaining</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* QUEUE TRACKER PILLS                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {queue.length > 0 && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {queue.map((item, idx) => {
                const isActive = activeProduce?.id === item.id;
                const isCompleted = item.status === 'COMPLETED';
                const isUpcoming = item.status === 'UPCOMING';
                const isMe = item.farmerId === user?.id;

                return (
                  <React.Fragment key={item.id}>
                    {idx > 0 && (
                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    )}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 whitespace-nowrap border transition-all ${
                      isActive
                        ? 'bg-green-100 text-green-800 border-green-300 shadow-sm ring-2 ring-green-200'
                        : isCompleted
                        ? 'bg-gray-100 text-gray-500 border-gray-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    } ${isMe ? 'ring-2 ring-yellow-400' : ''}`}>
                      {isCompleted && <CheckCircle className="h-3.5 w-3.5 text-gray-400" />}
                      {isActive && <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span></span>}
                      {isUpcoming && <Clock className="h-3.5 w-3.5" />}
                      <span>
                        {item.farmer?.name || `Farmer ${idx + 1}`}
                        {isMe && ' (You)'}
                      </span>
                      {isCompleted && item.winningBid && (
                        <span className="text-green-600 ml-1">Sold ₹{item.winningBid.amount}</span>
                      )}
                      {isCompleted && !item.winningBid && (
                        <span className="text-gray-400 ml-1">Unsold</span>
                      )}
                      {isActive && <span className="text-green-700">LIVE</span>}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ANNOUNCEMENTS                                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {announcements.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          {announcements.slice(-3).map((ann, idx) => (
            <div key={idx} className={`mb-2 p-3 rounded-lg text-sm font-medium border flex items-center gap-2 animate-fadeIn ${
              ann.type === 'accept' ? 'bg-green-50 text-green-800 border-green-200' :
              ann.type === 'timeout' ? 'bg-orange-50 text-orange-800 border-orange-200' :
              'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              {ann.type === 'accept' && '🎉'}
              {ann.type === 'timeout' && '⏰'}
              {ann.type === 'pass' && '⏭️'}
              {ann.message}
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT GRID                                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ─── LEFT: Active Produce Details + Bidding Area ──────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* ACTIVE PRODUCE CARD WITH IMAGES */}
            {activeProduce && isSessionLive && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                {/* Produce Images */}
                {activeProduce.images && activeProduce.images.length > 0 ? (
                  <div className="relative bg-gray-100">
                    <img
                      src={activeProduce.images[activeImageIndex]}
                      alt={activeProduce.title}
                      className="w-full h-64 md:h-80 object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    {activeProduce.images.length > 1 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                        {activeProduce.images.map((_, imgIdx) => (
                          <button
                            key={imgIdx}
                            onClick={() => setActiveImageIndex(imgIdx)}
                            className={`w-3 h-3 rounded-full transition-all ${
                              imgIdx === activeImageIndex
                                ? 'bg-white shadow-lg scale-110'
                                : 'bg-white/50 hover:bg-white/70'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                      🔴 LIVE — Farmer {currentTurnIndex}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 h-40 flex items-center justify-center">
                    <div className="text-center">
                      <Package className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
                      <p className="text-sm text-emerald-600 font-medium">No product images uploaded</p>
                    </div>
                  </div>
                )}

                {/* Produce Details */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{activeProduce.title}</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        by <span className="font-semibold text-gray-700">{activeProduce.farmer?.name}</span>
                      </p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                      {activeProduce.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                      <div className="text-xs text-gray-500 font-medium uppercase">Quantity</div>
                      <div className="text-base font-bold text-gray-900">{activeProduce.quantity} {activeProduce.unit || 'kg'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                      <div className="text-xs text-gray-500 font-medium uppercase">Grade</div>
                      <div className="text-base font-bold text-gray-900">{activeProduce.grade || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                      <div className="text-xs text-gray-500 font-medium uppercase">Base Price</div>
                      <div className="text-base font-bold text-gray-900">₹{activeProduce.basePrice}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                      <div className="text-xs text-green-600 font-medium uppercase">Current Bid</div>
                      <div className="text-lg font-bold text-green-700">₹{currentBid.toLocaleString()}</div>
                    </div>
                  </div>

                  {activeProduce.description && (
                    <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
                      {activeProduce.description}
                    </p>
                  )}

                  {activeProduce.variety && (
                    <div className="text-xs text-gray-500 mb-2">
                      <span className="font-semibold">Variety:</span> {activeProduce.variety}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── ROLE-BASED ACTION PANELS ──────────────────────── */}
            
            {/* BUYER BIDDING PANEL */}
            {user?.role === 'BUYER' && activeProduce && isSessionLive && timeRemainingMs > 0 && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-blue-600" />
                  Place Your Bid
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={`Min: ₹${currentBid + 1}`}
                      min={currentBid + 1}
                      className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-lg font-bold"
                    />
                  </div>
                  <button
                    onClick={submitBid}
                    disabled={bidding || !bidAmount || parseFloat(bidAmount) <= currentBid}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg shadow-blue-200"
                  >
                    <Gavel className="h-5 w-5" />
                    {bidding ? 'Bidding...' : 'Place Bid'}
                  </button>
                </div>
                {/* Quick bid buttons */}
                <div className="flex gap-2 mt-3">
                  {[100, 500, 1000, 5000].map(increment => (
                    <button
                      key={increment}
                      onClick={() => setBidAmount(String(currentBid + increment))}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition"
                    >
                      +₹{increment}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ACTIVE FARMER CONTROLS */}
            {isMyTurn && isSessionLive && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-md border-2 border-green-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <h3 className="text-lg font-bold text-green-800">🌾 Your Produce is LIVE!</h3>
                </div>
                <p className="text-sm text-green-700 mb-5">
                  Buyers are bidding on your {activeProduce?.title}. You can accept the highest bid or wait for better offers.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAcceptBid}
                    disabled={currentBid <= 0 || !bidHistory.length}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Award className="h-5 w-5" />
                    {bidHistory.length > 0
                      ? `Accept Highest Bid (₹${currentBid.toLocaleString()}) & Exit`
                      : 'Waiting for Bids...'}
                  </button>
                  <button
                    onClick={handlePassTurn}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition font-medium"
                  >
                    <XCircle className="h-5 w-5" />
                    Pass / Exit Without Selling
                  </button>
                </div>
              </div>
            )}

            {/* WAITING FARMER INFO */}
            {user?.role === 'FARMER' && amIFarmerInQueue && !isMyTurn && myQueueItem?.status === 'UPCOMING' && isSessionLive && (
              <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-blue-900">You are #{myQueuePosition} in queue</h3>
                    <p className="text-sm text-blue-700">
                      It's currently {activeProduce?.farmer?.name}'s turn. Your turn will begin after the current farmer finishes or their 5-minute timer expires.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-100 px-3 py-2 rounded-lg">
                  <Eye className="h-4 w-4" />
                  You can watch the bids and chat while waiting.
                </div>
              </div>
            )}

            {/* COMPLETED FARMER INFO */}
            {user?.role === 'FARMER' && amIFarmerInQueue && myQueueItem?.status === 'COMPLETED' && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-gray-400" />
                  <div>
                    <h3 className="text-base font-bold text-gray-700">Your lot has finished</h3>
                    <p className="text-sm text-gray-500">
                      {myQueueItem.winningBid
                        ? `Sold for ₹${myQueueItem.winningBid.amount} to ${myQueueItem.winningBid.bidder?.name}`
                        : 'Your produce was not sold in this session.'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">You can continue watching the session.</p>
                  </div>
                </div>
              </div>
            )}

            {/* SESSION NOT STARTED / SESSION COMPLETED */}
            {!isSessionLive && !isSessionCompleted && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Not Started</h3>
                <p className="text-gray-600">This bidding session will start at the scheduled time.</p>
              </div>
            )}

            {isSessionCompleted && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Completed 🎉</h3>
                <p className="text-gray-600 mb-4">All farmer lots in this session have concluded.</p>
                {queue.length > 0 && (
                  <div className="max-w-md mx-auto text-left space-y-2">
                    {queue.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-500">#{idx + 1}</span>
                          <span className="font-medium text-gray-800">{item.farmer?.name}: {item.title}</span>
                        </div>
                        {item.winningBid ? (
                          <span className="text-green-600 font-bold">₹{item.winningBid.amount} ✓</span>
                        ) : (
                          <span className="text-gray-400 text-xs">Unsold</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── RIGHT SIDEBAR ────────────────────────────────── */}
          <div className="space-y-6">
            
            {/* Bid History */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Recent Bids
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bidHistory.length > 0 ? (
                  bidHistory.map((bid, index) => (
                    <div key={bid.id || index} className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 ? 'bg-green-50 border border-green-100' : 'bg-gray-50'
                    }`}>
                      <div>
                        <div className="font-bold text-gray-900">₹{bid.amount?.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">{bid.bidder?.name || 'Anonymous'}</div>
                      </div>
                      <div className="text-right">
                        {index === 0 && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">HIGHEST</span>
                        )}
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(bid.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <Gavel className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No bids yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Participants */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Participants ({participants.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      p.role === 'FARMER' ? 'bg-green-600' : 'bg-blue-600'
                    }`}>
                      {p.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">
                        {p.name} {p.id === user?.id && <span className="text-xs text-gray-400">(You)</span>}
                      </div>
                      <div className="text-xs text-gray-500">{p.role === 'FARMER' ? '🌾 Farmer' : '🛒 Buyer'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Chat */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 flex flex-col h-80">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  💬 Live Chat
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`text-sm ${
                    msg.type === 'ANNOUNCEMENT' || msg.type === 'SYSTEM'
                      ? 'text-center'
                      : ''
                  }`}>
                    {msg.type === 'ANNOUNCEMENT' || msg.type === 'SYSTEM' ? (
                      <div className="bg-yellow-50 text-yellow-800 px-3 py-1.5 rounded-lg text-xs font-medium border border-yellow-100 inline-block">
                        📢 {msg.message}
                      </div>
                    ) : (
                      <div className={`p-2.5 rounded-xl ${
                        msg.userId === user?.id
                          ? 'bg-blue-100 ml-8'
                          : 'bg-gray-100 mr-8'
                      }`}>
                        <div className="font-bold text-[10px] mb-0.5 text-gray-500">
                          {msg.user?.name || 'User'}
                        </div>
                        <div className="text-gray-800">{msg.message}</div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t border-gray-100 flex">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border rounded-l-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && chatInput.trim() && sendChatMessage()}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LiveBidding;
