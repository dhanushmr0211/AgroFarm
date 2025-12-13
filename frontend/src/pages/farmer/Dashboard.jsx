import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Package, DollarSign, Clock, TrendingUp, MapPin, X, Trash2, Star, Calendar, Users, Bell, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../../api'
import toast from 'react-hot-toast'


const FarmerDashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [showAddProduceModal, setShowAddProduceModal] = useState(false)
  const [newProduce, setNewProduce] = useState({
    name: '',
    quantity: '',
    quality: 'Grade A',
    minPrice: '',
    description: '',
    location: '',
    apmcId: ''
  })

  const [loading, setLoading] = useState(false)
  const [apmcs, setApmcs] = useState([])
  const [myProduce, setMyProduce] = useState([])
  const [stats, setStats] = useState({
    activeListings: 0,
    liveAuctions: 0,
    totalEarnings: 0,
    successRate: 0
  })

  // Notifications state
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [bookingRequests, setBookingRequests] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(false)

  useEffect(() => {
    fetchAPMCs()
    fetchMyProduce()
    fetchStats()
    fetchNotifications()
    fetchBookingRequests()

    // Auto-refresh notifications every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications()
      fetchBookingRequests()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const fetchAPMCs = async () => {
    try {
      const response = await api.get('/auth/apmcs')
      setApmcs(response.data || [])
    } catch (error) {
      console.error('Failed to fetch APMCs:', error)
    }
  }

  const fetchMyProduce = async () => {
    try {
      const response = await api.get('/auctions/farmer/auctions')
      setMyProduce(response.data || [])
    } catch (error) {
      console.error('Failed to fetch produce:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/auctions/farmer/auctions')
      const produce = response.data || []

      const activeListings = produce.filter(p => p.status === 'UPCOMING' || p.status === 'LIVE').length
      const liveAuctions = produce.filter(p => p.status === 'LIVE').length
      const completedAuctions = produce.filter(p => p.status === 'COMPLETED')
      const successRate = produce.length ? Math.round((completedAuctions.length / produce.length) * 100) : 0

      // Calculate real total earnings from completed auctions
      const totalEarnings = completedAuctions.reduce((sum, auction) => {
        return sum + (auction.winningBid?.amount || auction.currentBid || 0)
      }, 0)

      setStats({
        activeListings,
        liveAuctions,
        totalEarnings,
        successRate
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleAddProduce = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const produceData = {
        title: newProduce.name,
        description: newProduce.description,
        category: getCategoryFromName(newProduce.name),
        quantity: parseFloat(newProduce.quantity),
        basePrice: parseFloat(newProduce.minPrice),
        grade: newProduce.quality,
        pickupLocation: newProduce.location,
        apmcId: newProduce.apmcId,
        auctionStartTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        auctionEndTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
      }

      const response = await api.post('/auctions', produceData)

      if (response.success) {
        toast.success('Produce listed successfully!')
        setShowAddProduceModal(false)
        setNewProduce({
          name: '',
          quantity: '',
          quality: 'Grade A',
          minPrice: '',
          description: '',
          location: '',
          apmcId: ''
        })
        fetchMyProduce() // Refresh the list
        fetchStats() // Refresh stats
      }
    } catch (error) {
      console.error('Failed to add produce:', error)
      toast.error(error.response?.data?.message || 'Failed to add produce')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryFromName = (name) => {
    const categoryMap = {
      'Tomato': 'VEGETABLES',
      'Onion': 'VEGETABLES',
      'Potato': 'VEGETABLES',
      'Wheat': 'GRAINS',
      'Rice': 'GRAINS',
      'Cotton': 'OILSEEDS',
      'Sugarcane': 'GRAINS'
    }
    return categoryMap[name] || 'VEGETABLES'
  }

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoadingNotifications(true)
    try {
      const response = await api.get('/notifications')

      if (response.success) {
        const notificationsData = response.data
        setNotifications(notificationsData.items || notificationsData || [])
        setUnreadCount(notificationsData.unreadCount || 0)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoadingNotifications(false)
    }
  }

  // Fetch booking requests
  const fetchBookingRequests = async () => {
    setLoadingBookings(true)
    try {
      const response = await api.get('/auctions/farmer/booking-requests')

      if (response.success) {
        setBookingRequests(response.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch booking requests:', error)
      // Don't show error to user, as this might be a permission issue
    } finally {
      setLoadingBookings(false)
    }
  }

  const clearAllBookingRequests = async () => {
    try {
      await api.delete('/auctions/farmer/booking-requests/clear-all')
      toast.success('All requests cleared')
      fetchBookingRequests()
    } catch (error) {
      console.error('Failed to clear booking requests:', error)
      toast.error('Failed to clear booking requests')
    }
  }

  const deleteBookingRequest = async (id) => {
    try {
      await api.delete(`/auctions/farmer/booking-requests/${id}`)
      toast.success('Request deleted')
      setBookingRequests(prev => prev.filter(b => b.id !== id))
    } catch (error) {
      console.error('Failed to delete booking request:', error)
      toast.error('Failed to delete request')
    }
  }

  // Mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`, {})

      // Update local state
      setNotifications(prev => prev.map(notif =>
        notif.id === notificationId ? { ...notif, isRead: true } : notif
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  // Mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    try {
      await api.put('/notifications/mark-all-read', {})

      // Update local state
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
      toast.error('Failed to mark notifications as read')
    }
  }

  // Get notification icon
  const getNotificationIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'BOOKING_APPROVED':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'BOOKING_REJECTED':
        return <X className="h-5 w-5 text-red-500" />
      case 'AUCTION_START':
        return <Clock className="h-5 w-5 text-blue-500" />
      case 'BID_UPDATE':
        return <TrendingUp className="h-5 w-5 text-orange-500" />
      default:
        return <Bell className="h-5 w-5 text-gray-500" />
    }
  }

  // Format notification time
  const formatNotificationTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.name}! 🚜
              </h1>
              <p className="text-gray-600 mt-2">
                Manage your produce and track your auctions
              </p>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`p-2 rounded-full ${activeTab === 'notifications'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } transition-colors`}
              >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Listings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeListings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Live Auctions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.liveAuctions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">₹{stats.totalEarnings.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.successRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'overview'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('produce')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'produce'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                My Produce
              </button>
              <button
                onClick={() => setActiveTab('auctions')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'auctions'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Live Auctions
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'history'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                History
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`py-4 px-6 text-sm font-medium border-b-2 relative ${activeTab === 'notifications'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'bookings'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Booking Status
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
                  <button
                    onClick={() => setShowAddProduceModal(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center disabled:opacity-50"
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Produce
                  </button>
                </div>

                {/* Quick Actions Card */}
                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900">Find Auction Sessions</h3>
                      <p className="text-blue-700 text-sm mt-1">Browse upcoming sessions at APMCs and book your spot.</p>
                    </div>
                    <button
                      onClick={() => navigate('/apmc-schedule')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      View Schedule
                    </button>
                  </div>

                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-purple-900">AI Price Prediction</h3>
                      <p className="text-purple-700 text-sm mt-1">Get AI-powered insights on produce prices.</p>
                    </div>
                    <a
                      href="http://10.81.203.121:8501"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Predict Price
                    </a>
                  </div>
                </div>

                <div className="space-y-4">
                  {myProduce.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-lg border border-gray-100">
                      <p className="text-gray-500">No recent activity</p>
                    </div>
                  ) : (
                    myProduce.slice(0, 3).map((produce) => (
                      <div key={produce.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                        <div className="flex items-center">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${produce.status === 'LIVE' ? 'bg-blue-100' :
                            produce.status === 'COMPLETED' ? 'bg-green-100' : 'bg-yellow-100'
                            }`}>
                            {produce.status === 'LIVE' ? (
                              <Clock className="w-6 h-6 text-blue-600" />
                            ) : produce.status === 'COMPLETED' ? (
                              <Package className="w-6 h-6 text-green-600" />
                            ) : (
                              <Package className="w-6 h-6 text-yellow-600" />
                            )}
                          </div>
                          <div className="ml-4">
                            <p className="font-medium text-gray-900">{produce.title}</p>
                            <p className="text-sm text-gray-600">
                              {produce.status === 'LIVE' ? `Live auction • Current Price: ₹${produce.currentBid || produce.basePrice}` :
                                produce.status === 'COMPLETED' ? `Auction ended • Winning bid: ₹${produce.winningBid?.amount || produce.currentBid}` :
                                  `Upcoming • Base price: ₹${produce.basePrice}`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${produce.status === 'LIVE' ? 'bg-blue-100 text-blue-800' :
                          produce.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                          {produce.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'produce' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">My Produce</h2>
                  <button
                    onClick={() => setShowAddProduceModal(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Produce
                  </button>
                </div>

                {/* Real Produce Listings from API */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myProduce.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                      <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No produce listed yet</h3>
                      <p className="text-gray-600 mb-4">Start by adding your first produce for auction</p>
                      <button
                        onClick={() => setShowAddProduceModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                      >
                        Add Your First Produce
                      </button>
                    </div>
                  ) : (
                    myProduce.map((produce) => (
                      <div key={produce.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">{produce.title}</h3>
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${produce.status === 'LIVE'
                            ? 'bg-blue-100 text-blue-800'
                            : produce.status === 'UPCOMING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : produce.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                            {produce.status}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Quantity:</span>
                            <span className="font-medium">{produce.quantity} {produce.unit}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quality:</span>
                            <span className="font-medium">{produce.grade}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Base Price:</span>
                            <span className="font-medium text-green-600">₹{produce.basePrice?.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center">
                            <MapPin size={14} className="mr-1" />
                            <span>{produce.pickupLocation}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar size={14} className="mr-1" />
                            <span>{new Date(produce.auctionStartTime).toLocaleString()}</span>
                          </div>
                        </div>
                        {produce.currentBid && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Current Bid:</span>
                              <span className="font-bold text-blue-600">₹{produce.currentBid?.toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                        {/* Action buttons */}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                          <button
                            onClick={() => navigate(`/produce/${produce.id}`)}
                            className="text-sm text-green-600 hover:text-green-800 font-medium"
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'auctions' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Live Auctions</h2>
                {myProduce.filter(p => p.status === 'LIVE').length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No live auctions</h3>
                    <p className="text-gray-600">Your live produce auctions will appear here.</p>
                    <button
                      onClick={() => navigate('/apmc-schedule')}
                      className="mt-4 text-green-600 hover:text-green-800 font-medium"
                    >
                      Looking for sessions? Check Schedule →
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myProduce.filter(p => p.status === 'LIVE').map((produce) => (
                      <div key={produce.id} className="bg-white border-2 border-green-500 rounded-lg p-6 shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-bl">
                          LIVE NOW
                        </div>
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">{produce.title}</h3>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Current High Bid:</span>
                            <span className="font-bold text-xl text-green-600">₹{produce.currentBid?.toLocaleString() || produce.basePrice?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quantity:</span>
                            <span className="font-medium">{produce.quantity} {produce.unit}</span>
                          </div>
                          <div className="mt-4 flex space-x-3">
                            <button
                              onClick={() => navigate(`/produce/${produce.id}`)}
                              className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition text-sm font-medium"
                            >
                              Monitor Auction
                            </button>
                            {produce.sessionId && (
                              <button
                                onClick={() => navigate(`/session/${produce.sessionId}`)}
                                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition text-sm font-medium"
                              >
                                Join Session
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Auction History</h2>
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No auction history</h3>
                  <p className="text-gray-600">Your completed auctions will be shown here</p>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-sm text-green-600 hover:text-green-800 font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                {loadingNotifications ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Bell className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
                    <p className="text-gray-600">You'll see updates about your bookings and auctions here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${notification.isRead
                          ? 'bg-white border-gray-200'
                          : 'bg-blue-50 border-blue-200'
                          }`}
                        onClick={() => !notification.isRead && markNotificationAsRead(notification.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <h4 className={`text-sm font-medium ${notification.isRead ? 'text-gray-900' : 'text-blue-900'
                                }`}>
                                {notification.title}
                              </h4>
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                {formatNotificationTime(notification.createdAt)}
                              </span>
                            </div>
                            <p className={`text-sm mt-1 ${notification.isRead ? 'text-gray-600' : 'text-blue-800'
                              }`}>
                              {notification.body}
                            </p>
                            {!notification.isRead && (
                              <div className="mt-2">
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bookings' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Booking Status</h2>
                  <button
                    onClick={fetchBookingRequests}
                    className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center"
                    disabled={loadingBookings}
                  >
                    {loadingBookings ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 mr-2"></div>
                    ) : null}
                    Refresh
                  </button>
                  <button
                    onClick={clearAllBookingRequests}
                    className="ml-3 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Clear All
                  </button>
                </div>

                {loadingBookings ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Loading booking status...</p>
                  </div>
                ) : bookingRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No booking requests</h3>
                    <p className="text-gray-600">Your APMC booking requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookingRequests.map((booking) => (
                      <div key={booking.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {booking.apmc?.name || 'Unknown APMC'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              📍 {booking.apmc?.location || 'Location not available'}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${booking.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : booking.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {booking.status}
                          </span>
                          <button
                            onClick={() => deleteBookingRequest(booking.id)}
                            className="ml-3 text-sm text-red-600 hover:text-red-800"
                            title="Delete this request"
                          >
                            Delete
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Request Date:</span>
                            <span className="ml-2 font-medium">
                              {new Date(booking.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {booking.reviewedAt && (
                            <div>
                              <span className="text-gray-600">Reviewed:</span>
                              <span className="ml-2 font-medium">
                                {new Date(booking.reviewedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {booking.reviewer && (
                            <div>
                              <span className="text-gray-600">Reviewed By:</span>
                              <span className="ml-2 font-medium">{booking.reviewer.name}</span>
                            </div>
                          )}
                        </div>

                        {booking.status === 'APPROVED' && (
                          <div className="mt-4 p-3 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-800 font-medium">
                              ✅ Your booking has been approved! You can now list your produce for auction.
                            </p>
                          </div>
                        )}

                        {booking.status === 'REJECTED' && (
                          <div className="mt-4 p-3 bg-red-50 rounded-lg">
                            <p className="text-sm text-red-800 font-medium">
                              ❌ Your booking was rejected. Please contact the APMC for more information.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Produce Modal */}
      {showAddProduceModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">🌾 Add New Produce</h3>
                <button
                  onClick={() => setShowAddProduceModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddProduce} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Produce Name</label>
                  <select
                    value={newProduce.name}
                    onChange={(e) => setNewProduce({ ...newProduce, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select produce</option>
                    <option value="Tomato">🍅 Tomato</option>
                    <option value="Onion">🧅 Onion</option>
                    <option value="Potato">🥔 Potato</option>
                    <option value="Wheat">🌾 Wheat</option>
                    <option value="Rice">🌾 Rice</option>
                    <option value="Cotton">🌿 Cotton</option>
                    <option value="Sugarcane">🎋 Sugarcane</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity (qtl)</label>
                    <input
                      type="number"
                      value={newProduce.quantity}
                      onChange={(e) => setNewProduce({ ...newProduce, quantity: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quality</label>
                    <select
                      value={newProduce.quality}
                      onChange={(e) => setNewProduce({ ...newProduce, quality: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="Grade A+">Grade A+</option>
                      <option value="Grade A">Grade A</option>
                      <option value="Grade B">Grade B</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Minimum Price (₹/qtl)</label>
                  <input
                    type="number"
                    value={newProduce.minPrice}
                    onChange={(e) => setNewProduce({ ...newProduce, minPrice: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="2500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Select APMC</label>
                  <select
                    value={newProduce.apmcId}
                    onChange={(e) => setNewProduce({ ...newProduce, apmcId: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select APMC</option>
                    {apmcs.map((apmc) => (
                      <option key={apmc.id} value={apmc.id}>
                        🏛️ {apmc.name} - {apmc.location}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    value={newProduce.location}
                    onChange={(e) => setNewProduce({ ...newProduce, location: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Farm location"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={newProduce.description}
                    onChange={(e) => setNewProduce({ ...newProduce, description: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows={3}
                    placeholder="Additional details about your produce..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding...
                      </div>
                    ) : (
                      <>📝 List Produce</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddProduceModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FarmerDashboard