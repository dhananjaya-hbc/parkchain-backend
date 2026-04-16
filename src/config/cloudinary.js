const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Setup multer storage for Cloudinary
const kybStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'kyb_documents',     // Cloudinary folder name
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
    resource_type: 'auto'
  }
});

const spotStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'spot_images',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    resource_type: 'image'
  }
});

const upload = multer({ storage: kybStorage });
const spotUpload = multer({ storage: spotStorage });

module.exports = {
  cloudinary,
  upload,
  spotUpload
};
