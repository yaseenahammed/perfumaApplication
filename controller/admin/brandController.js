const Brand = require('../../models/brandSchema');



const getBrandPage = async (req, res) => {
  try {
    let search = "";
    if (req.query.search) {
      search = req.query.search.trim();
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

   
    const searchFilter = search ? { name: { $regex: search, $options: "i" } } : {};

    const brandData = await Brand.find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalBrands = await Brand.countDocuments(searchFilter); 
    const totalPages = Math.ceil(totalBrands / limit);

    res.render("brands", {
      data: brandData.reverse(),
      currentPage: page,
      totalPages,
      totalBrands,
    
    });
  } catch (error) {
    console.error(error);
    res.redirect("/admin/pageError");
  }
};


const addBrand = async (req, res) => {
  try {

    let { name } = req.body;

   
    const brandName = name.trim().toLowerCase();

   
    const findBrand = await Brand.findOne({ name: { $regex: `^${brandName}$`, $options: 'i' } });

    if (findBrand) {
      return res.status(400).json({ error: "Brand already exists" });
    }

   
   const image = req.file?.path;

if (!image || !brandName) {
  return res.status(400).json({ error: "Name and image are required" });
}

  
    const newBrand = new Brand({
      name: brandName,
      brandImage: image,
    });

   await newBrand.save();
   return res.status(200).json({ 
  message: "Brand added successfully", 
  brand: newBrand   
});


  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};









const blockBrand = async (req, res) => {
  try {
    const brandId = req.body.id;
    await Brand.updateOne({ _id: brandId }, { $set: { isBlocked: true } });
    res.json({ success: true, message: "Brand blocked successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
};


const unblockBrand = async (req, res) => {
  try {
    const brandId = req.body.id;
    await Brand.updateOne({ _id: brandId }, { $set: { isBlocked: false } });
    res.json({ success: true, message: "Brand unblocked successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
};

const deleteBrand = async (req, res) => {
  try {
    const brandId = req.body.id;
    
    await Brand.deleteOne({ _id: brandId });
    res.json({ success: true, message: "Brand deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
};



module.exports = {
  getBrandPage,
  addBrand,
  blockBrand,
  unblockBrand,
  deleteBrand,
};
