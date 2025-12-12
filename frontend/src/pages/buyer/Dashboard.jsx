import React, { useState } from 'react';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const stats = [
    { title: 'Active Bids', value: '8', icon: '📝', color: 'bg-blue-500' },
    { title: 'Won Auctions', value: '15', icon: '🏆', color: 'bg-green-500' },
    { title: 'Total Spent', value: '₹1,85,000', icon: '💰', color: 'bg-purple-500' },
    { title: 'Success Rate', value: '73%', icon: '📊', color: 'bg-orange-500' }
  ];

  const activeBids = [
    { id: 1, produce: 'Organic Tomatoes', quantity: '500 kg', currentBid: '₹18,000', status: 'Bidding', endTime: '2 hrs 30 mins' },
    { id: 2, produce: 'Fresh Onions', quantity: '1000 kg', currentBid: '₹25,000', status: 'Winning', endTime: '45 mins' },
    { id: 3, produce: 'Basmati Rice', quantity: '200 kg', currentBid: '₹12,000', status: 'Outbid', endTime: '1 hr 15 mins' }
  ];

  const wonAuctions = [
    { id: 1, produce: 'Wheat Grade A', quantity: '800 kg', finalPrice: '₹22,000', date: '2024-01-15', status: 'Delivered' },
    { id: 2, produce: 'Fresh Potatoes', quantity: '600 kg', finalPrice: '₹15,000', date: '2024-01-12', status: 'In Transit' },
    { id: 3, produce: 'Organic Carrots', quantity: '300 kg', finalPrice: '₹9,000', date: '2024-01-10', status: 'Delivered' }
  ];

  const liveAuctions = [
    { id: 1, produce: 'Premium Mangoes', quantity: '400 kg', basePrice: '₹20,000', currentBid: '₹24,000', bidders: 12, endTime: '3 hrs 45 mins' },
    { id: 2, produce: 'Fresh Cauliflower', quantity: '250 kg', basePrice: '₹8,000', currentBid: '₹9,500', bidders: 8, endTime: '1 hr 20 mins' },
    { id: 3, produce: 'Organic Spinach', quantity: '150 kg', basePrice: '₹6,000', currentBid: '₹7,200', bidders: 15, endTime: '55 mins' }
  ];

  const recentActivity = [
    { type: 'bid_placed', message: 'You placed a bid of ₹18,000 on Organic Tomatoes', time: '2 hours ago', icon: '📝' },
    { type: 'auction_won', message: 'You won the auction for Fresh Potatoes at ₹15,000', time: '1 day ago', icon: '🏆' },
    { type: 'outbid', message: 'You were outbid on Basmati Rice auction', time: '3 hours ago', icon: '⚠️' },
    { type: 'delivery', message: 'Wheat Grade A has been delivered successfully', time: '2 days ago', icon: '✅' }
  ];

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Bidding': 'bg-blue-100 text-blue-800',
      'Winning': 'bg-green-100 text-green-800',
      'Outbid': 'bg-red-100 text-red-800',
      'Delivered': 'bg-green-100 text-green-800',
      'In Transit': 'bg-yellow-100 text-yellow-800'
    };
    return statusConfig[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Buyer Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your bids and track your purchases</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <span className="text-2xl">{stat.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'overview', name: 'Overview', icon: '📊' },
                { id: 'active-bids', name: 'Active Bids', icon: '📝' },
                { id: 'won-auctions', name: 'Won Auctions', icon: '🏆' },
                { id: 'live-auctions', name: 'Live Auctions', icon: '🔴' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Quick Actions */}
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <button className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2">
                        <span>�</span>
                        <span>View APMC Schedule</span>
                      </button>
                      <button className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2">
                        <span>🎯</span>
                        <span>Book Bidding Spot</span>
                      </button>
                      <button className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2">
                        <span>💰</span>
                        <span>Add Funds to Wallet</span>
                      </button>
                      <button className="w-full bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2">
                        <span>📊</span>
                        <span>Market Analytics</span>
                      </button>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                      {recentActivity.slice(0, 4).map((activity, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                          <span className="text-lg">{activity.icon}</span>
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">{activity.message}</p>
                            <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Bids Tab */}
            {activeTab === 'active-bids' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Your Active Bids</h3>
                  <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    Browse Auctions
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produce</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Your Bid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Left</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activeBids.map((bid) => (
                        <tr key={bid.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{bid.produce}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{bid.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{bid.currentBid}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(bid.status)}`}>
                              {bid.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{bid.endTime}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-green-600 hover:text-green-900 mr-3">Update Bid</button>
                            <button className="text-blue-600 hover:text-blue-900">View Details</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Won Auctions Tab */}
            {activeTab === 'won-auctions' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Your Won Auctions</h3>
                  <div className="flex space-x-2">
                    <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      <option>All Status</option>
                      <option>In Transit</option>
                      <option>Delivered</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produce</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {wonAuctions.map((auction) => (
                        <tr key={auction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{auction.produce}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{auction.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{auction.finalPrice}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{auction.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(auction.status)}`}>
                              {auction.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-blue-600 hover:text-blue-900 mr-3">Track Order</button>
                            <button className="text-green-600 hover:text-green-900">Download Invoice</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Live Auctions Tab */}
            {activeTab === 'live-auctions' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Live Auctions</h3>
                  <div className="flex space-x-2">
                    <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      <option>All Categories</option>
                      <option>Vegetables</option>
                      <option>Fruits</option>
                      <option>Grains</option>
                    </select>
                    <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {liveAuctions.map((auction) => (
                    <div key={auction.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900">{auction.produce}</h4>
                        <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          🔴 LIVE
                        </span>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Quantity:</span>
                          <span className="text-sm font-medium">{auction.quantity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Base Price:</span>
                          <span className="text-sm font-medium">{auction.basePrice}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Current Bid:</span>
                          <span className="text-sm font-bold text-green-600">{auction.currentBid}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Bidders:</span>
                          <span className="text-sm font-medium">{auction.bidders} active</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Time Left:</span>
                          <span className="text-sm font-medium text-red-600">{auction.endTime}</span>
                        </div>
                      </div>
                      <button className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium">
                        Join Auction
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;