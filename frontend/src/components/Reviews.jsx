import { useState, useEffect } from 'react';
import { Star, User } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

const Reviews = ({ userId, canReview = false, orderId = null, onReviewSubmitted }) => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchReviews();
    }, [userId]);

    const fetchReviews = async () => {
        try {
            const response = await api.get(`/reviews/${userId}`);
            if (response.success) {
                setReviews(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!orderId) return;

        setSubmitting(true);
        try {
            const response = await api.post('/reviews', {
                orderId,
                rating: newReview.rating,
                comment: newReview.comment
            });

            if (response.success) {
                toast.success('Review submitted successfully!');
                setNewReview({ rating: 5, comment: '' });
                fetchReviews();
                if (onReviewSubmitted) onReviewSubmitted();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Review Form */}
            {canReview && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4">Leave a Review</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                                        className={`focus:outline-none transition-colors ${star <= newReview.rating ? 'text-yellow-400' : 'text-gray-300'
                                            }`}
                                    >
                                        <Star fill="currentColor" size={24} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Comment</label>
                            <textarea
                                value={newReview.comment}
                                onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                rows="3"
                                placeholder="Share your experience..."
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                            {submitting ? 'Submitting...' : 'Submit Review'}
                        </button>
                    </form>
                </div>
            )}

            {/* Reviews List */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Reviews ({reviews.length})</h3>
                {loading ? (
                    <div className="text-center py-4">Loading reviews...</div>
                ) : reviews.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                        No reviews yet.
                    </div>
                ) : (
                    reviews.map((review) => (
                        <div key={review.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                        {review.reviewer.profileImage ? (
                                            <img src={review.reviewer.profileImage} alt={review.reviewer.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={16} className="text-gray-500" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{review.reviewer.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(review.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex text-yellow-400">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={14}
                                            fill={i < review.rating ? "currentColor" : "none"}
                                            className={i < review.rating ? "" : "text-gray-300"}
                                        />
                                    ))}
                                </div>
                            </div>
                            <p className="text-gray-700 text-sm mt-2">{review.comment}</p>
                            {review.order?.produce?.title && (
                                <p className="text-xs text-gray-500 mt-2">
                                    Verified Purchase: {review.order.produce.title}
                                </p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Reviews;
