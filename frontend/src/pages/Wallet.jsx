import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { CreditCard, Plus, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle } from 'lucide-react';

// Dynamically load Razorpay script only when needed
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Wallet = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [addAmount, setAddAmount] = useState('');

  // Real wallet data from API
  const [walletBalance, setWalletBalance] = useState(0);
  const [escrowBalance, setEscrowBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [escrowTransactions, setEscrowTransactions] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      // Fetch wallet balance
      const walletResponse = await api.get('/wallet');

      // Fetch transaction history
      const transactionsResponse = await api.get('/wallet/transactions');

      // Fetch escrow details
      const escrowResponse = await api.get('/wallet/escrow');

      if (walletResponse.success) {
        setWalletBalance(walletResponse.data?.balance || 0);
        setEscrowBalance(walletResponse.data?.escrowBalance || 0);
      }

      if (transactionsResponse.success) {
        setTransactions(transactionsResponse.data || []);
      }

      if (escrowResponse.success) {
        setEscrowTransactions(escrowResponse.data || []);
      }

    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
      // Set defaults if API fails
      setWalletBalance(0);
      setEscrowBalance(0);
      setTransactions([]);
      setEscrowTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    if (!addAmount || addAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      // Load Razorpay script dynamically
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        alert('Failed to load payment gateway. Please check your internet connection and try again.');
        return;
      }

      // Create Razorpay order
      const orderResponse = await api.post('/payments/create-order', {
        amount: parseInt(addAmount),
        currency: 'INR',
        receipt: `wallet_topup_${Date.now()}`
      });

      if (!orderResponse.success) {
        throw new Error('Failed to create payment order');
      }

      const { data: order } = orderResponse;

      // Common verification handler
      const handlePaymentVerification = async (response) => {
        try {
          // Verify payment on backend
          const verifyResponse = await api.post('/payments/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            type: 'WALLET_TOPUP',
            amount: order.amount
          });

          if (verifyResponse.success) {
            alert('Payment successful! Your wallet has been credited.');
            setShowAddFundsModal(false);
            setAddAmount('');
            fetchWalletData(); // Refresh wallet data
          } else {
            alert('Payment verification failed. Please contact support.');
          }
        } catch (error) {
          console.error('Payment verification error:', error);
          alert('Payment verification failed. Please contact support.');
        }
      };

      // Razorpay checkout options
      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        alert('Configuration Error: VITE_RAZORPAY_KEY_ID is missing in frontend .env');
        return;
      }

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Farmer Bidding Platform',
        description: 'Wallet Top-up',
        order_id: order.id,
        handler: handlePaymentVerification,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#16a34a' // Green theme matching your platform
        },
        modal: {
          ondismiss: function () {
            console.log('Payment modal closed');
          }
        }
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Add funds error:', error);
      alert('Failed to initiate payment. Please try again.');
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'credit':
        return <ArrowDownLeft className="text-green-500" size={20} />;
      case 'debit':
        return <ArrowUpRight className="text-red-500" size={20} />;
      case 'escrow':
        return <Clock className="text-yellow-500" size={20} />;
      default:
        return <CreditCard className="text-gray-500" size={20} />;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            💳 Digital Wallet
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your funds and track all transactions
          </p>
        </div>

        {/* Wallet Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Available Balance</p>
                <p className="text-3xl font-bold">₹{walletBalance.toLocaleString()}</p>
              </div>
              <CreditCard size={40} className="text-green-200" />
            </div>
            <button
              onClick={() => setShowAddFundsModal(true)}
              className="mt-4 bg-white text-green-600 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors font-medium"
            >
              + Add Funds
            </button>
          </div>

          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100">Escrow Balance</p>
                <p className="text-3xl font-bold">₹{escrowBalance.toLocaleString()}</p>
              </div>
              <Clock size={40} className="text-yellow-200" />
            </div>
            <p className="mt-4 text-sm text-yellow-100">
              Funds held for quality verification
            </p>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Transactions</p>
                <p className="text-3xl font-bold">{transactions.length}</p>
              </div>
              <ArrowUpRight size={40} className="text-blue-200" />
            </div>
            <p className="mt-4 text-sm text-blue-100">
              This month
            </p>
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
                onClick={() => setActiveTab('transactions')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'transactions'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                All Transactions
              </button>
              <button
                onClick={() => setActiveTab('escrow')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'escrow'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Escrow Funds
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Transactions</h3>
                <div className="space-y-4">
                  {transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <p className="font-medium text-gray-900">{transaction.description}</p>
                          <p className="text-sm text-gray-500">{transaction.date} at {transaction.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                        </p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getTransactionIcon(transaction.type)}
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {transaction.description}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{transaction.date}</div>
                            <div className="text-sm text-gray-500">{transaction.time}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                              }`}>
                              {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(transaction.status)}`}>
                              {transaction.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'escrow' && (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Funds in Escrow</h3>
                  <p className="text-sm text-gray-600">
                    These funds are held securely until delivery confirmation and quality verification.
                  </p>
                </div>
                <div className="space-y-4">
                  {escrowTransactions.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                      <Clock className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No active escrow transactions</p>
                      <p className="text-sm text-gray-400">Funds held during active auctions will appear here</p>
                    </div>
                  ) : (
                    escrowTransactions.map((escrow) => (
                      <div key={escrow.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{escrow.description || `Escrow #${escrow.id.slice(-6)}`}</h4>
                            <p className="text-sm text-gray-600">Status: <span className="font-semibold capitalize">{escrow.status}</span></p>
                            <p className="text-sm text-gray-600">Created: {new Date(escrow.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-yellow-600">₹{escrow.amount.toLocaleString()}</p>
                            <button className="mt-2 text-sm text-blue-600 hover:text-blue-800">
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">💰 Add Funds to Wallet</h3>
                <button
                  onClick={() => setShowAddFundsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter amount"
                    min="100"
                    max="50000"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum: ₹100, Maximum: ₹50,000</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[1000, 5000, 10000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setAddAmount(amount.toString())}
                      className="border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50"
                    >
                      ₹{amount}
                    </button>
                  ))}
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Payment Methods:</h4>
                  <div className="space-y-1 text-xs text-blue-800">
                    <div>• UPI (Google Pay, PhonePe, Paytm)</div>
                    <div>• Credit/Debit Cards</div>
                    <div>• Net Banking</div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleAddFunds}
                    disabled={!addAmount || parseInt(addAmount) < 100}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Proceed to Payment
                  </button>
                  <button
                    onClick={() => setShowAddFundsModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;