import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import FarmerDashboard from './pages/farmer/Dashboard'
import BuyerDashboard from './pages/buyer/Dashboard'
import LiveAuction from './pages/LiveAuction'
import ProduceDetails from './pages/ProduceDetails'
import Profile from './pages/profile/Profile'
import APMCBiddingSchedule from './pages/APMCBiddingSchedule'
import BidHistory from './pages/BidHistory'
import Wallet from './pages/Wallet'
import SessionManagement from './pages/admin/SessionManagement'
import UserStatistics from './pages/admin/UserStatistics'
import LiveBiddingSession from './pages/LiveBiddingSession'
import LiveBidding from './pages/LiveBidding'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 pt-24">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
                <Route path="/farmer/dashboard" element={
                  <ProtectedRoute allowedRoles={['FARMER']}>
                    <FarmerDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/buyer/dashboard" element={
                  <ProtectedRoute allowedRoles={['BUYER']}>
                    <BuyerDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/auction/:produceId" element={
                  <ProtectedRoute allowedRoles={['BUYER', 'FARMER']}>
                    <LiveAuction />
                  </ProtectedRoute>
                } />

                <Route path="/produce/:id" element={
                  <ProtectedRoute allowedRoles={['BUYER', 'FARMER']}>
                    <ProduceDetails />
                  </ProtectedRoute>
                } />

                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />

                <Route path="/apmc-schedule" element={
                  <ProtectedRoute allowedRoles={['BUYER', 'FARMER']}>
                    <APMCBiddingSchedule />
                  </ProtectedRoute>
                } />

                <Route path="/bid-history/:apmcId" element={
                  <ProtectedRoute allowedRoles={['BUYER', 'FARMER']}>
                    <BidHistory />
                  </ProtectedRoute>
                } />

                <Route path="/wallet" element={
                  <ProtectedRoute allowedRoles={['BUYER', 'FARMER']}>
                    <Wallet />
                  </ProtectedRoute>
                } />

                <Route path="/admin/sessions" element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <SessionManagement />
                  </ProtectedRoute>
                } />

                <Route path="/admin/user-statistics" element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <UserStatistics />
                  </ProtectedRoute>
                } />

                <Route path="/session/:sessionId" element={
                  <ProtectedRoute allowedRoles={['BUYER', 'FARMER']}>
                    <LiveBiddingSession />
                  </ProtectedRoute>
                } />

                <Route path="/live-auction/:sessionId" element={<LiveBidding />} />

              </Routes>
            </main>

            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  style: {
                    background: '#10b981',
                  },
                },
                error: {
                  style: {
                    background: '#ef4444',
                  },
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App