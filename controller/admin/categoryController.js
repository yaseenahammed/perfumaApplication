const Category = require('../../models/categorySchema');



const categoryInfo = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }

        let page = 1;
        if (req.query.page) {
            page = parseInt(req.query.page);
        }

        const limit = 3; // Number of categories per page

        // Fetch matching categories with pagination
        const categoryData = await Category.find({
            name: { $regex: ".*" + search + ".*", $options: 'i' } // Case-insensitive
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        // Count total matching documents
        const count = await Category.find({
            name: { $regex: ".*" + search + ".*", $options: 'i' }
        }).countDocuments();

        res.render('categories', {
            cat: categoryData,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            searchQuery: search
        });

    } catch (error) {
        console.error("Category fetch error:", error);
        res.redirect('/admin/pageError');
    }
};




  const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({ name, description });
        await newCategory.save();

        return res.json({ message: "Category added successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
};




const addOffer = async (req, res) => {
  try {
    const { categoryId, offer } = req.body;

    if (!offer || offer <= 0 || offer > 100) {
      return res.status(400).json({ error: "Invalid offer percentage" });
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      { offer: offer },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    return res.json({ message: "Offer added successfully", category }); // ✅ Return updated data
  } catch (error) {
    console.error("Error adding offer:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};



const removeOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;

        const category = await Category.findByIdAndUpdate(categoryId, {
            offer: 0
        });

        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        return res.json({ message: "Offer removed successfully" });
    } catch (error) {
        console.error("Error removing offer:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


const listCategory = async (req, res) => {
  try {
    const { categoryId, action } = req.body;

    // Decide new value based on action
    const isListed = action === 'list';

    // Update the category
    await Category.findByIdAndUpdate(categoryId, { isListed });

    res.json({ message: `Category successfully ${isListed ? 'listed' : 'unlisted'}.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};



const getEditCategory=async(req,res)=>{
  try {
    const id=req.query.id;
    const category=await Category.findOne({_id:id})
    res.render('edit-category',{category:category})
  } catch (error) {
    res.redirect('/admin/pageError')
    
  }
}


const editCategory = async (req, res) => {
  try {
    const id = req.body.id;
    const { categoryName, description } = req.body;

    const existingCategory = await Category.findOne({ name: categoryName, _id: { $ne: id } });

    if (existingCategory) {
      return res.status(400).json({ error: "Category exists, please choose another name" });
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, {
      name: categoryName,
      description,
    }, { new: true });

    if (updatedCategory) {
      res.redirect('/admin/category');
    } else {
      res.status(404).json({ error: "Category not found" });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};



module.exports={
    categoryInfo,
    addCategory,
    addOffer,
    removeOffer,
    listCategory,
    getEditCategory,
    editCategory
}