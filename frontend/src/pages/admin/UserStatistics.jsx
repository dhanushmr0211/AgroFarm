import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Calendar,
  PieChart,
  MapPin,
  TrendingUp,
  Activity
} from 'lucide-react';
import api from '../../api';
import { toast } from 'react-hot-toast';

const UserStatistics = () => {
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    recentRegistrations: 0,
    usersByRole: {
      FARMER: 0,
      BUYER: 0,
      ADMIN: 0
    },
    usersByApmc: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/statistics');

      if (response.success) {
        setStatistics(response.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Failed to load user statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User Statistics</h1>
        <p className="text-gray-600">Overview of registered users and their activity</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-700">Total Users</h3>
              <p className="text-3xl font-bold text-blue-600">{statistics.totalUsers}</p>
            </div>
            <Users className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-700">Active Users</h3>
              <p className="text-3xl font-bold text-green-600">{statistics.activeUsers}</p>
            </div>
            <UserCheck className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-700">Inactive Users</h3>
              <p className="text-3xl font-bold text-red-600">{statistics.inactiveUsers}</p>
            </div>
            <UserX className="w-12 h-12 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-700">Recent (30 days)</h3>
              <p className="text-3xl font-bold text-purple-600">{statistics.recentRegistrations}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Users by Role */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <PieChart className="w-6 h-6 mr-2" />
            Users by Role
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                <span className="font-medium">Farmers</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {statistics.usersByRole.FARMER}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                <span className="font-medium">Buyers</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">
                {statistics.usersByRole.BUYER}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-purple-500 rounded-full mr-3"></div>
                <span className="font-medium">Admins</span>
              </div>
              <span className="text-2xl font-bold text-purple-600">
                {statistics.usersByRole.ADMIN}
              </span>
            </div>
          </div>
        </div>

        {/* Users by APMC */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <MapPin className="w-6 h-6 mr-2" />
            Users by APMC
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {statistics.usersByApmc.length > 0 ? (
              statistics.usersByApmc.map((apmc, index) => (
                <div key={apmc.apmcId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-3"
                      style={{
                        backgroundColor: `hsl(${(index * 45) % 360}, 70%, 50%)`
                      }}
                    ></div>
                    <span className="text-sm font-medium text-gray-700">
                      {apmc.apmcName}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {apmc.userCount}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No users associated with APMCs yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Activity className="w-6 h-6 mr-2" />
          User Activity Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {statistics.totalUsers > 0 ?
                Math.round((statistics.activeUsers / statistics.totalUsers) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-600">Active Rate</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{
                  width: statistics.totalUsers > 0 ?
                    `${(statistics.activeUsers / statistics.totalUsers) * 100}%` : '0%'
                }}
              ></div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {statistics.totalUsers > 0 ?
                Math.round((statistics.usersByRole.FARMER / statistics.totalUsers) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-600">Farmers</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{
                  width: statistics.totalUsers > 0 ?
                    `${(statistics.usersByRole.FARMER / statistics.totalUsers) * 100}%` : '0%'
                }}
              ></div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {statistics.totalUsers > 0 ?
                Math.round((statistics.recentRegistrations / statistics.totalUsers) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-600">Recent Growth</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{
                  width: statistics.totalUsers > 0 ?
                    `${(statistics.recentRegistrations / statistics.totalUsers) * 100}%` : '0%'
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="mt-8 text-center">
        <button
          onClick={fetchStatistics}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center mx-auto"
        >
          <Activity className="w-4 h-4 mr-2" />
          Refresh Statistics
        </button>
      </div>
    </div>
  );
};

export default UserStatistics;