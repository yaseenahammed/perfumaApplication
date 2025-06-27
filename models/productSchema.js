const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    regularPrice: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    offer: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    salePrice: {
      type: Number,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0, 
    },
    productImages: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["available", "not available"],
      required: true,
      default: "available",
    },
    isListed: {
      type: Boolean,
      default: true, 
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Pre-save hook to calculate salePrice based on discount or offer
productSchema.pre('save', function (next) {
  const effectiveDiscount = Math.max(this.discount, this.offer);
  this.salePrice = this.regularPrice * (1 - effectiveDiscount / 100);
  next();
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;