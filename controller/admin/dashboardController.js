const Product=require('../../models/productSchema')
const Order=require('../../models/orderSchema')
const PDFDocument = require("pdfkit");
const User=require('../../models/userSchema.js')
const Category=require('../../models/categorySchema.js')

async function fetchTopProducts(limit = 10) {
  return Order.aggregate([
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalSold: { $sum: "$items.quantity" }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" }
  ]).then(data =>
    data.map(p => ({
      name: p.product.name,
      sales: p.totalSold,
     
    }))
  );
}

async function fetchTopBrands(limit = 10) {
  return Order.aggregate([
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "brands",
        localField: "product.brand",
        foreignField: "_id",
        as: "brand"
      }
    },
    { $unwind: "$brand" },
    {
      $group: {
        _id: "$brand._id",
        name: { $first: "$brand.name" },
        totalSold: { $sum: "$items.quantity" },
        grossRevenue: { $sum: { $multiply: ["$items.quantity", "$product.salePrice"] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit }
  ]).then(data =>
    data.map(b => ({
      name: b.name,
      sales: b.totalSold,
      revenue: b.grossRevenue
    }))
  );
}

async function fetchTopCategories(limit = 10) {
  return Order.aggregate([
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "categories",
        localField: "product.category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category._id",
        name: { $first: "$category.name" },
        totalSold: { $sum: "$items.quantity" },
        grossRevenue: { $sum: { $multiply: ["$items.quantity", "$product.salePrice"] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit }
  ]).then(data =>
    data.map(c => ({
      name: c.name,
      sales: c.totalSold,
      revenue: c.grossRevenue
    }))
  );
}


async function getMonthlyEarnings() {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  const result = await Order.aggregate([
    {
      $match: {
        orderStatus: { $in: ["Delivered"] }, 
        createdAt: { $gte: startOfMonth, $lt: endOfMonth }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$finalAmount" } 
      }
    }
  ]);

  return result.length > 0 ? result[0].total : 0;
}


const loadDashboard = async (req, res) => {
  try {
    const topProducts = await fetchTopProducts(5);
    const topBrands = await fetchTopBrands(5);
    const topCategories = await fetchTopCategories(5);

      const monthlyEarnings = await getMonthlyEarnings();
  
      const total_products = await Product.countDocuments();
    const total_categories = await Category.countDocuments();
    const total_orders = await Order.countDocuments();

    
   
    const revenue = await Order.aggregate([
      { $match: { orderStatus: 'Delivered' } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } }
    ]);


    res.render("dashboard", {
      revenue: revenue[0] ? revenue[0].total : 0,
      top_products: topProducts,
      top_brands: topBrands,
      top_categories: topCategories,
      total_products,
      total_categories,
      total_orders,
      monthly_earnings:monthlyEarnings
    });
  } catch (err) {
    console.error("Error loading dashboard:", err);
  }
};






function drawTable(doc, title, headers, rows, startY) {
  let startX = 50;
  let y = startY;

  // Title
  doc.fontSize(14).text(title, startX, y, { underline: true });
  y += 20;

  // Headers
  doc.fontSize(12).text(headers[0], startX, y);
  doc.text(headers[1], startX + 200, y);
  doc.text(headers[2], startX + 350, y);
  y += 15;

  // Divider
  doc.moveTo(startX, y).lineTo(550, y).stroke();
  y += 10;

  // Rows
  rows.forEach((r, i) => {
    doc.text(`${i + 1}. ${r.name}`, startX, y);
    doc.text(r.sales, startX + 200, y);
    doc.text(`$${r.revenue.toFixed(2)}`, startX + 350, y);
    y += 20;
  });

  return y + 20; // return next starting y
}

const generateLedger = async (req, res) => {
  try {
    const topProducts = await fetchTopProducts();
    const topBrands = await fetchTopBrands();
    const topCategories = await fetchTopCategories();

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=ledger.pdf");
    doc.pipe(res);

    doc.fontSize(20).text("Perfuma Sales Ledger", { align: "center" });
    doc.moveDown(2);

    let y = 100;
    y = drawTable(doc, "Top Products", ["Product", "Sales", "Revenue"], topProducts, y);
    y = drawTable(doc, "Top Brands", ["Brand", "Sales", "Revenue"], topBrands, y);
    y = drawTable(doc, "Top Categories", ["Category", "Sales", "Revenue"], topCategories, y);

    doc.end();
  } catch (err) {
    console.error("Ledger generation error:", err);
    res.status(500).send("Error generating ledger");
  }
};

// 📌 Yearly Sales
const getYearlySales = async () => {
  const sales = await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" } },
        totalSales: { $sum: "$finalAmount" }
      }
    },
    { $sort: { "_id.year": 1 } } // sort by year
  ]);

  return {
    labels: sales.map(s => `${s._id.year}`),
    values: sales.map(s => s.totalSales)
  };
};

// 📌 Monthly Sales
const getMonthlySales = async () => {
  const sales = await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        totalSales: { $sum: "$finalAmount" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } } // sort by year + month
  ]);

  // Month names
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return {
    labels: sales.map(s => `${monthNames[s._id.month - 1]} ${s._id.year}`),
    values: sales.map(s => s.totalSales)
  };
};

// 📌 Weekly Sales
const getWeeklySales = async () => {
  const sales = await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" }
        },
        totalSales: { $sum: "$finalAmount" }
      }
    },
    { $sort: { "_id.year": 1, "_id.week": 1 } } // sort by year + week
  ]);

  return {
    labels: sales.map(s => `Week ${s._id.week} - ${s._id.year}`),
    values: sales.map(s => s.totalSales)
  };
};

// 📌 Daily Sales
const getDailySales = async () => {
  const sales = await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" }
        },
        totalSales: { $sum: "$finalAmount" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);

  return {
    labels: sales.map(s => `${s._id.day}/${s._id.month}/${s._id.year}`),
    values: sales.map(s => s.totalSales)
  };
};


const filteredSales = async (req, res) => {
  const { filter } = req.params;
  let data = { labels: [], values: [] };

  if (filter === "yearly") {
    data = await getYearlySales();
  } else if (filter === "monthly") {
    data = await getMonthlySales();
  } else if (filter === "weekly") {
    data = await getWeeklySales();
  } else if (filter === "daily") {
    data = await getDailySales();
  }

  res.json(data);
};




module.exports={
    loadDashboard,
    generateLedger,
    filteredSales
}