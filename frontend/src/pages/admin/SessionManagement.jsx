import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Plus,
  X,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Eye,
  BarChart3,
  Trash2
} from 'lucide-react';
import api from '../../api';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

const SessionManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [apmcs, setApmcs] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [newSession, setNewSession] = useState({
    title: '',
    apmcId: '',
    date: '',
    time: '',
    duration: '60',
    maxParticipants: '50',
    description: ''
  });

  useEffect(() => {
    fetchSessions();
    fetchApmcs();
    fetchBookingRequests();
  }, []);

  const fetchSessions = async () => {
    try {
      const data = await api.get('/auctions/sessions');
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to fetch sessions');
    }
  };

  const fetchApmcs = async () => {
    try {
      const data = await api.get('/auctions/apmcs');
      setApmcs(data);
    } catch (error) {
      console.error('Error fetching APMCs:', error);
      toast.error('Failed to fetch APMCs');
    }
  };

  const fetchBookingRequests = async () => {
    try {
      const data = await api.get('/auctions/booking-requests');
      setBookingRequests(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching booking requests:', error);
      toast.error('Failed to fetch booking requests');
      setLoading(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();

    if (!newSession.title || !newSession.apmcId || !newSession.date || !newSession.time) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Create datetime in local timezone instead of forcing UTC
      const localDateTime = new Date(`${newSession.date}T${newSession.time}:00`);

      console.log('Creating session with:');
      console.log('Selected date/time:', `${newSession.date} ${newSession.time}`);
      console.log('Local DateTime object:', localDateTime);
      console.log('Sending ISO string:', localDateTime.toISOString());

      const sessionData = {
        ...newSession,
        dateTime: localDateTime.toISOString(),
        maxParticipants: parseInt(newSession.maxParticipants),
        duration: parseInt(newSession.duration)
      };

      const response = await api.post('/auctions/sessions', sessionData);

      // api interceptor returns data directly, but we check if we have data/success
      if (response) {
        toast.success('Auction session created successfully!');
        setSessions([...sessions, response]); // assuming response is the new session object or contains it
        setShowCreateModal(false);
        setNewSession({
          title: '',
          apmcId: '',
          date: '',
          time: '',
          duration: '60',
          maxParticipants: '50',
          description: ''
        });
      }
    } catch (error) {
      console.error('Error creating session:', error);
      const msg = error.response?.data?.message || 'Failed to create session';
      toast.error(msg);
    }
  };

  const handleBookingAction = async (requestId, action) => {
    try {
      const status = action === 'approve' ? 'APPROVED' : 'REJECTED';

      await api.patch(`/auctions/booking-requests/${requestId}`, {
        status: status
      });

      toast.success(`Booking request ${action}d successfully`);
      fetchBookingRequests();
    } catch (error) {
      console.error(`Error ${action}ing booking request:`, error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.message || `Failed to ${action} booking request`);
    }
  };

  const handleDismissSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    const action = session?.status === 'LIVE' ? 'end' : 'cancel';
    const actionText = session?.status === 'LIVE' ? 'end this session early' : 'cancel this session';

    if (!window.confirm(`Are you sure you want to ${actionText}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await api.patch(`/auctions/sessions/${sessionId}/dismiss`);
      toast.success(response.message || `Session ${action}ed successfully`);
      fetchSessions(); // Refresh the sessions list
    } catch (error) {
      console.error('Error dismissing session:', error);
      toast.error(error.response?.data?.message || `Failed to ${action} session`);
    }
  };

  const clearNonLiveSessions = async () => {
    if (!window.confirm('Are you sure you want to clear all scheduled, completed, and cancelled sessions? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete('/auctions/admin/sessions/clear-non-live');
      toast.success(response.message || 'Non-live sessions cleared successfully');
      fetchSessions(); // Refresh the sessions list
    } catch (error) {
      console.error('Error clearing non-live sessions:', error);
      toast.error(error.response?.data?.message || 'Failed to clear non-live sessions');
    }
  };

  const clearProcessedRequests = async () => {
    if (!window.confirm('Are you sure you want to clear all approved and rejected booking requests? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete('/auctions/admin/booking-requests/clear-processed');
      toast.success(response.message || 'Processed booking requests cleared successfully');
      fetchBookingRequests(); // Refresh the booking requests list
    } catch (error) {
      console.error('Error clearing processed requests:', error);
      toast.error(error.response?.data?.message || 'Failed to clear processed requests');
    }
  };

  const filteredSessions = sessions.filter(session => {
    const matchesFilter = filter === 'all' || session.status === filter;
    const sessionTitle = session.title || '';
    const apmcName = session.apmc?.name || '';

    const matchesSearch = sessionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apmcName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredBookingRequests = bookingRequests.filter(request => {
    const matchesFilter = filter === 'all' || request.status === filter;
    const matchesSearch = request.farmer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.apmc?.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🏛️ Session Management</h1>
          <p className="text-gray-600 mt-2">Manage auction sessions and booking requests</p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/admin/user-statistics"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
            <span>User Statistics</span>
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Session</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search sessions or APMCs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">📅 Auction Sessions</h2>
          <button
            onClick={clearNonLiveSessions}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            title="Clear all scheduled, completed, and cancelled sessions (preserves live sessions)"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Non-Live</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">APMC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{session.title}</div>
                      <div className="text-sm text-gray-500">{session.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{session.apmc?.name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm text-gray-900">
                          {new Date(session.dateTime).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(session.dateTime).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{session.duration} min</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {session.participants?.length || 0}/{session.maxParticipants}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${session.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      session.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                        session.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                      }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      <button className="text-green-600 hover:text-green-900 flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </button>
                      {(session.status === 'SCHEDULED' || session.status === 'LIVE') && (
                        <button
                          onClick={() => handleDismissSession(session.id)}
                          className="text-red-600 hover:text-red-900 flex items-center"
                          title={session.status === 'LIVE' ? 'End session early' : 'Cancel session'}
                        >
                          <X className="w-4 h-4 mr-1" />
                          {session.status === 'LIVE' ? 'End' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSessions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions found</h3>
            <p>Create your first auction session to get started.</p>
          </div>
        )}
      </div>

      {/* Booking Requests */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">📋 Booking Requests</h2>
          <button
            onClick={clearProcessedRequests}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            title="Clear all approved and rejected requests (preserves pending requests)"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Processed</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farmer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">APMC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookingRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{request.farmer?.name}</div>
                      <div className="text-sm text-gray-500">{request.farmer?.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{request.apmc?.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{request.productName}</div>
                      <div className="text-sm text-gray-500">Grade: {request.grade}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{request.quantity} kg</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {new Date(request.requestedDate).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {request.status === 'PENDING' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleBookingAction(request.id, 'approve')}
                          className="text-green-600 hover:text-green-900 flex items-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleBookingAction(request.id, 'reject')}
                          className="text-red-600 hover:text-red-900 flex items-center"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    )}
                    {request.status !== 'PENDING' && (
                      <span className="text-gray-500">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {bookingRequests.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No booking requests</h3>
            <p>Booking requests will appear here when farmers submit them.</p>
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">🏛️ Create Auction Session</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Title *
                  </label>
                  <input
                    type="text"
                    value={newSession.title}
                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter session title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    APMC *
                  </label>
                  <select
                    value={newSession.apmcId}
                    onChange={(e) => setNewSession({ ...newSession, apmcId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select APMC</option>
                    {apmcs.map((apmc) => (
                      <option key={apmc.id} value={apmc.id}>
                        {apmc.name} - {apmc.location}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={newSession.date}
                      onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time *
                    </label>
                    <input
                      type="time"
                      value={newSession.time}
                      onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={newSession.duration}
                      onChange={(e) => setNewSession({ ...newSession, duration: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      min="30"
                      max="480"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Participants
                    </label>
                    <input
                      type="number"
                      value={newSession.maxParticipants}
                      onChange={(e) => setNewSession({ ...newSession, maxParticipants: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      min="10"
                      max="200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newSession.description}
                    onChange={(e) => setNewSession({ ...newSession, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows="3"
                    placeholder="Enter session description"
                  />
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                  >
                    Create Session
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionManagement;