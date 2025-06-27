

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary'); 

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'product-images',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 440, height: 440, crop: 'limit' }],
  },
});

module.exports = multer({ storage });
