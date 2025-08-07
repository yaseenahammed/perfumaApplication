const Category = require('../models/categorySchema');

const getBestPrice = async (product) => {
  const regularPrice = product.regularPrice;
  const productOffer = product.offer || 0;

  let categoryOffer = 0;
  const category = await Category.findById(product.category);
  if (category && category.isOfferActive) {
    categoryOffer = category.offer || 0;
  }

  const bestOffer = Math.max(productOffer, categoryOffer);
  const finalPrice = Math.round(regularPrice * (1 - bestOffer / 100));



  return {
    finalPrice,
    bestOffer
  };
};

module.exports = { getBestPrice };
