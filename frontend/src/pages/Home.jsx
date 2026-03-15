import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Tractor, ShoppingCart, Clock, DollarSign, Users, TrendingUp, ArrowRight, MapPin, Calendar } from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'

const Home = () => {
  const { isAuthenticated, user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      setLoading(true)
      const response = await api.get('/sessions')

      if (response.success && response.data) {
        // Filter only SCHEDULED and LIVE sessions for the home page
        const activeSessions = response.data.filter(
          session => session.status === 'SCHEDULED' || session.status === 'LIVE'
        )
        // Show only first 3 sessions
        setSessions(activeSessions.slice(0, 3))
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'LIVE': return 'bg-green-100 text-green-700'
      case 'SCHEDULED': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="min-h-screen bg-earth-50">
      {/* Hero Section */}
      <div className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105 animate-slow-zoom"
          style={{ backgroundImage: "url('/hero-bg.png')" }}
        ></div>

        {/* Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-3xl animate-fade-in-up">
            <span className="inline-block py-1 px-3 rounded-full bg-primary-500/20 backdrop-blur-sm border border-primary-400/30 text-primary-200 text-sm font-medium mb-6">
              🌱 Revolutionizing Agriculture
            </span>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-lg font-serif">
              Cultivating Trust,<br />
              <span className="text-primary-400">Harvesting Success</span>
            </h1>
            <p className="text-xl text-gray-200 mb-10 leading-relaxed font-light max-w-2xl">
              The premium marketplace connecting India's finest farmers with direct buyers.
              Experience transparent auctions, secure payments, and real-time market data.
            </p>

            {!isAuthenticated ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="group bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-primary-900/30 flex items-center justify-center"
                >
                  <Tractor className="mr-2 group-hover:rotate-12 transition-transform" size={24} />
                  Join as Farmer
                </Link>
                <Link
                  to="/register"
                  className="group bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all flex items-center justify-center"
                >
                  <ShoppingCart className="mr-2 group-hover:-rotate-12 transition-transform" size={24} />
                  Join as Buyer
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="text-white text-lg mr-4 font-light">
                  Welcome back, <span className="font-semibold text-primary-300">{user?.name}</span>
                </div>
                <Link
                  to={user?.role === 'FARMER' ? '/farmer/dashboard' : '/buyer/dashboard'}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-primary-900/30 flex items-center"
                >
                  Go to Dashboard <ArrowRight className="ml-2" size={20} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-earth-900 mb-6 font-serif">
              Why Premier Farmers Choose Us
            </h2>
            <p className="text-xl text-earth-600 font-light">
              Built on the pillars of transparency, speed, and reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                icon: <Clock size={32} />,
                title: "Live Bidding",
                desc: "Real-time auctions with millisecond latencies for fair play.",
                color: "bg-primary-50 text-primary-600"
              },
              {
                icon: <DollarSign size={32} />,
                title: "Secure Escrow",
                desc: "Payments are held safely until produce delivery is confirmed.",
                color: "bg-harvest-50 text-harvest-600"
              },
              {
                icon: <Users size={32} />,
                title: "APMC Network",
                desc: "Direct integration with 50+ regulated market committees.",
                color: "bg-earth-100 text-earth-600"
              }
            ].map((feature, idx) => (
              <div key={idx} className="group p-8 rounded-3xl bg-white border border-earth-100 hover:border-primary-200 shadow-sm hover:shadow-2xl hover:shadow-primary-900/5 transition-all duration-300 transform hover:-translate-y-2">
                <div className={`${feature.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-earth-900 mb-3 font-serif">
                  {feature.title}
                </h3>
                <p className="text-earth-600 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center divide-x divide-gray-200">
            {[
              { val: "1000+", label: "Verified Farmers", icon: <Tractor className="mx-auto mb-4 text-green-600" size={24} /> },
              { val: "500+", label: "Active Buyers", icon: <ShoppingCart className="mx-auto mb-4 text-green-600" size={24} /> },
              { val: "₹2Cr+", label: "Trade Volume", icon: <TrendingUp className="mx-auto mb-4 text-green-600" size={24} /> },
              { val: "50+", label: "Partner APMCs", icon: <MapPin className="mx-auto mb-4 text-green-600" size={24} /> }
            ].map((stat, idx) => (
              <div key={idx} className="p-4">
                {stat.icon}
                <div className="text-4xl md:text-5xl font-bold text-black mb-2 font-serif">{stat.val}</div>
                <div className="text-gray-600 text-sm uppercase tracking-widest font-medium">{stat.label}</div>
              </div>
            ))}

          </div>
        </div>
      </div>

      {/* Schedule Preview */}
      <div className="py-24 bg-earth-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 className="text-3xl font-bold text-earth-900 mb-2 font-serif">Today's Live Sessions</h2>
              <p className="text-earth-600">Upcoming auctions at major APMC centers</p>
            </div>
            <Link
              to="/apmc-schedule"
              className="hidden md:flex items-center text-primary-700 font-semibold hover:text-primary-800 transition-colors"
            >
              View All Sessions <ArrowRight size={20} className="ml-2" />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-20">
              <Calendar size={48} className="mx-auto text-earth-300 mb-4" />
              <p className="text-earth-600 text-lg">No active sessions at the moment</p>
              <p className="text-earth-500 text-sm mt-2">Check back later for upcoming auctions</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {sessions.map((session) => (
                <div key={session.id} className="bg-white rounded-2xl p-6 border-l-4 border-l-primary-500 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-earth-900">{session.apmc?.name || 'APMC'}</h3>
                      <div className="flex items-center text-earth-500 text-sm mt-1">
                        <MapPin size={14} className="mr-1" /> {session.apmc?.location || 'Location'}
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusColor(session.status)}`}>
                      {session.status}
                    </span>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between p-3 bg-earth-50 rounded-lg">
                      <span className="text-earth-600 text-sm">Category</span>
                      <span className="font-semibold text-earth-900">{session.category}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-earth-50 rounded-lg">
                      <span className="text-earth-600 text-sm">Start Time</span>
                      <span className="font-semibold text-primary-700">{formatTime(session.startTime)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-earth-50 rounded-lg">
                      <span className="text-earth-600 text-sm">End Time</span>
                      <span className="font-semibold text-earth-700">{formatTime(session.endTime)}</span>
                    </div>
                  </div>

                  {session.status === 'LIVE' && (
                    <Link
                      to={`/live-bidding/${session.id}`}
                      className="block w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition-colors font-medium text-center"
                    >
                      Join Live Auction
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-12 md:hidden">
            <Link
              to="/apmc-schedule"
              className="inline-flex items-center text-primary-700 font-semibold hover:text-primary-800 transition-colors"
            >
              View All Sessions <ArrowRight size={20} className="ml-2" />
            </Link>
          </div>
        </div>
      </div>

      {/* Modern footer */}
      <footer className="bg-gray-900 border-t-4 border-green-600 pt-20 pb-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🌾</span>
              <span className="text-2xl font-bold font-serif text-white">FarmerBid</span>
            </div>
            <div className="text-gray-300 text-base font-medium">
              © 2024 Farmer Bidding Platform. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home