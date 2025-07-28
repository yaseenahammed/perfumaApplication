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
      .sort({ createdAt: -1 })
      .lean()
      .exec();
       

    const count = await Product.countDocuments(query);
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });


    
    const allProducts = await Product.find({}, 'quantity');
    let totalQ= 0;
    allProducts.forEach(product => totalQ += product.quantity);
    

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
      messages,
      totalQ
     
      
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
      return res.redirect('/admin/pageError');
    }

    res.render('edit-Product', {
      product,
      cat: categories,
      brand: brands,
      error: ' '
    });
  } catch (error) {
    console.error('Error in getEditProduct:', error);
    res.redirect('/admin/pageError');
  }
};

const postEditProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description, regularPrice, discount, quantity, brand, category, offer, status, existingImages, isListed, isBlocked } = req.body;
console.log('product is getting',req.body)
    if (!name || !description || !regularPrice || !quantity || !brand || !category || !status) {
      return res.redirect(`/admin/editProduct/${id}`);
    }

   
    const parsedRegularPrice = parseFloat(regularPrice);
    const parsedQuantity = parseInt(quantity);
    const parsedDiscount = discount ? parseFloat(discount) : 0;
    const parsedOffer = offer ? parseFloat(offer) : 0;

   
    if (
      isNaN(parsedRegularPrice) || parsedRegularPrice <= 0 ||
      isNaN(parsedQuantity) || parsedQuantity < 0 ||
      parsedDiscount < 0 || parsedDiscount > 100 ||
      parsedOffer < 0 || parsedOffer > 100
    ) {
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

    const newUploadedImages = req.files ? req.files.map(file => file.path) : [];

    const product = await Product.findById(id);
    if (!product) {
      return res.redirect('/admin/pageError');
    }

    const currentImages = existingImages ? Array.isArray(existingImages) ? existingImages : JSON.parse(existingImages) : [];

    const updatedImages = newUploadedImages.length > 0 ? [...currentImages, ...newUploadedImages] : currentImages;

    if (updatedImages.length === 0) {
      return res.redirect(`/admin/editProduct/${id}`);
    }

     const salePrice = parsedDiscount > 0
      ? parsedRegularPrice * (1 - parsedDiscount / 100)
      : parsedRegularPrice;

    const updateData = {
      name,
      description,
      regularPrice: parsedRegularPrice,
      salePrice,
      discount: parsedDiscount,
      quantity: parsedQuantity,
      brand,
      category,
      offer: parsedOffer,
      status,
      productImages: updatedImages,
      isListed: isListed === 'on' ? true : product.isListed || true, 
      isBlocked: isBlocked === 'on' ? true : product.isBlocked || false, 
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
      return res.redirect('/admin/products');
    }

    const parsedRegularPrice = parseFloat(regularPrice);
    const parsedQuantity = parseInt(quantity);
    const parsedDiscount = parseFloat(discount) || 0;
    const parsedOffer = parseFloat(offer) || 0;

    if (
      isNaN(parsedRegularPrice) || parsedRegularPrice <= 0 ||
      isNaN(parsedQuantity) || parsedQuantity < 0 ||
      parsedDiscount < 0 || parsedDiscount > 100 ||
      parsedOffer < 0 || parsedOffer > 100
    ) {
      return res.redirect('/admin/products');
    }

    const productExists = await Product.findOne({ name: name.trim() });
    if (productExists) {
      return res.redirect('/admin/products');
    }

    const brandExists = await Brand.findById(brand);
    const categoryExists = await Category.findOne({ _id: category, isListed: true });
    if (!brandExists || brandExists.isBlocked || !categoryExists) {
      return res.redirect('/admin/products');
    }

    const productImages = req.files.map(file => file.path);

    if (productImages.length === 0) {
      return res.redirect('/admin/products');
    }

    const salePrice = parsedDiscount > 0
      ? parsedRegularPrice * (1 - parsedDiscount / 100)
      : parsedRegularPrice;

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
      productImages,
      isListed: true, 
      isBlocked: false,
    });

    await newProduct.save();
 
    return res.json({ success: 'Product added successfully' });
  } catch (error) {
    console.error('Error in addProduct:', error);
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

    const parsedOffer = parseFloat(offer);
    if (isNaN(parsedOffer) || parsedOffer <= 0 || parsedOffer >= 100) {
      return res.status(400).json({ error: 'Offer must be between 1 and 99%' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }


    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        offer: parsedOffer,
       
      },
      { new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, offer: updatedProduct.offer });
  } catch (error) {
    console.error('Add offer error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};;

const removeOffer = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $unset: { offer: "" } 
      },
      { new: true, runValidators: true }
    );

   
    return res.status(200).json({ success: true, offer: null });
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
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.status === 'not available') {
      return res.status(400).json({ error: 'Product is already not available' });
    }

    await Product.findByIdAndUpdate(productId, { 
      status: 'not available',
      isBlocked: true 
    });
    res.status(200).json({ success: true, message: 'Product blocked successfully' });
  } catch (error) {
    console.error('Error in blockProduct:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const unblockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.status === 'available') {
      return res.status(400).json({ error: 'Product is already available' });
    }

    await Product.findByIdAndUpdate(productId, {
      status: product.offer > 0 ? 'not available' : 'available', 
      isBlocked: false 
    });
    res.status(200).json({ success: true, message: 'Product unblocked successfully' });
  } catch (error) {
    console.error('Error in unblockProduct:', error);
    res.status(500).json({ error: 'Internal server error' });
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

