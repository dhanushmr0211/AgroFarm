import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Package, DollarSign, Clock, TrendingUp, MapPin, X, Trash2, Star, Calendar, Users, Bell, CheckCircle, AlertCircle, Sprout, Landmark, XCircle, FileText, RefreshCw, Award, Check } from 'lucide-react'
import api from '../../api'
import toast from 'react-hot-toast'
import ImageUpload from '../../components/ImageUpload'


// Produce fallback image catalog by produce title / category
const PRODUCE_FALLBACK_IMAGES = {
  'Tomato': 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
  'Onion': 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=800&q=80',
  'Potato': 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=800&q=80',
  'Beans': 'https://images.unsplash.com/photo-1551893665-f843f600794e?auto=format&fit=crop&w=800&q=80',
  'Wheat': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
  'Rice': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
  'Cotton': 'https://images.unsplash.com/photo-1606041008023-472dfb5e530f?auto=format&fit=crop&w=800&q=80',
  'Sugarcane': 'https://images.unsplash.com/photo-1594489428504-5c0c480a15fd?auto=format&fit=crop&w=800&q=80',
  'Carrot': 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=800&q=80',
  'Chilli': 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=800&q=80'
}

const getDefaultProduceImage = (title, category) => {
  if (!title && !category) return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80'
  const matchedKey = Object.keys(PRODUCE_FALLBACK_IMAGES).find(k =>
    (title && title.toLowerCase().includes(k.toLowerCase())) ||
    (category && category.toLowerCase().includes(k.toLowerCase()))
  )
  return matchedKey ? PRODUCE_FALLBACK_IMAGES[matchedKey] : 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80'
}

const extractImages = (rawImages) => {
  if (!rawImages) return []
  if (Array.isArray(rawImages)) {
    return rawImages.map(img => (typeof img === 'string' ? img : img?.url || '')).filter(Boolean)
  }
  if (typeof rawImages === 'string') {
    try {
      let parsed = JSON.parse(rawImages)
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed) } catch (_) {}
      }
      if (Array.isArray(parsed)) {
        return parsed.map(img => (typeof img === 'string' ? img : img?.url || '')).filter(Boolean)
      }
      if (typeof parsed === 'string' && (parsed.startsWith('http') || parsed.startsWith('data:') || parsed.startsWith('/'))) {
        return [parsed]
      }
    } catch {
      if (rawImages.includes(',')) {
        return rawImages.split(',').map(s => s.trim()).filter(Boolean)
      }
      if (rawImages.startsWith('http') || rawImages.startsWith('data:') || rawImages.startsWith('/')) {
        return [rawImages]
      }
    }
  }
  return []
}

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
  const [uploadedImages, setUploadedImages] = useState([])
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
  const [myLiveSessions, setMyLiveSessions] = useState([])
  const [loadingMyLiveSessions, setLoadingMyLiveSessions] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const [selectedProduceModal, setSelectedProduceModal] = useState(null)

  useEffect(() => {
    refreshAll()

    // Auto-refresh every 20 seconds
    const interval = setInterval(() => {
      refreshAll(true)
    }, 20000)

    return () => clearInterval(interval)
  }, [])

  const refreshAll = async (isBackground = false) => {
    if (!isBackground) setRefreshing(true)
    try {
      await Promise.all([
        fetchAPMCs(),
        fetchMyProduce(),
        fetchStats(),
        fetchNotifications(),
        fetchBookingRequests(),
        fetchMyLiveSessions()
      ])
    } finally {
      if (!isBackground) setRefreshing(false)
    }
  }

  const fetchMyLiveSessions = async () => {
    try {
      setLoadingMyLiveSessions(true)
      // Fetch only this farmer's APPROVED booking requests
      const response = await api.get('/auctions/farmer/booking-requests')
      const data = response?.data || response
      if (Array.isArray(data)) {
        // Filter only APPROVED bookings whose sessions are currently LIVE
        const liveApproved = data.filter(req =>
          req.status === 'APPROVED' && req.session && req.session.status === 'LIVE'
        )
        setMyLiveSessions(liveApproved)
      }
    } catch (error) {
      console.error('Failed to fetch my live sessions:', error)
    } finally {
      setLoadingMyLiveSessions(false)
    }
  }

  const fetchAPMCs = async () => {
    try {
      const response = await api.get('/auth/apmcs')
      setApmcs(response?.data || response || [])
    } catch (error) {
      console.error('Failed to fetch APMCs:', error)
    }
  }

  const fetchMyProduce = async () => {
    try {
      const response = await api.get('/auctions/farmer/auctions?limit=100')
      const items = response?.data || response || []
      setMyProduce(Array.isArray(items) ? items : [])
    } catch (error) {
      console.error('Failed to fetch produce:', error)
    }
  }

  const fetchStats = async () => {
    try {
      // 1. Try server dashboard-stats first
      let serverStats = null
      try {
        const statsRes = await api.get('/users/dashboard-stats')
        serverStats = statsRes?.data || statsRes
      } catch (err) {
        console.warn('Direct server stats fetch error, falling back to client computation', err)
      }

      // 2. Also fetch farmer produce list with limit=100 to compute client-side totals
      const response = await api.get('/auctions/farmer/auctions?limit=100')
      const produce = response?.data || response || []
      const produceList = Array.isArray(produce) ? produce : []

      const activeListings = produceList.filter(p => p.status === 'UPCOMING' || p.status === 'LIVE').length
      const liveAuctions = produceList.filter(p => p.status === 'LIVE').length
      const completedAuctions = produceList.filter(p => p.status === 'COMPLETED' || p.status === 'SOLD')
      const soldAuctions = produceList.filter(p => p.status === 'SOLD' || (p.status === 'COMPLETED' && (p.winningBidId || p.winningBid)))
      
      const successRate = produceList.length ? Math.round((soldAuctions.length / produceList.length) * 100) : 0

      // Calculate total earnings from sold and completed auctions
      const localEarnings = produceList.reduce((sum, item) => {
        const isSold = item.status === 'SOLD' || (item.status === 'COMPLETED' && (item.winningBidId || item.winningBid))
        if (!isSold) return sum
        const amount = item.winningBid?.amount || item.currentBid || 0
        return sum + Number(amount)
      }, 0)

      const finalEarnings = serverStats?.totalEarnings ? Math.max(serverStats.totalEarnings, localEarnings) : localEarnings

      setStats({
        activeListings: serverStats?.liveAuctions !== undefined ? (serverStats.totalAuctions - (serverStats.completedAuctions || 0)) : activeListings,
        liveAuctions: serverStats?.liveAuctions !== undefined ? serverStats.liveAuctions : liveAuctions,
        totalEarnings: finalEarnings,
        successRate
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleDeleteProduce = async (produceId, produceTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${produceTitle || 'this produce'}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await api.delete(`/auctions/${produceId}`)
      if (response.success) {
        toast.success(response.message || 'Produce deleted successfully')
        fetchMyProduce()
        fetchStats()
      } else {
        toast.error(response.message || 'Failed to delete produce')
      }
    } catch (error) {
      console.error('Failed to delete produce:', error)
      toast.error(error.response?.data?.message || error.message || 'Failed to delete produce')
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
        images: JSON.stringify(uploadedImages), // Add uploaded images
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
        setUploadedImages([]) // Clear uploaded images
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

  // Handler for image uploads
  const handleImagesUploaded = (imageUrls) => {
    setUploadedImages(imageUrls)
    toast.success(`${imageUrls.length} image(s) uploaded successfully!`)
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
                Welcome back, {user?.name}!
              </h1>
              <p className="text-gray-600 mt-2">
                Manage your produce and track your auctions
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Refresh Button */}
              <button
                onClick={() => refreshAll(false)}
                disabled={refreshing}
                title="Refresh dashboard stats and listings"
                className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 text-green-600 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>

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
            <nav className="-mb-px flex overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-shrink-0 whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'overview'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('produce')}
                className={`flex-shrink-0 whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'produce'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                My Produce
              </button>
              <button
                onClick={() => setActiveTab('auctions')}
                className={`flex-shrink-0 whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'auctions'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Live Auctions
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-shrink-0 whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'history'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                History
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex-shrink-0 whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 relative ${activeTab === 'notifications'
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
                className={`flex-shrink-0 whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'bookings'
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
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
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
                    myProduce.slice(0, 3).map((produce) => {
                      const isSold = produce.status === 'SOLD' || (produce.status === 'COMPLETED' && produce.winningBidId);
                      return (
                        <div key={produce.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                          <div className="flex items-center">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              isSold ? 'bg-emerald-100' :
                              produce.status === 'LIVE' ? 'bg-blue-100' :
                              produce.status === 'COMPLETED' ? 'bg-green-100' : 'bg-yellow-100'
                            }`}>
                              {isSold ? (
                                <CheckCircle className="w-6 h-6 text-emerald-600" />
                              ) : produce.status === 'LIVE' ? (
                                <Clock className="w-6 h-6 text-blue-600" />
                              ) : (
                                <Package className="w-6 h-6 text-yellow-600" />
                              )}
                            </div>
                            <div className="ml-4">
                              <p className="font-medium text-gray-900">{produce.title}</p>
                              <p className="text-sm text-gray-600">
                                {isSold ? `Sold • Winning bid: ₹${produce.winningBid?.amount || produce.currentBid}` :
                                  produce.status === 'LIVE' ? `Live auction • Current Price: ₹${produce.currentBid || produce.basePrice}` :
                                  produce.status === 'COMPLETED' ? `Auction ended • Unsold` :
                                  `Upcoming • Base price: ₹${produce.basePrice}`}
                              </p>
                            </div>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            isSold ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            produce.status === 'LIVE' ? 'bg-blue-100 text-blue-800' :
                            produce.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {isSold ? 'SOLD' : produce.status}
                          </span>
                        </div>
                      );
                    })
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
                    myProduce.map((produce) => {
                      const isSold = produce.status === 'SOLD' || (produce.status === 'COMPLETED' && produce.winningBidId);
                      const isLive = produce.status === 'LIVE';
                      const canDelete = !isSold && !isLive;

                      return (
                        <div key={produce.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
                          <div>
                            {/* Card Image Banner */}
                            {(() => {
                              const photos = extractImages(produce.images);
                              const cardImage = photos.length > 0 ? photos[0] : getDefaultProduceImage(produce.title, produce.category);

                              return (
                                <div className="h-40 w-full overflow-hidden bg-gray-100 relative">
                                  <img
                                    src={cardImage}
                                    alt={produce.title}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = getDefaultProduceImage(produce.title, produce.category);
                                    }}
                                  />
                                  <div className="absolute top-2.5 right-2.5">
                                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm ${
                                      isSold
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : isLive
                                          ? 'bg-blue-100 text-blue-800 animate-pulse'
                                          : produce.status === 'UPCOMING'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {isSold ? 'SOLD' : produce.status}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="p-5">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="text-lg font-bold text-gray-900">{produce.title}</h3>
                                  <p className="text-xs text-gray-500">{produce.category}</p>
                                </div>
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
                            {(produce.currentBid || produce.winningBid) && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">{isSold ? 'Sold Price:' : 'Current Bid:'}</span>
                                  <span className={`font-bold ${isSold ? 'text-emerald-600' : 'text-blue-600'}`}>
                                    ₹{(produce.winningBid?.amount || produce.currentBid)?.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            )}
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between px-5 pb-5">
                            {canDelete ? (
                              <button
                                onClick={() => handleDeleteProduce(produce.id, produce.title)}
                                className="text-sm flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 font-medium px-2.5 py-1.5 rounded-md transition-colors"
                                title="Delete this produce listing"
                              >
                                <Trash2 size={15} />
                                <span>Delete</span>
                              </button>
                            ) : (
                              <span
                                className="text-xs text-gray-400 italic"
                                title={isLive ? 'Active in live auction' : 'Sold items cannot be deleted'}
                              >
                                {isLive ? 'Active in Live' : 'Sold item'}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedProduceModal(produce)}
                              className="text-sm text-green-600 hover:text-green-800 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Details</span>
                              <span>→</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'auctions' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">My Live Auctions</h2>
                  <button
                    onClick={() => navigate('/apmc-schedule')}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center"
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    Browse APMC Schedule
                  </button>
                </div>

                {/* My Produce that is LIVE */}
                {myProduce.filter(p => p.status === 'LIVE').length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">My Produce (Live)</h3>
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
                  </div>
                )}

                {/* Approved & Live Sessions */}
                {loadingMyLiveSessions ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading your live sessions...</p>
                  </div>
                ) : myLiveSessions.length > 0 ? (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">Approved Sessions (Live)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {myLiveSessions.map((booking) => (
                        <div key={booking.id} className="bg-white border-2 border-blue-500 rounded-xl p-5 shadow-md relative overflow-hidden group">
                          <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl">
                            LIVE
                          </div>
                          <h3 className="font-bold text-gray-900 text-lg mb-1">{booking.session?.apmc?.name || booking.apmc?.name}</h3>
                          <p className="text-sm text-gray-500 mb-3 flex items-center">
                            <MapPin size={14} className="mr-1" /> {booking.session?.apmc?.location || booking.apmc?.location}
                          </p>
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Category</span>
                              <span className="font-medium text-gray-900">{booking.session?.category || 'GENERAL'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Status</span>
                              <span className="font-medium text-green-600">Approved ✓</span>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(`/session/${booking.session?.id || booking.sessionId}`)}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                          >
                            Join Live Session
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Empty state when nothing is live */}
                {myProduce.filter(p => p.status === 'LIVE').length === 0 && myLiveSessions.length === 0 && !loadingMyLiveSessions && (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No live auctions</h3>
                    <p className="text-gray-600 mb-4">Your accepted and live auctions will appear here.</p>
                    <button
                      onClick={() => navigate('/apmc-schedule')}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Browse APMC Schedule →
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (() => {
              const historyItems = myProduce.filter(p =>
                p.status === 'SOLD' ||
                p.status === 'COMPLETED' ||
                p.winningBidId ||
                p.winningBid
              );

              const totalEarnedInHistory = historyItems.reduce((acc, p) => {
                const amount = p.winningBid?.amount || p.currentBid || 0;
                return acc + Number(amount);
              }, 0);

              return (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Auction History</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Track all your completed and finalized auctions, winning bids, and lot revenues.
                      </p>
                    </div>
                    {historyItems.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg text-right">
                          <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">Completed Lots</p>
                          <p className="text-lg font-bold text-emerald-900">{historyItems.length}</p>
                        </div>
                        <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-right">
                          <p className="text-xs text-green-700 font-semibold uppercase tracking-wider">Total Realized</p>
                          <p className="text-lg font-bold text-green-900">₹{totalEarnedInHistory.toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {historyItems.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                      <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-bold text-gray-900 mb-2">No auction history yet</h3>
                      <p className="text-gray-500 max-w-md mx-auto mb-6">
                        Once an auction for your produce is completed and won by a buyer, the finalized lot details and winning amount will appear right here.
                      </p>
                      <button
                        onClick={() => setActiveTab('produce')}
                        className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                      >
                        <Package className="w-4 h-4" />
                        View My Produce Listings
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Produce Lot</th>
                              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Base Price</th>
                              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Winning Price</th>
                              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Winner / Buyer</th>
                              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Outcome</th>
                              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed On</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {historyItems.map((item) => {
                              const winningAmount = item.winningBid?.amount || item.currentBid || 0;
                              const isSold = item.status === 'SOLD' || (item.winningBidId || item.winningBid);
                              const winnerName = item.winningBid?.bidder?.name || 'Verified Buyer';

                              return (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm mr-3 border border-emerald-200 flex-shrink-0">
                                        <Package className="w-5 h-5" />
                                      </div>
                                      <div>
                                        <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                                        <p className="text-xs text-gray-500">{item.category} • {item.grade || 'Grade A'}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    <span className="font-medium">{item.quantity}</span> {item.unit || 'kg'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ₹{item.basePrice?.toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    {isSold ? (
                                      <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                        ₹{Number(winningAmount).toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-gray-400 italic">No winning bid</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {isSold ? (
                                      <div className="flex items-center gap-1.5">
                                        <Award className="w-4 h-4 text-amber-500" />
                                        <span className="font-semibold text-gray-900">{winnerName}</span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">Unsold</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                      isSold
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {isSold ? 'SOLD' : 'COMPLETED'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                    {new Date(item.updatedAt || item.createdAt).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3.5 w-3.5 text-gray-400" />
                              <span>{booking.apmc?.location || 'Location not available'}</span>
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
                          <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-700 flex-shrink-0" />
                            <p className="text-sm text-green-800 font-medium">
                              Your booking has been approved! You can now list your produce for auction.
                            </p>
                          </div>
                        )}

                        {booking.status === 'REJECTED' && (
                          <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-700 flex-shrink-0" />
                            <p className="text-sm text-red-800 font-medium">
                              Your booking was rejected. Please contact the APMC for more information.
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
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <Sprout className="h-5 w-5 text-green-600" /> Add New Produce
                </h3>
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
                    <option value="Tomato">Tomato</option>
                    <option value="Onion">Onion</option>
                    <option value="Potato">Potato</option>
                    <option value="Wheat">Wheat</option>
                    <option value="Rice">Rice</option>
                    <option value="Cotton">Cotton</option>
                    <option value="Sugarcane">Sugarcane</option>
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
                        {apmc.name} — {apmc.location}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Images (Optional)
                  </label>
                  <ImageUpload
                    onImagesUploaded={handleImagesUploaded}
                    maxImages={5}
                    uploadType="produce"
                  />
                  {uploadedImages.length > 0 && (
                    <div className="mt-2 text-sm text-green-600">
                      ✓ {uploadedImages.length} image(s) uploaded
                    </div>
                  )}
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
                      <span className="flex items-center justify-center gap-2">
                        <FileText className="h-4 w-4" /> List Produce
                      </span>
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

      {/* Produce Details Modal */}
      {selectedProduceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedProduceModal.title}</h3>
                  <p className="text-xs text-gray-500">ID: {selectedProduceModal.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduceModal(null)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Produce Photos with Auto-Fallback */}
              {(() => {
                const photos = extractImages(selectedProduceModal.images);
                const displayPhotos = photos.length > 0 
                  ? photos 
                  : [getDefaultProduceImage(selectedProduceModal.title, selectedProduceModal.category)];

                return (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Produce Photos</h4>
                      {photos.length === 0 && (
                        <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Standard Quality Reference Photo
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {displayPhotos.map((img, idx) => (
                        <div key={idx} className="h-32 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm relative group">
                          <img
                            src={img}
                            alt={`${selectedProduceModal.title} ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = getDefaultProduceImage(selectedProduceModal.title, selectedProduceModal.category);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Status and Pricing Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">Status</span>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                      selectedProduceModal.status === 'SOLD' ? 'bg-emerald-100 text-emerald-800' :
                      selectedProduceModal.status === 'LIVE' ? 'bg-blue-100 text-blue-800' :
                      selectedProduceModal.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedProduceModal.status}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">Quantity</span>
                  <p className="text-base font-bold text-gray-900 mt-1">{selectedProduceModal.quantity} {selectedProduceModal.unit || 'kg'}</p>
                </div>
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">Base Price</span>
                  <p className="text-base font-bold text-gray-900 mt-1">₹{selectedProduceModal.basePrice?.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100">
                  <span className="text-xs text-emerald-700 font-medium">
                    {selectedProduceModal.status === 'SOLD' ? 'Final Sold Price' : 'Current / Winning'}
                  </span>
                  <p className="text-base font-bold text-emerald-700 mt-1">
                    ₹{(selectedProduceModal.winningBid?.amount || selectedProduceModal.currentBid || selectedProduceModal.basePrice)?.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Specifications */}
              <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Lot Specifications</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-semibold text-gray-800">{selectedProduceModal.category || 'GENERAL'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">Quality Grade:</span>
                    <span className="font-semibold text-gray-800">{selectedProduceModal.grade || 'Grade A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">Pickup Mandi:</span>
                    <span className="font-semibold text-gray-800">{selectedProduceModal.apmc?.name || selectedProduceModal.pickupLocation || 'APMC Yard'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">Auction Scheduled:</span>
                    <span className="font-semibold text-gray-800">
                      {new Date(selectedProduceModal.auctionStartTime).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedProduceModal.description && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Description</h4>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {selectedProduceModal.description}
                  </p>
                </div>
              )}

              {/* Winning Bidder Information if Sold */}
              {selectedProduceModal.winningBid && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" /> Winning Buyer Details
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-amber-700">Buyer Name:</span>
                      <p className="font-bold text-gray-900">{selectedProduceModal.winningBid.bidder?.name || 'Verified Buyer'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-amber-700">Winning Bid Amount:</span>
                      <p className="font-bold text-emerald-700">₹{selectedProduceModal.winningBid.amount?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedProduceModal(null)}
                className="px-5 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FarmerDashboard