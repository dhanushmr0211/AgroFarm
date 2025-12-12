import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Tractor, ShoppingCart, Clock, DollarSign, Users, TrendingUp, ArrowRight, MapPin, Calendar } from 'lucide-react'

const Home = () => {
  const { isAuthenticated, user } = useAuth()

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
      <div className="py-20 bg-earth-900 text-earth-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center divide-x divide-earth-800/50">
            {[
              { val: "1000+", label: "Verified Farmers", icon: <Tractor className="mx-auto mb-4 text-primary-400 opacity-50" size={24} /> },
              { val: "500+", label: "Active Buyers", icon: <ShoppingCart className="mx-auto mb-4 text-primary-400 opacity-50" size={24} /> },
              { val: "₹2Cr+", label: "Trade Volume", icon: <TrendingUp className="mx-auto mb-4 text-primary-400 opacity-50" size={24} /> },
              { val: "50+", label: "Partner APMCs", icon: <MapPin className="mx-auto mb-4 text-primary-400 opacity-50" size={24} /> }
            ].map((stat, idx) => (
              <div key={idx} className="p-4">
                {stat.icon}
                <div className="text-4xl md:text-5xl font-bold text-white mb-2 font-serif">{stat.val}</div>
                <div className="text-primary-200 text-sm uppercase tracking-widest">{stat.label}</div>
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
              View Full Schedule <ArrowRight size={20} className="ml-2" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { city: "Delhi", type: "Tomato", color: "border-l-red-500", time: "10:00 AM", price: "₹2,800" },
              { city: "Mumbai", type: "Onion", color: "border-l-harvest-500", time: "02:00 PM", price: "₹3,200" },
              { city: "Bangalore", type: "Potato", color: "border-l-primary-500", time: "04:00 PM", price: "₹2,600" },
            ].map((item, idx) => (
              <div key={idx} className={`bg-white rounded-2xl p-6 border-l-4 ${item.color} shadow-lg hover:shadow-xl transition-shadow`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-earth-900">{item.city} APMC</h3>
                    <div className="flex items-center text-earth-500 text-sm mt-1">
                      <MapPin size={14} className="mr-1" /> Regulated Market
                    </div>
                  </div>
                  <span className="bg-earth-100 text-earth-700 text-xs font-bold px-3 py-1 rounded-full">{item.time}</span>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between p-3 bg-earth-50 rounded-lg">
                    <span className="text-earth-600 text-sm">Produce</span>
                    <span className="font-semibold text-earth-900">{item.type}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-earth-50 rounded-lg">
                    <span className="text-earth-600 text-sm">Last Closing</span>
                    <span className="font-semibold text-primary-700">{item.price}/qtl</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button className="col-span-2 w-full bg-earth-900 text-white py-3 rounded-xl hover:bg-black transition-colors font-medium">
                    Book Spot
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 md:hidden">
            <Link
              to="/apmc-schedule"
              className="inline-flex items-center text-primary-700 font-semibold hover:text-primary-800 transition-colors"
            >
              View Full Schedule <ArrowRight size={20} className="ml-2" />
            </Link>
          </div>
        </div>
      </div>

      {/* Modern footer */}
      <footer className="bg-white border-t border-earth-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <span className="text-2xl">🌾</span>
              <span className="text-xl font-bold font-serif text-earth-900">FarmerBid</span>
            </div>
            <div className="text-earth-500 text-sm">
              © 2024 Farmer Bidding Platform. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home