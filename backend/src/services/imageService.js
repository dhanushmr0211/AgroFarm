const cloudinary = require('cloudinary').v2;

class ImageService {
    constructor() {
        // Initialize Cloudinary with environment variables
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
            console.warn('⚠️ Cloudinary credentials not configured. Image uploads are disabled.');
            this.isConfigured = false;
        } else {
            cloudinary.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret,
                secure: true
            });
            this.isConfigured = true;
            console.log('✅ Cloudinary initialized successfully');
            console.log(`📁 Cloud Name: ${cloudName}`);
        }
    }

    /**
     * Upload a single image to Cloudinary
     * @param {Buffer|string} file - File buffer or base64 string
     * @param {string} folder - Cloudinary folder (e.g., 'agrofarm/produce')
     * @param {object} options - Additional upload options
     * @returns {Promise<object>} Upload result with URL and public_id
     */
    async uploadImage(file, folder = 'agrofarm', options = {}) {
        try {
            if (!this.isConfigured) {
                throw new Error('Cloudinary is not configured. Please set CLOUDINARY credentials in .env');
            }

            const uploadOptions = {
                folder,
                resource_type: 'auto',
                transformation: [
                    { width: 1200, height: 1200, crop: 'limit' },
                    { quality: 'auto:good' },
                    { fetch_format: 'auto' }
                ],
                ...options
            };

            const result = await cloudinary.uploader.upload(file, uploadOptions);

            return {
                url: result.secure_url,
                publicId: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes
            };
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            throw new Error(`Image upload failed: ${error.message}`);
        }
    }

    /**
     * Upload multiple images to Cloudinary
     * @param {Array} files - Array of file buffers or base64 strings
     * @param {string} folder - Cloudinary folder
     * @returns {Promise<Array>} Array of upload results
     */
    async uploadMultipleImages(files, folder = 'agrofarm') {
        try {
            if (!this.isConfigured) {
                throw new Error('Cloudinary is not configured. Please set CLOUDINARY credentials in .env');
            }

            const uploadPromises = files.map(file => this.uploadImage(file, folder));
            const results = await Promise.all(uploadPromises);

            console.log(`📸 Uploaded ${results.length} images to Cloudinary`);
            return results;
        } catch (error) {
            console.error('Multiple image upload error:', error);
            throw error;
        }
    }

    /**
     * Delete an image from Cloudinary
     * @param {string} publicId - Cloudinary public_id of the image
     * @returns {Promise<object>} Deletion result
     */
    async deleteImage(publicId) {
        try {
            if (!this.isConfigured) {
                throw new Error('Cloudinary is not configured. Please set CLOUDINARY credentials in .env');
            }

            const result = await cloudinary.uploader.destroy(publicId);

            if (result.result === 'ok') {
                console.log(`🗑️ Deleted image: ${publicId}`);
                return { success: true, message: 'Image deleted successfully' };
            } else {
                throw new Error('Image deletion failed');
            }
        } catch (error) {
            console.error('Cloudinary delete error:', error);
            throw new Error(`Image deletion failed: ${error.message}`);
        }
    }

    /**
     * Delete multiple images from Cloudinary
     * @param {Array<string>} publicIds - Array of Cloudinary public_ids
     * @returns {Promise<object>} Deletion results
     */
    async deleteMultipleImages(publicIds) {
        try {
            if (!this.isConfigured) {
                throw new Error('Cloudinary is not configured. Please set CLOUDINARY credentials in .env');
            }

            const result = await cloudinary.api.delete_resources(publicIds);

            console.log(`🗑️ Deleted ${publicIds.length} images from Cloudinary`);
            return result;
        } catch (error) {
            console.error('Multiple image delete error:', error);
            throw error;
        }
    }

    /**
     * Get optimized image URL with transformations
     * @param {string} publicId - Cloudinary public_id
     * @param {object} transformations - Transformation options
     * @returns {string} Transformed image URL
     */
    getOptimizedUrl(publicId, transformations = {}) {
        if (!this.isConfigured) {
            return null;
        }

        const defaultTransformations = {
            quality: 'auto:good',
            fetch_format: 'auto'
        };

        return cloudinary.url(publicId, {
            ...defaultTransformations,
            ...transformations,
            secure: true
        });
    }

    /**
     * Get thumbnail URL
     * @param {string} publicId - Cloudinary public_id
     * @param {number} width - Thumbnail width
     * @param {number} height - Thumbnail height
     * @returns {string} Thumbnail URL
     */
    getThumbnailUrl(publicId, width = 200, height = 200) {
        return this.getOptimizedUrl(publicId, {
            width,
            height,
            crop: 'fill',
            gravity: 'auto'
        });
    }

    /**
     * Check if Cloudinary is configured
     * @returns {boolean}
     */
    isEnabled() {
        return this.isConfigured;
    }
}

module.exports = new ImageService();
