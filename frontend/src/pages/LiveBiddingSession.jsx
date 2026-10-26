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
  ChevronLeft,
  Timer,
  Package,
  Image as ImageIcon,
  ArrowRight,
  LogOut,
  Eye,
  Award,
  XCircle,
  Maximize2,
  X,
  MapPin,
  Calendar,
  ShieldCheck,
  Thermometer,
  Sparkles,
  Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const TURN_DURATION_SECONDS = 300; // 5 minutes

// Robust helper to extract image URLs regardless of format (array, JSON, double-stringified, single URL)
const extractImages = (rawImages) => {
  if (!rawImages) return [];
  if (Array.isArray(rawImages)) {
    return rawImages.map(img => (typeof img === 'string' ? img : img?.url || '')).filter(Boolean);
  }
  if (typeof rawImages === 'string') {
    try {
      let parsed = JSON.parse(rawImages);
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (Array.isArray(parsed)) {
        return parsed.map(img => (typeof img === 'string' ? img : img?.url || '')).filter(Boolean);
      }
      if (typeof parsed === 'string' && (parsed.startsWith('http') || parsed.startsWith('data:') || parsed.startsWith('/'))) {
        return [parsed];
      }
    } catch {
      if (rawImages.includes(',')) {
        return rawImages.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (rawImages.startsWith('http') || rawImages.startsWith('data:') || rawImages.startsWith('/')) {
        return [rawImages];
      }
    }
  }
  return [];
};

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

  // Produce images & modal gallery states
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [previewQueueLot, setPreviewQueueLot] = useState(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);

  // Automatically reset image gallery index when active produce changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [activeProduce?.id]);

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
      // Clean and normalize all queue produce images
      queueData.forEach(p => {
        p.images = extractImages(p.images);
      });
      setQueue(queueData);
      setTotalTurns(data.totalTurns || queueData.length);
      setCurrentTurnIndex(data.currentTurnIndex || 0);

      const active = data.activeProduce;
      if (active) {
        active.images = extractImages(active.images);
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
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TURN BANNER & TIMER                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeProduce && isSessionLive && (
        <div 
          className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-950 text-white shadow-inner border-y border-emerald-500/30"
          style={{ background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #0f172a 100%)', color: '#ffffff' }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div 
                  className="rounded-xl px-3.5 py-2 border shadow-sm text-center"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', borderColor: 'rgba(255, 255, 255, 0.25)' }}
                >
                  <span className="text-[10px] uppercase font-extrabold tracking-wider block text-emerald-300" style={{ color: '#6ee7b7' }}>Turn</span>
                  <span className="text-base font-black text-white" style={{ color: '#ffffff' }}>{currentTurnIndex} <span className="font-medium text-xs text-white/70" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>/ {totalTurns}</span></span>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300" style={{ color: '#6ee7b7' }}>Currently Bidding On</div>
                  <div className="text-xl md:text-2xl font-black text-white flex items-center gap-2 drop-shadow-sm" style={{ color: '#ffffff' }}>
                    🌾 <span>{activeProduce.farmer?.name}'s</span> <span className="underline decoration-2 underline-offset-4 text-emerald-300" style={{ color: '#6ee7b7' }}>{activeProduce.title}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Ultra High-Contrast Timer Box */}
                <div 
                  className={`flex items-center gap-3 rounded-2xl px-5 py-2.5 border-2 shadow-2xl transition-all ${
                    timeRemainingMs <= 30000
                      ? 'border-red-500 bg-red-950 animate-pulse ring-4 ring-red-500/30'
                      : timeRemainingMs <= 60000
                      ? 'border-amber-400 bg-amber-950 ring-2 ring-amber-400/20'
                      : 'border-emerald-400 bg-slate-950'
                  }`}
                  style={{
                    backgroundColor: timeRemainingMs <= 30000 ? '#450a0a' : timeRemainingMs <= 60000 ? '#451a03' : '#020617',
                    borderColor: timeRemainingMs <= 30000 ? '#ef4444' : timeRemainingMs <= 60000 ? '#f59e0b' : '#34d399',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <div 
                    className="p-2 rounded-xl"
                    style={{
                      backgroundColor: timeRemainingMs <= 30000 ? 'rgba(239, 68, 68, 0.2)' : timeRemainingMs <= 60000 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                      color: timeRemainingMs <= 30000 ? '#f87171' : timeRemainingMs <= 60000 ? '#fbbf24' : '#6ee7b7'
                    }}
                  >
                    <Timer className={`h-6 w-6 ${timeRemainingMs <= 30000 ? 'animate-bounce' : ''}`} />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-300" style={{ color: '#d1d5db' }}>
                      Time Remaining
                    </div>
                    <div 
                      className="text-3xl font-mono font-black tracking-wider drop-shadow-md"
                      style={{
                        color: timeRemainingMs <= 30000 ? '#f87171' : timeRemainingMs <= 60000 ? '#fbbf24' : '#6ee7b7'
                      }}
                    >
                      {formatTimer(timeRemainingMs)}
                    </div>
                  </div>
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
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {queue.map((item, idx) => {
                const isActive = activeProduce?.id === item.id;
                const isCompleted = item.status === 'COMPLETED';
                const isUpcoming = item.status === 'UPCOMING';
                const isMe = item.farmerId === user?.id;

                return (
                  <React.Fragment key={item.id}>
                    {idx > 0 && (
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewQueueLot(item);
                        setPreviewImageIndex(0);
                      }}
                      title={`Click to preview ${item.farmer?.name || 'Farmer'}'s ${item.title || 'produce'} details & photos`}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold flex-shrink-0 whitespace-nowrap border transition-all cursor-pointer hover:scale-105 ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300'
                          : isCompleted
                          ? 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                          : 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                      } ${isMe ? 'ring-2 ring-amber-400' : ''}`}
                    >
                      {isCompleted && <CheckCircle className="h-3.5 w-3.5 text-gray-500" />}
                      {isActive && <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span></span>}
                      {isUpcoming && <Clock className="h-3.5 w-3.5 text-blue-600" />}
                      <span className={isActive ? 'text-white font-black' : isCompleted ? 'text-gray-700' : 'text-blue-900 font-semibold'}>
                        {item.farmer?.name || `Farmer ${idx + 1}`}: {item.title || item.category || `Lot #${idx + 1}`}
                        {isMe && ' (You)'}
                      </span>
                      {item.images && item.images.length > 0 && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-blue-100 text-blue-700'
                        }`} title={`${item.images.length} photo(s) available`}>
                          <ImageIcon size={10} />
                          <span>{item.images.length}</span>
                        </span>
                      )}
                      {isCompleted && item.winningBid && (
                        <span className="text-emerald-700 font-bold ml-1 bg-emerald-50 px-1.5 py-0.5 rounded">Sold ₹{item.winningBid.amount}</span>
                      )}
                      {isCompleted && !item.winningBid && (
                        <span className="text-gray-500 ml-1">Unsold</span>
                      )}
                      {isActive && <span className="bg-white/25 text-white px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider ml-1">LIVE</span>}
                    </button>
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

            {/* ACTIVE PRODUCE CARD WITH FULL PHOTOS & FARMER DETAILS */}
            {activeProduce && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Produce Photo Showcase */}
                {activeProduce.images && activeProduce.images.length > 0 ? (
                  <div className="bg-slate-950 relative flex flex-col">
                    {/* Main Image Stage */}
                    <div className="relative h-72 sm:h-84 md:h-96 w-full flex items-center justify-center p-2 overflow-hidden group select-none">
                      <img
                        src={activeProduce.images[activeImageIndex]}
                        alt={activeProduce.title}
                        className="max-h-full max-w-full object-contain mx-auto rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';
                        }}
                      />

                      {/* Navigation Arrows (if multiple photos) */}
                      {activeProduce.images.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : activeProduce.images.length - 1))}
                            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2.5 rounded-full shadow-lg transition backdrop-blur-sm focus:outline-none"
                            title="Previous Photo"
                          >
                            <ChevronLeft size={22} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveImageIndex((prev) => (prev < activeProduce.images.length - 1 ? prev + 1 : 0))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2.5 rounded-full shadow-lg transition backdrop-blur-sm focus:outline-none"
                            title="Next Photo"
                          >
                            <ChevronRight size={22} />
                          </button>
                        </>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full shadow-md text-white flex items-center gap-1.5 ${
                          isSessionLive ? 'bg-emerald-600 animate-pulse' : 'bg-blue-600'
                        }`}>
                          <span className="w-2 h-2 rounded-full bg-white"></span>
                          {isSessionLive ? `LIVE — Turn ${currentTurnIndex}` : 'LOT PREVIEW'}
                        </span>
                        <span className="bg-black/60 backdrop-blur-sm text-white/90 text-xs px-2.5 py-1 rounded-full font-medium">
                          {activeProduce.category}
                        </span>
                      </div>

                      {/* Fullscreen Zoom Button */}
                      <button
                        type="button"
                        onClick={() => setIsImageModalOpen(true)}
                        className="absolute top-3 right-3 bg-black/60 hover:bg-black/90 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm shadow-md transition"
                        title="Click to Zoom & View High-Res"
                      >
                        <Maximize2 size={14} />
                        <span>Zoom Photo</span>
                      </button>

                      {/* Photo Index Counter */}
                      <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1">
                        <ImageIcon size={12} />
                        <span>{activeImageIndex + 1} / {activeProduce.images.length}</span>
                      </div>
                    </div>

                    {/* Thumbnail Strip (if multiple photos) */}
                    {activeProduce.images.length > 1 && (
                      <div className="flex gap-2.5 px-4 py-2.5 bg-slate-900 border-t border-slate-800 overflow-x-auto">
                        {activeProduce.images.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveImageIndex(idx)}
                            className={`relative rounded-lg overflow-hidden flex-shrink-0 w-16 h-14 border-2 transition-all cursor-pointer ${
                              idx === activeImageIndex
                                ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-105 shadow-md'
                                : 'border-transparent opacity-60 hover:opacity-100 hover:scale-100'
                            }`}
                          >
                            <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fallback banner when no images uploaded */
                  <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-green-100 p-8 text-center border-b border-gray-200">
                    <div className="w-16 h-16 bg-white/80 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-emerald-200">
                      <Package className="h-8 w-8 text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full inline-block mb-2">
                      {activeProduce.category}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900">{activeProduce.title}</h3>
                    <p className="text-xs text-gray-600 max-w-sm mx-auto mt-1">
                      No photos were attached by the farmer for this lot. Certified produce specifications are detailed below.
                    </p>
                  </div>
                )}

                {/* Produce Details & Specifications */}
                <div className="p-6 space-y-6">
                  {/* Header info */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-2xl font-black text-gray-900">{activeProduce.title}</h2>
                        {activeProduce.grade && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles size={12} className="text-amber-600" />
                            Grade {activeProduce.grade}
                          </span>
                        )}
                        {activeProduce.variety && (
                          <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            Variety: {activeProduce.variety}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-1.5">
                        <span>Registered by:</span>
                        <span className="font-bold text-gray-900">{activeProduce.farmer?.name}</span>
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1">
                          <ShieldCheck size={13} />
                          Verified Farmer
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200 uppercase tracking-wide">
                        {activeProduce.category}
                      </span>
                    </div>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3.5 text-center border border-gray-200">
                      <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Lot Quantity</div>
                      <div className="text-lg font-black text-gray-900 mt-0.5">{activeProduce.quantity} {activeProduce.unit || 'kg'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3.5 text-center border border-gray-200">
                      <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Quality Grade</div>
                      <div className="text-lg font-black text-amber-700 mt-0.5">{activeProduce.grade || 'Standard'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3.5 text-center border border-gray-200">
                      <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Base Price</div>
                      <div className="text-lg font-black text-gray-900 mt-0.5">₹{activeProduce.basePrice?.toLocaleString()}</div>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3.5 text-center border-2 border-emerald-300 shadow-sm">
                      <div className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">Current High Bid</div>
                      <div className="text-xl font-black text-emerald-700 mt-0.5">₹{currentBid.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Registered Crop Specifications Grid */}
                  <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-200">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-600 mb-3 flex items-center gap-1.5">
                      <Info size={14} className="text-blue-600" />
                      Farmer Registration Specifications
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {activeProduce.variety && (
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className="text-gray-500 block">Variety:</span>
                          <span className="font-bold text-gray-900 text-sm">{activeProduce.variety}</span>
                        </div>
                      )}
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Calendar size={12} className="text-gray-400" /> Harvest Date:
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          {activeProduce.harvestDate ? new Date(activeProduce.harvestDate).toLocaleDateString() : 'Fresh Harvest'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Clock size={12} className="text-gray-400" /> Shelf Life:
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          {activeProduce.shelfLife ? `${activeProduce.shelfLife} Days` : 'Standard Shelf Life'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Thermometer size={12} className="text-gray-400" /> Storage Temp:
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          {activeProduce.storageTemp || 'Room Temperature'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="text-gray-500 flex items-center gap-1">
                          <ShieldCheck size={12} className="text-gray-400" /> Certification:
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          {activeProduce.certification || 'Verified APMC Standard'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="text-gray-500 flex items-center gap-1">
                          <MapPin size={12} className="text-gray-400" /> Pickup Location:
                        </span>
                        <span className="font-bold text-gray-900 text-sm truncate block" title={activeProduce.pickupLocation || session?.apmc?.location}>
                          {activeProduce.pickupLocation || session?.apmc?.location || 'Mandi Yard'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description & Crop Notes */}
                  {activeProduce.description && (
                    <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-1.5 flex items-center gap-1">
                        🌾 Farmer's Crop Description & Notes
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {activeProduce.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── ROLE-BASED ACTION PANELS ──────────────────────── */}
            
            {/* BUYER BIDDING PANEL */}
            {user?.role === 'BUYER' && activeProduce && isSessionLive && timeRemainingMs > 0 && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-blue-600" />
                    Place Your Bid
                  </h3>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold border ${
                    timeRemainingMs <= 30000 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' :
                    timeRemainingMs <= 60000 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-slate-100 text-slate-800 border-slate-200'
                  }`}>
                    <Timer size={14} className={timeRemainingMs <= 30000 ? 'animate-spin' : ''} />
                    <span>{formatTimer(timeRemainingMs)} left</span>
                  </div>
                </div>
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FULLSCREEN PHOTO LIGHTBOX MODAL                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isImageModalOpen && activeProduce?.images && activeProduce.images.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          {/* Top Bar */}
          <div className="w-full max-w-5xl flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div>
              <h3 className="font-bold text-lg">{activeProduce.title}</h3>
              <p className="text-xs text-gray-400">Photo {activeImageIndex + 1} of {activeProduce.images.length} • Registered by {activeProduce.farmer?.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsImageModalOpen(false)}
              className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition"
            >
              <X size={22} />
            </button>
          </div>

          {/* Image Stage */}
          <div className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-4 overflow-hidden">
            <img
              src={activeProduce.images[activeImageIndex]}
              alt={activeProduce.title}
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
            />

            {/* Lightbox Nav Arrows */}
            {activeProduce.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : activeProduce.images.length - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full transition shadow-xl"
                  title="Previous"
                >
                  <ChevronLeft size={28} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((prev) => (prev < activeProduce.images.length - 1 ? prev + 1 : 0))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full transition shadow-xl"
                  title="Next"
                >
                  <ChevronRight size={28} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails in Lightbox */}
          {activeProduce.images.length > 1 && (
            <div className="flex gap-2 max-w-5xl overflow-x-auto py-2">
              {activeProduce.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition flex-shrink-0 ${
                    idx === activeImageIndex ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-105' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* QUEUE LOT PRODUCE & PHOTOS PREVIEW MODAL                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {previewQueueLot && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200 flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{previewQueueLot.title}</h3>
                  <p className="text-xs text-gray-500">
                    Registered by <span className="font-semibold text-gray-700">{previewQueueLot.farmer?.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQueueLot(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Photo Showcase of Previewed Lot */}
              {previewQueueLot.images && previewQueueLot.images.length > 0 ? (
                <div className="bg-slate-950 rounded-xl overflow-hidden relative">
                  <div className="h-64 sm:h-72 w-full flex items-center justify-center p-2">
                    <img
                      src={previewQueueLot.images[previewImageIndex]}
                      alt={previewQueueLot.title}
                      className="max-h-full max-w-full object-contain mx-auto rounded-lg"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';
                      }}
                    />

                    {previewQueueLot.images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewImageIndex((prev) => (prev > 0 ? prev - 1 : previewQueueLot.images.length - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full shadow transition"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewImageIndex((prev) => (prev < previewQueueLot.images.length - 1 ? prev + 1 : 0))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full shadow transition"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </>
                    )}

                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded font-mono">
                      {previewImageIndex + 1} / {previewQueueLot.images.length} Photos
                    </div>
                  </div>

                  {previewQueueLot.images.length > 1 && (
                    <div className="flex gap-2 p-2 bg-slate-900 overflow-x-auto border-t border-slate-800">
                      {previewQueueLot.images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewImageIndex(idx)}
                          className={`w-14 h-11 rounded-md overflow-hidden border-2 transition flex-shrink-0 ${
                            idx === previewImageIndex ? 'border-emerald-400' : 'border-transparent opacity-60'
                          }`}
                        >
                          <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-100 rounded-xl p-6 text-center">
                  <Package className="h-10 w-10 text-gray-400 mx-auto mb-1.5" />
                  <p className="text-xs text-gray-600 font-medium">No photos uploaded for this lot</p>
                </div>
              )}

              {/* Status & Key Badges */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  previewQueueLot.status === 'LIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                  previewQueueLot.status === 'COMPLETED' ? 'bg-gray-100 text-gray-700' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  Status: {previewQueueLot.status}
                </span>
                <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                  Category: {previewQueueLot.category}
                </span>
                {previewQueueLot.grade && (
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    Grade {previewQueueLot.grade}
                  </span>
                )}
                {previewQueueLot.variety && (
                  <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                    Variety: {previewQueueLot.variety}
                  </span>
                )}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center">
                  <div className="text-[11px] text-gray-500 font-bold uppercase">Lot Quantity</div>
                  <div className="text-base font-black text-gray-900 mt-0.5">{previewQueueLot.quantity} {previewQueueLot.unit || 'kg'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center">
                  <div className="text-[11px] text-gray-500 font-bold uppercase">Base Price</div>
                  <div className="text-base font-black text-gray-900 mt-0.5">₹{previewQueueLot.basePrice?.toLocaleString()}</div>
                </div>
                {previewQueueLot.winningBid ? (
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-center col-span-2 sm:col-span-1">
                    <div className="text-[11px] text-emerald-700 font-bold uppercase">Sold Price</div>
                    <div className="text-base font-black text-emerald-700 mt-0.5">₹{previewQueueLot.winningBid.amount?.toLocaleString()}</div>
                  </div>
                ) : (
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 text-center col-span-2 sm:col-span-1">
                    <div className="text-[11px] text-blue-700 font-bold uppercase">Current / High Bid</div>
                    <div className="text-base font-black text-blue-700 mt-0.5">₹{(previewQueueLot.currentBid || previewQueueLot.basePrice)?.toLocaleString()}</div>
                  </div>
                )}
              </div>

              {/* Specifications Grid */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-xs">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                  <Info size={13} className="text-blue-600" />
                  Produce Specifications
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-white p-2 rounded border border-gray-200 flex items-center gap-1.5">
                    <MapPin size={13} className="text-gray-400" />
                    <span>Location: <strong className="text-gray-800">{previewQueueLot.pickupLocation || session?.apmc?.location || 'APMC Mandi'}</strong></span>
                  </div>
                  {previewQueueLot.harvestDate && (
                    <div className="bg-white p-2 rounded border border-gray-200 flex items-center gap-1.5">
                      <Calendar size={13} className="text-gray-400" />
                      <span>Harvest: <strong className="text-gray-800">{new Date(previewQueueLot.harvestDate).toLocaleDateString()}</strong></span>
                    </div>
                  )}
                  {previewQueueLot.shelfLife && (
                    <div className="bg-white p-2 rounded border border-gray-200 flex items-center gap-1.5">
                      <Clock size={13} className="text-gray-400" />
                      <span>Shelf Life: <strong className="text-gray-800">{previewQueueLot.shelfLife} Days</strong></span>
                    </div>
                  )}
                  {previewQueueLot.certification && (
                    <div className="bg-white p-2 rounded border border-gray-200 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-gray-400" />
                      <span>Certified: <strong className="text-gray-800">{previewQueueLot.certification}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Farmer description */}
              {previewQueueLot.description && (
                <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-100">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    🌾 Farmer's Notes
                  </h4>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                    {previewQueueLot.description}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewQueueLot(null)}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-semibold transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

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
