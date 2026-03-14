import { useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

/**
 * ImageUpload Component
 * Handles multiple image uploads to Cloudinary via backend API
 * 
 * @param {Object} props
 * @param {Function} props.onImagesUploaded - Callback with array of uploaded image URLs
 * @param {number} props.maxImages - Maximum number of images (default: 5)
 * @param {string} props.uploadType - 'produce' or 'profile'
 */
export default function ImageUpload({ onImagesUploaded, maxImages = 5, uploadType = 'produce' }) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Handle file selection
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);

        // Validate file count
        if (selectedFiles.length + files.length > maxImages) {
            toast.error(`Maximum ${maxImages} images allowed`);
            return;
        }

        // Validate file types
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        const invalidFiles = files.filter(f => !validTypes.includes(f.type));

        if (invalidFiles.length > 0) {
            toast.error('Only JPEG, PNG, WebP, and GIF images are allowed');
            return;
        }

        // Validate file sizes (5MB max)
        const oversizedFiles = files.filter(f => f.size > 5 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            toast.error('Each image must be less than 5MB');
            return;
        }

        // Add files and create previews
        setSelectedFiles(prev => [...prev, ...files]);

        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviews(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
    };

    // Remove selected image
    const removeImage = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    // Upload images to backend
    const uploadImages = async () => {
        if (selectedFiles.length === 0) {
            toast.error('Please select at least one image');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();

            if (uploadType === 'profile') {
                // Single image for profile
                formData.append('image', selectedFiles[0]);
            } else {
                // Multiple images for produce
                selectedFiles.forEach(file => {
                    formData.append('images', file);
                });
            }

            const endpoint = uploadType === 'profile' ? '/upload/profile' : '/upload/produce';

            const response = await api.post(endpoint, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                }
            });

            if (response.data.success) {
                const imageUrls = uploadType === 'profile'
                    ? [response.data.data.url]
                    : response.data.data.images.map(img => img.url);

                onImagesUploaded(imageUrls);
                toast.success(`${selectedFiles.length} image(s) uploaded successfully`);

                // Clear selections
                setSelectedFiles([]);
                setPreviews([]);
                setUploadProgress(0);
            }
        } catch (error) {
            console.error('Image upload error:', error);
            toast.error(error.response?.data?.message || 'Failed to upload images');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* File Input */}
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 transition">
                    <Upload size={20} />
                    <span>Select Images</span>
                    <input
                        type="file"
                        multiple={uploadType !== 'profile'}
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                    />
                </label>

                {selectedFiles.length > 0 && (
                    <button
                        onClick={uploadImages}
                        disabled={uploading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploading ? `Uploading... ${uploadProgress}%` : `Upload ${selectedFiles.length} Image(s)`}
                    </button>
                )}
            </div>

            {/* Image Previews */}
            {previews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {previews.map((preview, index) => (
                        <div key={index} className="relative group">
                            <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border-2 border-gray-300"
                            />
                            <button
                                onClick={() => removeImage(index)}
                                disabled={uploading}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Progress */}
            {uploading && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                    />
                </div>
            )}

            {/* Helper Text */}
            <p className="text-sm text-gray-500">
                {uploadType === 'profile'
                    ? 'Select a profile picture (max 5MB, JPEG/PNG/WebP/GIF)'
                    : `Select up to ${maxImages} images (max 5MB each, JPEG/PNG/WebP/GIF)`
                }
            </p>
        </div>
    );
}
