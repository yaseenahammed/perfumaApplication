
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const sharp = require('sharp');




const getAllproducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { 'brand.name': { $regex: search, $options: 'i' } }
        ]
      };
    }

    const productData = await Product.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('category')
      .populate('brand')
      .sort({createdAt:-1})
      .lean()
      .exec();

    const count = await Product.countDocuments(query);
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    const messages = {
      success: req.flash('success'),
      error: req.flash('error')
    };

    res.render("products", {
      productData,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      cat: categories,
      brand: brands,
      search,
      messages
    });
  } catch (error) {
    console.error("Error in getAllproducts:", error);
    res.redirect("/admin/pageError");
  }
};




const getEditProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id).populate('category').populate('brand');
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    if (!product) {
      //('error', 'Product not found');
      return res.redirect('/admin/pageError');
    }

    res.render('edit-Product', {
      product,
      cat: categories,
      brand: brands,
      error: ('error')[0]
    });
  } catch (error) {
    console.error('Error in getEditProduct:', error);
    res.redirect('/admin/pageError');
  }
};



const postEditProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description, regularPrice, discount, quantity, brand, category, offer, status, existingImages } = req.body;

    // Validate input
    if (!name || !description || !regularPrice || !quantity || !brand || !category || !status) {
      return res.redirect(`/admin/editProduct/${id}`);
    }

    const parsedRegularPrice = parseFloat(regularPrice);
    const parsedQuantity = parseInt(quantity);
    const parsedDiscount = discount ? parseFloat(discount) : 0;
    const parsedOffer = offer ? parseFloat(offer) : 0;

    if (isNaN(parsedRegularPrice) || parsedRegularPrice <= 0 || isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.redirect(`/admin/editProduct/${id}`);
    }

    if (parsedDiscount < 0 || parsedDiscount > 100 || parsedOffer < 0 || parsedOffer > 100) {
      return res.redirect(`/admin/editProduct/${id}`);
    }

    const brandExists = await Brand.findById(brand);
    if (!brandExists || brandExists.isBlocked) {
      return res.redirect(`/admin/editProduct/${id}`);
    }

    const categoryExists = await Category.findOne({ _id: category, isListed: true });
    if (!categoryExists) {
      return res.redirect(`/admin/editProduct/${id}`);
    }

    const imageDir = path.join(__dirname, '../../public/uploads/product-images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const productImages = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const imagePath = req.files[i].path;
        const filename = req.files[i].filename;
        try {
          await sharp(imagePath)
            .resize({ width: 440, height: 440 })
            .toFile(imagePath + '.tmp');
          fs.renameSync(imagePath + '.tmp', imagePath);
          productImages.push(`uploads/product-images/${filename}`);
        } catch (err) {
          console.error("Error resizing image:", err);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
          continue;
        }
      }
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.redirect('/admin/pageError');
    }

    // Parse existingImages from the request body (sent as a JSON string or array)
    const currentImages = existingImages ? (Array.isArray(existingImages) ? existingImages : JSON.parse(existingImages)) : [];

    // Combine existing images with new images
    const updatedImages = productImages.length > 0 ? [...currentImages, ...productImages] : currentImages;

    // Validate that there is at least one image
    if (updatedImages.length === 0) {
      return res.redirect(`/admin/editProduct/${id}`);
    }

    const updateData = {
      name,
      description,
      regularPrice: parsedRegularPrice,
      discount: parsedDiscount,
      quantity: parsedQuantity,
      brand,
      category,
      offer: parsedOffer,
      status,
      productImages: updatedImages, // Use the combined images array
    };

    await Product.findByIdAndUpdate(id, updateData, { new: true });

    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error in postEditProduct:', error);
    res.redirect('/admin/pageError');
  }
};



const getAddProduct = async (req, res) => {
  try {
    const { page = 1, search = '' } = req.query;
    const limit = 10;

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            // Searching by brand name won't work like this unless you use aggregation or virtuals
          ],
        }
      : {};

    const products = await Product.find(query)
      .populate('brand')
      .populate('category') 
      .skip((page - 1) * limit)
      .limit(limit);
      

    const total = await Product.countDocuments(query);
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    res.render('products', {
      productData: products,
      brand: brands,
      cat: categories,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      search,
    });
  } catch (error) {
    console.error('Error in getProducts:', error);
    res.redirect('/admin/pageError');
  }
};


const addProduct = async (req, res) => {
  try {
    const { name, description, regularPrice, discount, quantity, brand, category, offer, status } = req.body;
    
    if (!name?.trim() || !description?.trim() || !regularPrice || !quantity || !brand || !category || !status) {
      // //('error', 'All required fields must be filled');
      return res.redirect('/admin/products');
    }

    const parsedRegularPrice = parseFloat(regularPrice);
    const parsedQuantity = parseInt(quantity);
    const parsedDiscount = parseFloat(discount) || 0;
    const parsedOffer = parseFloat(offer) || 0;

    if (isNaN(parsedRegularPrice) || parsedRegularPrice <= 0 || isNaN(parsedQuantity) || parsedQuantity < 0) {
      //('error', 'Invalid price or quantity');
      return res.redirect('/admin/products');
    }

    if (parsedDiscount < 0 || parsedDiscount > 100 || parsedOffer < 0 || parsedOffer > 100) {
      //('error', 'Discount and offer must be between 0 and 100');
      return res.redirect('/admin/products');
    }

    const productExists = await Product.findOne({ name: name.trim() });
    if (productExists) {
      //('error', 'Product already exists');
      return res.redirect('/admin/products');
    }

    const brandExists = await Brand.findById(brand);
    const categoryExists = await Category.findOne({ _id: category, isListed: true });
    if (!brandExists || brandExists.isBlocked || !categoryExists) {
      //('error', 'Invalid brand or category');
      return res.redirect('/admin/products');
    }

    const imageDir = path.join(__dirname, '../../public/uploads/product-images');
    await fs.mkdir(imageDir, { recursive: true },(err) => {
    if (err) {
    console.error('Failed to create directory:', err);
    return;
  }
  // Continue logic here
});

    const productImages = [];

   for (const file of req.files) {
  const imagePath = file.path;
  const filename = file.filename;

  const resizedFilename = `resized-${filename}`;
  const resizedPath = path.join(imageDir, resizedFilename);

 try {
  await sharp(imagePath)
    .resize({ width: 440, height: 440, fit: 'cover' })
    .jpeg({ quality: 95 })
    .toFile(resizedPath);

  productImages.push(`uploads/product-images/${resizedFilename}`);
  
  // Corrected deletion
  await fsPromises.unlink(imagePath).catch(() => {});
} catch (err) {
  console.error('Error processing image:', err);
  await fsPromises.unlink(imagePath).catch(() => {});
}

}


    if (productImages.length === 0) {
      //('error', 'At least one image is required');
      return res.redirect('/admin/products');
    }

    const salePrice = parsedDiscount > 0 ? parsedRegularPrice * (1 - parsedDiscount / 100) : parsedRegularPrice;

    const newProduct = new Product({
      name: name.trim(),
      description: description.trim(),
      regularPrice: parsedRegularPrice,
      salePrice,
      discount: parsedDiscount,
      quantity: parsedQuantity,
      brand,
      category,
      offer: parsedOffer,
      status,
      productImages
    });

   await newProduct.save();
   console.log('product added successfully');
   return res.json({ success: 'Product added successfully' });

  } catch (error) {
    console.error('Error in addProduct:', error);
    //('error', 'Failed to add product');
    res.redirect('/admin/products');
  }
};






const removeProductImage = async (req, res) => {
  try {
    const { imagePath } = req.body;
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    product.productImages = product.productImages.filter(img => img !== imagePath);
    await product.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error in removeProductImage:', error);
    res.status(500).json({ error: 'Failed to remove image' });
  }
};





const addOffer = async (req, res) => {
  try {
    const { offer } = req.body;
    const productId = req.params.id;

    if (!offer || offer <= 0 || offer >= 100) {
      return res.status(400).json({ error: 'Offer must be between 1 and 99%' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await Product.findByIdAndUpdate(productId, {
      offer,
      status: offer > 0 ? 'discounted' : product.status
    });

    return res.status(200).json({ message: 'Offer added successfully' });
  } catch (error) {
    console.error('Add offer error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};






const removeOffer = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await Product.findByIdAndUpdate(productId, {
      $unset: { offer: "" },
      status: product.discount > 0 ? 'discounted' : 'available'
    });

    return res.status(200).json({ message: 'Offer removed successfully' });
  } catch (error) {
    console.error('Remove offer error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};






const blockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      //('error', 'Product not found');
      return res.redirect('/admin/pageError');
    }

    if (product.status === 'not available') {
      //('error', 'Product is already blocked');
      return res.redirect('/admin/products');
    }

    await Product.findByIdAndUpdate(productId, { status: 'not available' });
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error in blockProduct:', error);
    res.redirect('/admin/pageError');
  }
};





const unblockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      //('error', 'Product not found');
      return res.redirect('/admin/pageError');
    }

    if (product.status === 'available' || product.status === 'discounted') {
      //('error', 'Product is already available');
      return res.redirect('/admin/products');
    }

    await Product.findByIdAndUpdate(productId, {
      status: product.offer > 0 || product.discount > 0 ? 'discounted' : 'available'
    });
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error in unblockProduct:', error);
    res.redirect('/admin/pageError');
  }
};





module.exports = {
  getAddProduct,
  addProduct,
  getAllproducts,
  getEditProduct,
  postEditProduct,
  removeProductImage,
  addOffer,
  removeOffer,
  blockProduct,
  unblockProduct
};