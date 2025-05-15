const Brand = require('../../models/brandSchema');

const getBrandPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const brandData = await Brand.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands / limit);

    res.render('brands', {
      data: brandData.reverse(),
      currentpage: page,
      totalPages,
      totalBrands,
    });
  } catch (error) {
    res.redirect('/admin/pageError');
  }
};

const addBrand = async (req, res) => {
  try {
    const brandName = req.body.name;
    const findBrand = await Brand.findOne({ name: brandName });

    if (!findBrand) {
      const image = req.file.filename;
      const newBrand = new Brand({
        name: brandName,
        brandImage: image,
      });
      await newBrand.save();
      res.redirect('/admin/brands');
    } else {
      res.send("Brand already exists");
    }
  } catch (error) {
    console.log(error);
    res.redirect('/admin/pageError');
  }
};

const blockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect('/admin/brands');
  } catch (error) {
    res.redirect('/admin/pageError');
  }
};

const unblockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect('/admin/brands');
  } catch (error) {
    res.redirect('/admin/pageError');
  }
};

const deleteBrand = async (req, res) => {
  try {
    const brandId = req.query.id;
    await Brand.deleteOne({ _id: brandId });
    res.redirect('/admin/brands');
  } catch (error) {
    console.log(error);
    res.redirect('/admin/pageError');
  }
};

module.exports = {
  getBrandPage,
  addBrand,
  blockBrand,
  unblockBrand,
  deleteBrand,
};
