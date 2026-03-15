import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';
import { toast } from 'react-hot-toast';
import { Camera, Eye, Trash2, X } from 'lucide-react';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    location: '',
    dateJoined: '',
    profilePicture: null,
    bio: '',
    company: '',
    gstNumber: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: ''
    },
    bankDetails: {
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      accountHolderName: ''
    },
    preferences: {
      notifications: {
        email: true,
        sms: true,
        push: true,
        auctionUpdates: true,
        priceAlerts: true,
        marketingEmails: false
      },
      privacy: {
        profileVisibility: 'public',
        showContactInfo: false,
        showTransactionHistory: false
      }
    }
  });

  const [statsData, setStatsData] = useState({
    totalTransactions: 0,
    successRate: '0%',
    memberSince: '',
    rating: '0⭐',
    // Admin-specific stats
    totalSessions: 0,
    completedSessions: 0,
    cancelledSessions: 0,
    highestBid: '₹0'
  });

  const [transactions, setTransactions] = useState([]);
  const fileInputRef = useRef(null);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);

      toast.loading('Uploading profile picture...');

      const response = await api.post('/upload/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.dismiss();

      if (response.success && response.data?.url) {
        // Update local state
        setFormData(prev => ({ ...prev, profilePicture: response.data.url }));

        // Update profile in database
        await api.put('/users/profile', { profileImage: response.data.url });

        toast.success('Profile picture updated successfully!');
      } else {
        toast.error('Failed to upload profile picture');
      }
    } catch (error) {
      toast.dismiss();
      console.error('Profile picture upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload profile picture');
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!formData.profilePicture) {
      toast.error('No profile picture to remove');
      return;
    }

    try {
      // Update profile in database to remove image
      await api.put('/users/profile', { profileImage: null });

      // Update local state
      setFormData(prev => ({ ...prev, profilePicture: null }));

      toast.success('Profile picture removed successfully!');
    } catch (error) {
      console.error('Remove profile picture error:', error);
      toast.error('Failed to remove profile picture');
    }
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);

      // 1. Fetch User Profile
      const profileRes = await api.get('/users/profile');
      if (profileRes.success) {
        const user = profileRes.data;
        // Parse address if stored as JSON or string, otherwise default
        let addr = { street: '', city: '', state: '', pincode: '', country: '' };
        try {
          if (user.address && typeof user.address === 'string' && user.address.startsWith('{')) {
            addr = JSON.parse(user.address);
          } else if (user.address) {
            addr = { ...addr, street: user.address }; // Fallback
          }
        } catch (e) { }

        setFormData(prev => ({
          ...prev,
          firstName: user.name?.split(' ')[0] || '',
          lastName: user.name?.split(' ').slice(1).join(' ') || '',
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          location: user.apmc?.location || 'Unknown',
          dateJoined: new Date(user.createdAt).getFullYear().toString(),
          profilePicture: user.profileImage,
          bio: user.bio || '',
          company: user.companyName || '',
          gstNumber: user.gstNumber || '',
          address: addr
        }));

        // Update member since stat
        setStatsData(prev => ({
          ...prev,
          memberSince: new Date(user.createdAt).getFullYear().toString()
        }));
      }

      // 2. Fetch Dashboard Stats
      const statsRes = await api.get('/users/dashboard-stats');
      if (statsRes.success) {
        const s = statsRes.data;
        // Calculate success (won / total bids for buyer, or sales for farmer)
        let total = 0;
        let success = 0;

        if (s.totalSessions !== undefined) {
          // Admin stats
          setStatsData(prev => ({
            ...prev,
            totalSessions: s.totalSessions,
            completedSessions: s.completedSessions,
            cancelledSessions: s.cancelledSessions,
            highestBid: s.highestBid ? `₹${s.highestBid.toLocaleString()}` : '₹0'
          }));
        } else {
          // Farmer/Buyer stats
          let total = 0;
          let success = 0;

          if (s.totalBids !== undefined) {
            total = s.totalBids;
            success = s.wonBids;
          } else if (s.totalAuctions !== undefined) {
            total = s.totalAuctions;
            success = s.completedAuctions;
          }

          const rate = total > 0 ? Math.round((success / total) * 100) : 0;

          setStatsData(prev => ({
            ...prev,
            totalTransactions: total,
            successRate: `${rate}%`
          }));
        }
      }

      // 3. Fetch Transactions (Orders)
      const ordersRes = await api.get('/users/orders');
      if (ordersRes.success) {
        setTransactions(ordersRes.data || []);
      }

    } catch (error) {
      console.error('Error fetching profile data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleNestedInputChange = (parent, child, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [child]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      // Construct payload matching backend expectation
      const payload = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone,
        address: JSON.stringify(formData.address),
        bio: formData.bio,
        companyName: formData.company,
        gstNumber: formData.gstNumber
      };

      const res = await api.put('/users/profile', payload);
      if (res.success) {
        toast.success('Profile updated successfully!');
        setIsEditing(false);
        fetchProfileData(); // Refresh
      }
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'CONFIRMED': 'bg-green-100 text-green-800',
      'DELIVERED': 'bg-blue-100 text-blue-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'CANCELLED': 'bg-red-100 text-red-800',
      'SHIPPED': 'bg-purple-100 text-purple-800'
    };
    return statusConfig[status] || 'bg-gray-100 text-gray-800';
  };

  const stats = formData.role === 'ADMIN' ? [
    { title: 'Total Sessions Created', value: statsData.totalSessions, icon: '📊', color: 'bg-blue-500' },
    { title: 'Completed Sessions', value: statsData.completedSessions, icon: '✅', color: 'bg-green-500' },
    { title: 'Cancelled Sessions', value: statsData.cancelledSessions, icon: '🚫', color: 'bg-red-500' },
    { title: 'Highest Winning Bid', value: statsData.highestBid, icon: '💰', color: 'bg-yellow-500' }
  ] : [
    { title: 'Total Transactions', value: statsData.totalTransactions, icon: '📊', color: 'bg-blue-500' },
    { title: 'Success Rate', value: statsData.successRate, icon: '🎯', color: 'bg-green-500' },
    { title: 'Member Since', value: statsData.memberSince, icon: '📅', color: 'bg-purple-500' },
    { title: 'Rating', value: statsData.rating, icon: '⭐', color: 'bg-orange-500' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex items-center space-x-6">
            <div className="relative group">
              <img
                src={formData.profilePicture || `https://ui-avatars.com/api/?name=${formData.firstName}+${formData.lastName}`}
                alt="Profile"
                className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureUpload}
                className="hidden"
              />

              {/* Action buttons - show on hover */}
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {formData.profilePicture && (
                  <>
                    <button
                      onClick={() => setShowImageModal(true)}
                      className="bg-white text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors shadow-lg"
                      title="View profile picture"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={handleRemoveProfilePicture}
                      className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors shadow-lg"
                      title="Remove profile picture"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 transition-colors shadow-lg"
                  title="Upload profile picture"
                >
                  <Camera size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {formData.firstName} {formData.lastName}
              </h1>
              <p className="text-gray-600 mt-1">{formData.email}</p>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${formData.role === 'FARMER' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                  {formData.role}
                </span>
                <span className="text-gray-600">📍 {formData.location}</span>
                <span className="text-gray-600">📅 Member since {formData.dateJoined}</span>
              </div>
            </div>
            <div>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>
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
            <nav className="flex space-x-8 px-6 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} aria-label="Tabs">
              {[
                { id: 'personal', name: 'Personal Info', icon: '👤' },
                { id: 'business', name: 'Business Details', icon: '🏢' },
                { id: 'security', name: 'Security', icon: '🔒' },
                { id: 'preferences', name: 'Preferences', icon: '⚙️' },
                { id: 'transactions', name: 'Transaction History', icon: '📊' }
              ].filter(tab => formData.role !== 'ADMIN' || tab.id !== 'transactions')
                .map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.name}</span>
                  </button>
                ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Personal Info Tab */}
            {activeTab === 'personal' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Address</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                      <input
                        type="text"
                        name="address.street"
                        value={formData.address.street}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        name="address.city"
                        value={formData.address.city}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        name="address.state"
                        value={formData.address.state}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                      <input
                        type="text"
                        name="address.pincode"
                        value={formData.address.pincode}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <input
                        type="text"
                        name="address.country"
                        value={formData.address.country}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Business Details Tab */}
            {activeTab === 'business' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Business Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Bank Details</h4>
                  {/* Bank details could typically also be fetched from API if they exist in DB, for now they are state managed */}
                  <p className="text-sm text-gray-500 italic">Bank details integration coming soon.</p>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-yellow-600 mr-2">⚠️</span>
                    <span className="text-yellow-800">Keep your account secure by regularly updating your password</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Confirm new password"
                    />
                  </div>
                  <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    Update Password
                  </button>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                {/* Preserved existing preference UI */}
                <p className="text-sm text-gray-500 italic">Preference settings are currently simplified.</p>
              </div>
            )}

            {/* Transaction History Tab */}
            {activeTab === 'transactions' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
                </div>

                {transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#{tx.id.slice(-6)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{tx.produce?.title}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">₹{tx.bid?.amount?.toLocaleString()}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(tx.status)}`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button className="text-green-600 hover:text-green-900 mr-3">View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500">No transactions found.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Image View Modal */}
        {showImageModal && formData.profilePicture && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4" onClick={() => setShowImageModal(false)}>
            <div className="relative max-w-4xl max-h-screen" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute -top-12 right-0 bg-white text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors shadow-lg"
                title="Close"
              >
                <X size={24} />
              </button>
              <img
                src={formData.profilePicture}
                alt="Profile Picture"
                className="max-w-full max-h-screen rounded-lg shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;