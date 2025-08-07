const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const {getBestPrice}=require('../../helpers/offerHelper')

const MAX_ALLOWED_QUANTITY = 5;

const getCart = async (req, res) => {
  try {
         const userId = req.session.userId;
         const user = await User.findById(userId).lean();

  if (!user) {
      return res.status(401).send('error', { message: 'User not logged in' });
    }

  const cart = await Cart.findOne({ user: userId }).populate('items.product');
    
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.render('cart', {
        user,
        cartItems: [],
        subtotal: 0,
        shipping: 50,
        total: 50,
      });
    }

  
 for(let item of cart.items){
  const {finalPrice}=await getBestPrice(item.product)
  item.product.finalPrice=finalPrice
 }


  let subtotal = 0, shipping = 50;
  let price=0
  let cartUpdated = false;

  if (cart && cart.items.length > 0) {
    for (let item of cart.items) {
      const available = item.product.quantity;
      
      
      if (item.quantity > available) {
        item.quantity = available;
        item.totalPrice = available * (item.product.finalPrice || item.product.regularPrice);
        cartUpdated = true;
      }

      subtotal += item.quantity * (item.product.finalPrice || item.product.regularPrice || 0);
      
    }

    if (cartUpdated) {
      await cart.save(); 
    }
  }

  const total = subtotal + shipping;
 

  res.render('cart', {
    user,
    cartItems:cart?.items,
    subtotal,
    shipping,
    total,
   
  });

} catch (error) {
  console.error('Error loading cart:', error);
  res.status(500).send('Internal Server Error');
}

};


const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const itemIndex = cart.items.findIndex(i => i.product.toString() === productId);
    if (itemIndex === -1) return res.status(400).json({ error: 'Item not in cart' });

    cart.items.splice(itemIndex, 1);
    await cart.save();

    res.json({ success: true, message: 'Product removed from cart' });
  } catch (error) {
    console.error('Error in removeFromCart:', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getCart,
  removeFromCart
};