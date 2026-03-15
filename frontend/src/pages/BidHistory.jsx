import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'
import { Clock, TrendingUp, TrendingDown, User, Calendar, DollarSign, Users } from 'lucide-react'

const BidHistory = () => {
  const { apmcId } = useParams()
  const [bidHistory, setBidHistory] = useState([])
  const [analytics, setAnalytics] = useState({})
  const [timeRange, setTimeRange] = useState('7days')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/auctions/bid-history`, {
          params: { apmcId, range: timeRange }
        });

        // api interceptor returns response.data directly if configured that way. 
        // Based on previous files, api returns `response.data`. 
        // The backend response format seems to be { success: true, data: { history: [], analytics: {} } }
        // So `response` is { success: true, data: ... }

        if (response.success && response.data) {
          const { history, analytics: a } = response.data;

          const mapped = history.map(h => ({
            id: h.id,
            date: new Date(h.date).toLocaleDateString(),
            time: new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            product: h.product,
            highestBid: h.highestBid,
            lowestBid: h.lowestBid,
            avgBid: h.avgBid,
            totalBids: h.totalBids,
            winningFarmer: h.winningFarmer,
            winningBuyer: h.winningBuyer || '—',
            quantity: h.quantity,
            quality: h.quality
          }));

          setBidHistory(mapped);
          setAnalytics({
            avgPriceIncrease: a.avgPriceIncrease || 0,
            totalVolume: a.totalVolume || 0,
            avgBidsPerSession: a.avgBidsPerSession || 0,
            topQuality: '—', // these seemed hardcoded in previous file
            priceVolatility: '—',
            seasonalTrend: '—'
          });
        }
      } catch (e) {
        console.error("Error fetching bid history", e);
        setBidHistory([]);
        setAnalytics({
          avgPriceIncrease: 0,
          totalVolume: 0,
          avgBidsPerSession: 0,
          topQuality: '—',
          priceVolatility: '—',
          seasonalTrend: '—'
        });
      } finally {
        setLoading(false);
      }
    };
    if (apmcId) fetchData();
  }, [apmcId, timeRange]);

  const getPriceChangeIcon = (current, previous) => {
    if (current > previous) return <TrendingUp className="text-green-500" size={16} />;
    return <TrendingDown className="text-red-500" size={16} />;
  };

  const getQualityBadge = (quality) => {
    const colors = {
      'Grade A+': 'bg-green-100 text-green-800',
      'Grade A': 'bg-blue-100 text-blue-800',
      'Grade B': 'bg-yellow-100 text-yellow-800'
    };
    return colors[quality] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            📊 Bid History & Analytics
          </h1>
          <p className="text-gray-600 mt-2">
            Historical bidding data and market trends for APMC {apmcId}
          </p>
        </div>

        {/* Time Range Filter */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex space-x-4">
            {['7days', '30days', '90days'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg ${timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {range === '7days' ? 'Last 7 Days' : range === '30days' ? 'Last 30 Days' : 'Last 90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Price Change</p>
                <p className="text-2xl font-bold text-green-600">+{analytics.avgPriceIncrease || 0}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Volume</p>
                <p className="text-2xl font-bold text-blue-600">{analytics.totalVolume || 0} qtl</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Bids/Session</p>
                <p className="text-2xl font-bold text-purple-600">{analytics.avgBidsPerSession || 0}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Bid History Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Bidding Sessions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quality
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Bids
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Winners
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bidHistory.map((bid, index) => (
                  <tr key={bid.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar size={16} className="text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{bid.date}</div>
                          <div className="text-sm text-gray-500">{bid.time}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{bid.product}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="font-medium text-green-600">₹{bid.highestBid}</span>
                          {index < bidHistory.length - 1 &&
                            getPriceChangeIcon(bid.highestBid, bidHistory[index + 1].highestBid)
                          }
                        </div>
                        <div className="text-gray-500">₹{bid.lowestBid} - ₹{bid.avgBid} avg</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{bid.quantity} qtl</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getQualityBadge(bid.quality)}`}>
                        {bid.quality}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{bid.totalBids} bids</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">🌾 {bid.winningFarmer}</div>
                        <div className="text-gray-500">🛒 {bid.winningBuyer}</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Market Insights */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Market Insights</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Price Volatility:</span>
                <span className="font-medium text-orange-600">{analytics.priceVolatility || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Seasonal Trend:</span>
                <span className="font-medium text-green-600">{analytics.seasonalTrend || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Top Quality Grade:</span>
                <span className="font-medium text-blue-600">{analytics.topQuality || '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h3>
            <div className="space-y-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  💡 Morning sessions (10 AM) show 12% higher prices
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  📈 Grade A+ quality fetches 15% premium pricing
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⏰ Book spots early for popular sessions (limited to 50 participants)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BidHistory