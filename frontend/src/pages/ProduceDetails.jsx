import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

const ProduceDetails = () => {
  const { id } = useParams();
  const [produce, setProduce] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');

  useEffect(() => {
    fetchProduceDetails();
  }, [id]);

  const fetchProduceDetails = async () => {
    try {
      const response = await api.get(`/auctions/${id}`);

      if (response.success) {
        const produceData = response.data;
        setProduce({
          ...produceData,
          endTime: new Date(produceData.endTime),
          images: produceData.images || ['/api/placeholder/600/400'],
          specifications: produceData.specifications || {},
          qualityMetrics: produceData.qualityMetrics || { freshness: 0, appearance: 0, taste: 0, nutritionalValue: 0 },
          logistics: produceData.logistics || {},
          biddingStats: {
            totalBids: produceData.bids?.length || 0,
            participants: produceData.participants || 0,
            bidHistory: produceData.bids || []
          },
          reviews: produceData.reviews || [],
          farmer: produceData.farmer || { name: 'Unknown Farmer', location: 'Unknown', rating: 0, totalSales: 0, verified: false }
        });
      }
    } catch (error) {
      console.error('Failed to fetch produce details:', error);
      setProduce(null);
    }
  };

  const handleBidSubmit = async () => {
    const bid = parseInt(bidAmount);
    if (bid <= produce.currentBid) {
      alert('Bid must be higher than current bid');
      return;
    }
    if (bid < produce.currentBid + produce.bidIncrement) {
      alert(`Minimum bid increment is ₹${produce.bidIncrement}`);
      return;
    }

    try {
      const response = await api.post(`/auctions/${id}/bid`, { amount: bid });

      if (response.success) {
        // Refresh produce details to get updated bids
        await fetchProduceDetails();
        setBidAmount('');
        setShowBidModal(false);
        alert('Bid placed successfully!');
      }
    } catch (error) {
      console.error('Failed to place bid:', error);
      alert('Failed to place bid. Please try again.');
    }
  };

  if (!produce) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading produce details...</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Live Auction': 'bg-red-100 text-red-800',
      'Upcoming': 'bg-yellow-100 text-yellow-800',
      'Sold': 'bg-green-100 text-green-800',
      'Expired': 'bg-gray-100 text-gray-800'
    };
    return statusConfig[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            <li><a href="/" className="text-gray-500 hover:text-gray-700">Home</a></li>
            <li><span className="text-gray-400">/</span></li>
            <li><a href="/browse" className="text-gray-500 hover:text-gray-700">Browse Produce</a></li>
            <li><span className="text-gray-400">/</span></li>
            <li><span className="text-gray-900">{produce.name}</span></li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Images and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="mb-4">
                <img
                  src={produce.images[selectedImage]}
                  alt={produce.name}
                  className="w-full h-96 object-cover rounded-lg border border-gray-200"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {produce.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`border-2 rounded-lg overflow-hidden ${selectedImage === index ? 'border-green-500' : 'border-gray-200'
                      }`}
                  >
                    <img
                      src={image}
                      alt={`${produce.name} ${index + 1}`}
                      className="w-full h-20 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Information */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{produce.name}</h1>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadge(produce.status)}`}>
                  {produce.status}
                </span>
              </div>

              <div className="flex items-center space-x-4 mb-6">
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                  {produce.category}
                </span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-600">Quantity: {produce.quantity}</span>
              </div>

              <p className="text-gray-700 text-lg leading-relaxed mb-6">{produce.description}</p>

              {/* Specifications */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(produce.specifications).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                      </span>
                      <span className="text-sm text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Metrics */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(produce.qualityMetrics).map(([metric, score]) => (
                    <div key={metric} className="text-center">
                      <div className="relative w-16 h-16 mx-auto mb-2">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200" />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            className="text-green-500"
                            strokeDasharray={`${score * 2.51}, 251`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-semibold text-gray-900">{score}%</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 capitalize">
                        {metric.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logistics */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Logistics Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(produce.logistics).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                      </span>
                      <span className="text-sm text-gray-900">
                        {Array.isArray(value) ? value.join(', ') : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Farmer Information */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Farmer Information</h3>
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👨‍🌾</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-lg font-medium text-gray-900">{produce.farmer.name}</h4>
                    {produce.farmer.verified && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">✓ Verified</span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-2">{produce.farmer.location}</p>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <span className="text-yellow-400">⭐</span>
                      <span className="text-sm font-medium text-gray-700 ml-1">{produce.farmer.rating}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {produce.farmer.totalSales} successful sales
                    </div>
                    <div className="text-sm text-gray-600">
                      Farming since {produce.farmer.joinedDate}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Buyer Reviews</h3>
              <div className="space-y-4">
                {produce.reviews.map((review, index) => (
                  <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{review.buyer}</span>
                        {review.verified && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">✓ Verified Purchase</span>
                        )}
                      </div>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                            ⭐
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-700 text-sm mb-1">{review.comment}</p>
                    <p className="text-gray-500 text-xs">{review.date}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Bidding Panel */}
          <div className="space-y-6">
            {/* Current Bid Status */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sticky top-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  ₹{produce.currentBid.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Current Highest Bid</div>
                <div className="text-xs text-gray-500 mt-1">
                  Base Price: ₹{produce.basePrice.toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{produce.biddingStats.totalBids}</div>
                  <div className="text-sm text-gray-600">Total Bids</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{produce.biddingStats.participants}</div>
                  <div className="text-sm text-gray-600">Participants</div>
                </div>
              </div>

              {produce.status === 'Live Auction' ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setShowBidModal(true)}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Place Bid
                  </button>
                  <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                    Join Live Auction
                  </button>
                </div>
              ) : (
                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 py-3 px-4 rounded-lg cursor-not-allowed"
                >
                  Auction {produce.status}
                </button>
              )}

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600">💡</span>
                  <span className="text-sm text-blue-800">
                    Secure payment with escrow protection
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Bidding Activity */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Bidding Activity</h3>
              <div className="space-y-3">
                {produce.biddingStats.bidHistory.map((bid, index) => (
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

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2">
                  <span>❤️</span>
                  <span>Add to Wishlist</span>
                </button>
                <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2">
                  <span>📢</span>
                  <span>Set Price Alert</span>
                </button>
                <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2">
                  <span>📤</span>
                  <span>Share Product</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bid Modal */}
      {showBidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Place Your Bid</h3>

            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Current Highest Bid</div>
              <div className="text-2xl font-bold text-green-600">₹{produce.currentBid.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Minimum increment: ₹{produce.bidIncrement}</div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Bid Amount (₹)
              </label>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                min={produce.currentBid + produce.bidIncrement}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder={`Min: ₹${produce.currentBid + produce.bidIncrement}`}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowBidModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBidSubmit}
                disabled={!bidAmount}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Place Bid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProduceDetails;