// Example: How to integrate ImageUpload component into Farmer Dashboard
// Add this to the "Add New Produce" modal in Dashboard.jsx

import ImageUpload from '../../components/ImageUpload';

// Inside FarmerDashboard component, add state for uploaded images:
const [uploadedImages, setUploadedImages] = useState([]);

// Add this handler:
const handleImagesUploaded = (imageUrls) => {
    setUploadedImages(imageUrls);
    toast.success('Images uploaded successfully!');
};

// In the Add Produce Modal (around line 850-900), add the ImageUpload component:
/*
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Product Images
  </label>
  <ImageUpload 
    onImagesUploaded={handleImagesUploaded}
    maxImages={5}
    uploadType="produce"
  />
  {uploadedImages.length > 0 && (
    <div className="mt-2 text-sm text-green-600">
      ✓ {uploadedImages.length} image(s) uploaded
    </div>
  )}
</div>
*/

// When submitting the produce form, include the images:
const handleAddProduce = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
        const produceData = {
            title: newProduce.name,
            description: newProduce.description,
            category: getCategoryFromName(newProduce.name),
            quantity: parseFloat(newProduce.quantity),
            basePrice: parseFloat(newProduce.minPrice),
            grade: newProduce.quality,
            pickupLocation: newProduce.location,
            apmcId: newProduce.apmcId,
            images: JSON.stringify(uploadedImages), // Add uploaded images
            auctionStartTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            auctionEndTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        const response = await api.post('/auctions', produceData);

        if (response.success) {
            toast.success('Produce listed successfully!');
            setShowAddProduceModal(false);
            setUploadedImages([]); // Clear uploaded images
            // ... rest of the code
        }
    } catch (error) {
        console.error('Failed to add produce:', error);
        toast.error(error.response?.data?.message || 'Failed to add produce');
    } finally {
        setLoading(false);
    }
};

// For Profile Image Upload (in Profile.jsx):
/*
import ImageUpload from '../components/ImageUpload';

const handleProfileImageUploaded = (imageUrls) => {
  // The profile image URL is automatically updated in the database
  // Just refresh the user data
  toast.success('Profile picture updated!');
  window.location.reload(); // Or fetch user data again
};

<div className="mb-6">
  <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Picture</h3>
  <ImageUpload 
    onImagesUploaded={handleProfileImageUploaded}
    maxImages={1}
    uploadType="profile"
  />
</div>
*/
