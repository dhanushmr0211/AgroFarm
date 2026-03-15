import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Wallet, Bell, User, LogOut, Menu, X, ChevronDown, Sprout } from 'lucide-react'
import { useState, useEffect } from 'react'

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const getDashboardLink = () => {
    if (user?.role === 'FARMER') return '/farmer/dashboard'
    if (user?.role === 'BUYER') return '/buyer/dashboard'
    return '/'
  }

  const isActivePath = (path) => location.pathname === path

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
        ? 'bg-white/80 backdrop-blur-md shadow-glass py-2'
        : 'bg-white py-4'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className={`p-2 rounded-xl transition-colors ${isScrolled ? 'bg-primary-100' : 'bg-primary-50'} group-hover:bg-primary-100`}>
              <Sprout className="text-primary-600 w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold font-serif text-earth-900 tracking-tight leading-none group-hover:text-primary-700 transition-colors">
                FarmerBid
              </span>
              <span className="text-xs text-primary-600 font-medium tracking-wider uppercase">Direct Trade</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {isAuthenticated ? (
              <>
                <Link
                  to={getDashboardLink()}
                  className={`text-sm font-medium transition-colors hover:text-primary-600 ${isActivePath(getDashboardLink()) ? 'text-primary-600' : 'text-earth-600'
                    }`}
                >
                  Dashboard
                </Link>

                {user?.role === 'ADMIN' ? (
                  <Link
                    to="/admin/sessions"
                    className={`text-sm font-medium transition-colors hover:text-primary-600 ${isActivePath('/admin/sessions') ? 'text-primary-600' : 'text-earth-600'
                      }`}
                  >
                    Session Management
                  </Link>
                ) : (
                  <Link
                    to="/apmc-schedule"
                    className={`text-sm font-medium transition-colors hover:text-primary-600 ${isActivePath('/apmc-schedule') ? 'text-primary-600' : 'text-earth-600'
                      }`}
                  >
                    APMC Schedule
                  </Link>
                )}

                {user?.role !== 'ADMIN' && (
                  <Link
                    to="/wallet"
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full transition-all ${isActivePath('/wallet')
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-earth-600 hover:bg-earth-50'
                      }`}
                  >
                    <Wallet size={16} />
                    <span className="text-sm">Wallet</span>
                  </Link>
                )}

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center space-x-2 text-earth-700 hover:text-primary-700 transition-colors focus:outline-none"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                      {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{user?.name}</span>
                    <ChevronDown size={14} className={`text-earth-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown */}
                  {isProfileMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsProfileMenuOpen(false)}
                      ></div>
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-earth-100 z-20 animate-fade-in-up">
                        <div className="py-2">
                          <div className="px-4 py-2 border-b border-earth-50 mb-1">
                            <p className="text-xs text-earth-400 font-medium uppercase tracking-wider">Signed in as</p>
                            <p className="text-sm font-bold text-earth-900 truncate">{user?.email}</p>
                          </div>
                          <Link
                            to="/profile"
                            className="flex items-center space-x-2 px-4 py-2.5 text-sm text-earth-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                            onClick={() => setIsProfileMenuOpen(false)}
                          >
                            <User size={16} />
                            <span>Profile</span>
                          </Link>
                          <button
                            onClick={() => {
                              handleLogout()
                              setIsProfileMenuOpen(false)
                            }}
                            className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                          >
                            <LogOut size={16} />
                            <span>Sign out</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-sm font-semibold text-earth-600 hover:text-primary-700 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-600 text-white hover:bg-primary-700 px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-600/40 transform hover:-translate-y-0.5"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-earth-600 hover:bg-earth-50 transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-earth-100 py-4 absolute top-full left-0 right-0 bg-white shadow-xl animate-fade-in-down">
            <div className="px-4 space-y-3">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center space-x-3 px-3 py-3 bg-earth-50 rounded-xl mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
                      {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-earth-900">{user?.name}</p>
                      <p className="text-xs text-earth-500">{user?.role}</p>
                    </div>
                  </div>

                  <Link
                    to={getDashboardLink()}
                    className="block px-3 py-2 text-base font-medium text-earth-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  {user?.role === 'ADMIN' ? (
                    <Link
                      to="/admin/sessions"
                      className="block px-3 py-2 text-base font-medium text-earth-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Session Management
                    </Link>
                  ) : (
                    <Link
                      to="/apmc-schedule"
                      className="block px-3 py-2 text-base font-medium text-earth-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      APMC Schedule
                    </Link>
                  )}
                  {user?.role !== 'ADMIN' && (
                    <Link
                      to="/wallet"
                      className="block px-3 py-2 text-base font-medium text-earth-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Wallet
                    </Link>
                  )}
                  <Link
                    to="/profile"
                    className="block px-3 py-2 text-base font-medium text-earth-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout()
                      setIsMobileMenuOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="block w-full text-center px-4 py-3 text-earth-700 font-medium border border-earth-200 rounded-xl hover:bg-earth-50 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    className="block w-full text-center px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar