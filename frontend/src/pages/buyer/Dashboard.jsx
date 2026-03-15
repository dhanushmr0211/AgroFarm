import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    activeBids: 0,
    wonBids: 0,
    totalSpent: 0,
    successRate: '0%'
  });

  const [activeBids, setActiveBids] = useState([]);
  const [wonAuctions, setWonAuctions] = useState([]);
  const [liveAuctions, setLiveAuctions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch Stats
      const statsRes = await api.get('/users/dashboard-stats');
      if (statsRes.data.success) {
        const s = statsRes.data.data;
        // Calculate success rate
        const total = s.activeBids + s.wonBids; // Crude approximation
        const rate = total > 0 ? Math.round((s.wonBids / s.totalBids) * 100) : 0;

        setStats({
          activeBids: s.activeBids || 0,
          wonBids: s.wonBids || 0,
          totalSpent: s.totalSpent || 0,
          successRate: `${rate}%`
        });
      }

      // Fetch Active Bids
      const bidsRes = await api.get('/auctions/user/bids?status=ACTIVE');
      if (bidsRes.data.success) {
        setActiveBids(bidsRes.data.data || []);
      }

      // Fetch Won Auctions (Orders)
      const ordersRes = await api.get('/users/orders');
      if (ordersRes.data.success) {
        setWonAuctions(ordersRes.data.data || []);
      }

      // Fetch Live Sessions
      const liveRes = await api.get('/auctions/sessions?status=LIVE');
      if (Array.isArray(liveRes)) {
        setLiveAuctions(liveRes);
      } else if (liveRes?.data && Array.isArray(liveRes.data)) {
        setLiveAuctions(liveRes.data);
      } else if (liveRes?.success && Array.isArray(liveRes.data)) {
        setLiveAuctions(liveRes.data);
      } else {
        setLiveAuctions([]);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'ACTIVE': 'bg-blue-100 text-blue-800',
      'WON': 'bg-green-100 text-green-800',
      'LOST': 'bg-red-100 text-red-800',
      'DELIVERED': 'bg-green-100 text-green-800',
      'SHIPPED': 'bg-yellow-100 text-yellow-800',
      'CONFIRMED': 'bg-blue-100 text-blue-800',
      'PENDING': 'bg-yellow-100 text-yellow-800'
    };
    return statusConfig[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const statCards = [
    { title: 'Active Bids', value: stats.activeBids, icon: '📝', color: 'bg-blue-500' },
    { title: 'Won Auctions', value: stats.wonBids, icon: '🏆', color: 'bg-green-500' },
    { title: 'Total Spent', value: formatCurrency(stats.totalSpent), icon: '💰', color: 'bg-purple-500' },
    { title: 'Success Rate', value: stats.successRate, icon: '📊', color: 'bg-orange-500' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Buyer Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user?.name}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <div key={index} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg text-white`}>
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
                { id: 'live-auctions', name: 'Live Sessions', icon: '🔴' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${activeTab === tab.id
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
                      <button
                        onClick={() => navigate('/apmc-schedule')}
                        className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <span>🗓️</span>
                        <span>Find Auction Sessions</span>
                      </button>
                      <button
                        onClick={() => navigate('/wallet')}
                        className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <span>💰</span>
                        <span>Add Funds to Wallet</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('live-auctions')}
                        className="w-full bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <span>🔴</span>
                        <span>Browse Live Sessions</span>
                      </button>
                    </div>
                  </div>

                  {/* Recent Activity (Placeholder for now as generic activity feed logic is complex) */}
                  <div className="bg-white rounded-lg border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Wins</h3>
                    <div className="space-y-3">
                      {wonAuctions.length > 0 ? wonAuctions.slice(0, 3).map((order) => (
                        <div key={order.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="text-2xl">🏆</div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">You won <b>{order.produce?.title}</b></p>
                            <p className="text-xs text-gray-500 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      )) : (
                        <p className="text-gray-500 text-sm">No recent wins yet.</p>
                      )}
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
                  <button
                    onClick={() => setActiveTab('live-auctions')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Browse Sessions
                  </button>
                </div>
                {activeBids.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produce</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Your Bid</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {activeBids.map((bid) => (
                          <tr key={bid.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{bid.produce?.title || 'Unknown Item'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{bid.quantity}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-green-600">{formatCurrency(bid.amount)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(bid.status)}`}>
                                {bid.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(bid.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No active bids found.
                  </div>
                )}
              </div>
            )}

            {/* Won Auctions Tab */}
            {activeTab === 'won-auctions' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Your Won Auctions</h3>
                </div>
                {wonAuctions.length > 0 ? (
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
                        {wonAuctions.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{order.produce?.title}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.produce?.quantity} {order.produce?.unit}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{formatCurrency(order.bid?.amount || 0)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button className="text-blue-600 hover:text-blue-900 mr-3">Track</button>
                              <button className="text-green-600 hover:text-green-900">Invoice</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No won auctions yet.
                  </div>
                )}
              </div>
            )}

            {/* Live Sessions Tab */}
            {activeTab === 'live-auctions' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Live Auction Sessions</h3>
                  <button onClick={fetchDashboardData} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    Refresh
                  </button>
                </div>
                {liveAuctions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {liveAuctions.map((session) => (
                      <div key={session.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-gray-900">{session.apmc?.name || 'Unknown APMC'}</h4>
                          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            🔴 LIVE
                          </span>
                        </div>
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Location:</span>
                            <span className="text-sm font-medium">{session.apmc?.location}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Category:</span>
                            <span className="text-sm font-medium">{session.category || 'General'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Active Participants:</span>
                            <span className="text-sm font-medium">{session.participants || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">End Time:</span>
                            <span className="text-sm font-medium text-red-600">
                              {session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'Unknown'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/live-auction/${session.id}`)}
                          className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Join Session
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No live sessions available. Check the schedule to book upcoming spots!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;