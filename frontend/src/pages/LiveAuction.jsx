import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { connectSocket, getSocket, disconnectSocket } from '../lib/socket';

const LiveAuction = () => {
  const { id } = useParams();
  const [auction, setAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [isConnected, setIsConnected] = useState(true);

  // Fetch real auction data + connect socket
  useEffect(() => {
    fetchAuctionData();

    const token = localStorage.getItem('token');
    const socket = connectSocket(() => token);

    function onConnect() {
      setIsConnected(true);
      socket.emit('join_auction', { produceId: id });
    }
    function onDisconnect() {
      setIsConnected(false);
    }
    function onAuctionJoined(payload) {
      // payload: { produce, currentBid, participantCount, recentBids }
      setAuction(prev => prev ? { ...prev, currentBid: payload.currentBid?.amount || prev.currentBid, participants: payload.participantCount } : prev);
    }
    function onNewBid(payload) {
      // payload: { bid, currentBid, bidderId, bidderName, timestamp }
      setAuction(prev => prev ? { ...prev, currentBid: payload.currentBid, biddingHistory: [{ amount: payload.currentBid, bidder: payload.bidderName, time: new Date(payload.timestamp).toLocaleTimeString() }, ...(prev.biddingHistory || [])].slice(0, 20) } : prev);
    }
    function onUserJoined(data) {
      setAuction(prev => prev ? { ...prev, participants: data.participantCount } : prev);
    }
    function onUserLeft(data) {
      setAuction(prev => prev ? { ...prev, participants: data.participantCount } : prev);
    }
    function onAuctionEnded(data) {
      // Optionally update UI upon end
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('auction_joined', onAuctionJoined);
    socket.on('new_bid', onNewBid);
    socket.on('user_joined_auction', onUserJoined);
    socket.on('user_left_auction', onUserLeft);
    socket.on('auction_ended', onAuctionEnded);

    return () => {
      try {
        const s = getSocket();
        if (s && s.connected) {
          s.emit('leave_auction', { produceId: id });
        }
      } catch { }
      if (socket) {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('auction_joined', onAuctionJoined);
        socket.off('new_bid', onNewBid);
        socket.off('user_joined_auction', onUserJoined);
        socket.off('user_left_auction', onUserLeft);
        socket.off('auction_ended', onAuctionEnded);
      }
    };
  }, [id]);

  const fetchAuctionData = async () => {
    try {
      const response = await api.get(`/auctions/${id}`);

      if (response.success) {
        const auctionData = response.data;
        setAuction({
          ...auctionData,
          endTime: new Date(auctionData.endTime),
          images: auctionData.images || ['/api/placeholder/400/300'],
          biddingHistory: auctionData.bids || [],
          specifications: auctionData.specifications || {},
          farmer: auctionData.farmer || { name: 'Unknown Farmer', location: 'Unknown', rating: 0, totalSales: 0 }
        });
      }
    } catch (error) {
      console.error('Failed to fetch auction data:', error);
      // Set a fallback state or show error message
      setAuction(null);
    }
  };

  // Timer effect
  useEffect(() => {
    if (!auction) return;

    const timer = setInterval(() => {
      const now = new Date();
      const difference = auction.endTime - now;

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft('ENDED');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [auction]);

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    const bid = parseInt(bidAmount);
    if (bid <= auction.currentBid) {
      alert('Bid must be higher than current bid');
      return;
    }
    if (bid < auction.currentBid + auction.bidIncrement) {
      alert(`Minimum bid increment is ₹${auction.bidIncrement}`);
      return;
    }

    const socket = getSocket();
    const token = localStorage.getItem('token');

    try {
      if (socket && socket.connected && token) {
        socket.emit('place_bid', { produceId: id, amount: bid, quantity: auction.quantity || 1 });
        setBidAmount('');
        return;
      }
    } catch (e) {
      // fall back to REST below
    }

    try {
      const response = await api.post(`/auctions/${id}/bid`, { amount: bid });
      if (response.success) {
        await fetchAuctionData();
        setBidAmount('');
        alert('Bid placed successfully!');
      }
    } catch (error) {
      console.error('Failed to place bid:', error);
      alert('Failed to place bid. Please try again.');
    }
  };

  const handleQuickBid = (amount) => {
    setBidAmount(amount.toString());
  };

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading auction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{auction.produce}</h1>
              <p className="text-gray-600 mt-1">Live Auction #{auction.id}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">{timeLeft}</div>
                <div className="text-sm text-gray-600">Time Remaining</div>
              </div>
            </div>
          </div>

          {/* Auction Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900">₹{auction.currentBid.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Current Bid</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900">₹{auction.basePrice.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Base Price</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900">{auction.participants}</div>
              <div className="text-sm text-gray-600">Participants</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900">{auction.quantity}</div>
              <div className="text-sm text-gray-600">Quantity</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Product Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Images */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Images</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {auction.images.map((image, index) => (
                  <div key={index} className="aspect-w-4 aspect-h-3">
                    <img
                      src={image}
                      alt={`${auction.produce} ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Product Details */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Details</h2>
              <p className="text-gray-700 mb-6">{auction.description}</p>

              <div className="grid grid-cols-2 gap-4">
                {Object.entries(auction.specifications).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="text-sm text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Farmer Info */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Farmer Information</h2>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👨‍🌾</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{auction.farmer.name}</h3>
                  <p className="text-gray-600">{auction.farmer.location}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center">
                      <span className="text-yellow-400">⭐</span>
                      <span className="text-sm font-medium text-gray-700 ml-1">{auction.farmer.rating}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {auction.farmer.totalSales} successful sales
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Bidding Panel */}
          <div className="space-y-6">
            {/* Bidding Form */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sticky top-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Place Your Bid</h2>

              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">Current Highest Bid</div>
                <div className="text-3xl font-bold text-green-600">₹{auction.currentBid.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Minimum increment: ₹{auction.bidIncrement}</div>
              </div>

              <form onSubmit={handleBidSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Bid Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={auction.currentBid + auction.bidIncrement}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder={`Min: ₹${auction.currentBid + auction.bidIncrement}`}
                  />
                </div>

                {/* Quick Bid Buttons */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Quick Bid:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      auction.currentBid + auction.bidIncrement,
                      auction.currentBid + auction.bidIncrement * 2,
                      auction.currentBid + auction.bidIncrement * 3,
                      auction.currentBid + auction.bidIncrement * 5
                    ].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => handleQuickBid(amount)}
                        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        +₹{amount - auction.currentBid}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!bidAmount || timeLeft === 'ENDED'}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {timeLeft === 'ENDED' ? 'Auction Ended' : 'Place Bid'}
                </button>
              </form>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600">💡</span>
                  <span className="text-sm text-blue-800">
                    Funds will be held in escrow until delivery confirmation
                  </span>
                </div>
              </div>
            </div>

            {/* Bidding History */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Bidding History</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {auction.biddingHistory.map((bid, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <div className="font-medium text-gray-900">₹{bid.amount.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">{bid.time}</div>
                    </div>
                    <div className={`text-sm font-medium ${bid.bidder === 'You' ? 'text-green-600' : 'text-gray-600'}`}>
                      {bid.bidder}
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

export default LiveAuction;