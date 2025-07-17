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

        const limit = 3; 

     
        const category = await Category.find({
            name: { $regex: ".*" + search + ".*", $options: 'i' } 
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        
        const count = await Category.find({
            name: { $regex: ".*" + search + ".*", $options: 'i' }
        }).countDocuments();
        

        res.render('categories', {
            cat: category,
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
    let { name, description } = req.body;

    try {
       
        name = name.trim().toLowerCase();

     
        const existingCategory = await Category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } }).sort({createdAt:-1});

        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({ name, description });
        await newCategory.save();

        const categoryCount=await Category.countDocuments()
        const nextIndex=categoryCount

        return res.json({ message: "Category added successfully" ,
          newCategory,
          categoryIndex:nextIndex,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
};





const addOffer = async (req, res) => {
  try {
    const { categoryId, offer } = req.body;

    if (!offer || offer <= 0 || offer >= 100) {
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

    return res.json({ message: "Offer added successfully", offer:category.offer }); 
  } catch (error) {
    console.error("Error adding offer:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};




const removeOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;

        const category = await Category.findByIdAndUpdate(categoryId, {
            offer: null
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

    
    const isListed = action === 'list';

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

    const existingCategory = await Category.findOne({ name: { $regex: `^${categoryName}$`, $options: 'i' } });

    if (existingCategory) {
      return res.status(400).json({ error: "Category exists, please choose another name" });
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, {
      name: categoryName,
      description,
    }, { new: true });

    if (updatedCategory) {
      return res.status(200).json({ success: true, message: "Category updated successfully" });
    } else {
      return res.status(404).json({ error: "Category not found" });
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