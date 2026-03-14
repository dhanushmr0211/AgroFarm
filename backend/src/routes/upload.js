const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const imageService = require('../services/imageService');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'), false);
    }
};

// Multer configuration
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

/**
 * @route   POST /api/upload/produce
 * @desc    Upload produce images (max 5)
 * @access  Private (Farmer only)
 */
router.post('/produce', authenticateToken, upload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No images provided'
            });
        }

        // Check if Cloudinary is configured
        if (!imageService.isEnabled()) {
            return res.status(503).json({
                success: false,
                message: 'Image upload service is not configured. Please contact administrator.'
            });
        }

        // Convert file buffers to base64 for Cloudinary
        const uploadPromises = req.files.map(file => {
            const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            return imageService.uploadImage(base64Image, 'agrofarm/produce');
        });

        const results = await Promise.all(uploadPromises);

        res.json({
            success: true,
            message: `${results.length} image(s) uploaded successfully`,
            data: {
                images: results.map(r => ({
                    url: r.url,
                    publicId: r.publicId,
                    thumbnail: imageService.getThumbnailUrl(r.publicId)
                }))
            }
        });

    } catch (error) {
        console.error('Produce image upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload images'
        });
    }
});

/**
 * @route   POST /api/upload/profile
 * @desc    Upload user profile image
 * @access  Private
 */
router.post('/profile', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image provided'
            });
        }

        // Check if Cloudinary is configured
        if (!imageService.isEnabled()) {
            return res.status(503).json({
                success: false,
                message: 'Image upload service is not configured. Please contact administrator.'
            });
        }

        // Convert file buffer to base64
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        // Upload to Cloudinary
        const result = await imageService.uploadImage(base64Image, 'agrofarm/profiles', {
            transformation: [
                { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        });

        // Update user profile in database
        const prisma = require('../config/database');
        await prisma.user.update({
            where: { id: req.user.id },
            data: { profileImage: result.url }
        });

        res.json({
            success: true,
            message: 'Profile image uploaded successfully',
            data: {
                url: result.url,
                publicId: result.publicId,
                thumbnail: imageService.getThumbnailUrl(result.publicId, 100, 100)
            }
        });

    } catch (error) {
        console.error('Profile image upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload profile image'
        });
    }
});

/**
 * @route   DELETE /api/upload/:publicId
 * @desc    Delete image from Cloudinary
 * @access  Private
 */
router.delete('/:publicId(*)', authenticateToken, async (req, res) => {
    try {
        const publicId = req.params.publicId;

        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: 'Public ID is required'
            });
        }

        // Check if Cloudinary is configured
        if (!imageService.isEnabled()) {
            return res.status(503).json({
                success: false,
                message: 'Image upload service is not configured. Please contact administrator.'
            });
        }

        await imageService.deleteImage(publicId);

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });

    } catch (error) {
        console.error('Image delete error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete image'
        });
    }
});

/**
 * @route   GET /api/upload/status
 * @desc    Check if image upload service is available
 * @access  Public
 */
router.get('/status', (req, res) => {
    res.json({
        success: true,
        data: {
            enabled: imageService.isEnabled(),
            message: imageService.isEnabled()
                ? 'Image upload service is available'
                : 'Image upload service is not configured'
        }
    });
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 5MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum is 5 images.'
            });
        }
    }

    res.status(400).json({
        success: false,
        message: error.message || 'File upload error'
    });
});

module.exports = router;
