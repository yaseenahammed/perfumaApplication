const Product=require('../../models/productSchema')
const Order=require('../../models/orderSchema')
const PDFDocument = require("pdfkit");
const User=require('../../models/userSchema.js')
const Category=require('../../models/categorySchema.js')
const { getBestPrice } = require('../../helpers/offerHelper');
const logger = require('../../helpers/logger');


async function fetchTopProducts(limit = 5) {

  const rawData = await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },   
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
  ]);


  const enrichedData = await Promise.all(
    rawData.map(async (p) => {
      const { finalPrice } = await getBestPrice(p.product);
      return {
        name: p.product.name,
        sales: p.totalSold,
        revenue: p.totalSold * finalPrice 
      };
    })
  );

  return enrichedData;
}





async function fetchTopBrands(limit = 5) {

  const rawData = await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
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
        products: { $push: { product: "$product", quantity: "$items.quantity" } },
        totalSold: { $sum: "$items.quantity" }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit }
  ]);


  const enrichedData = await Promise.all(
    rawData.map(async (b) => {
      let revenue = 0;
      for (const item of b.products) {
        const { finalPrice } = await getBestPrice(item.product);
        revenue += item.quantity * finalPrice;
      }

      return {
        name: b.name,
        sales: b.totalSold,
        revenue
      };
    })
  );

  return enrichedData;
}



async function fetchTopCategories(limit = 5) {
  
  const rawData = await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
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
        products: { $push: { product: "$product", quantity: "$items.quantity" } },
        totalSold: { $sum: "$items.quantity" }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit }
  ]);

  
  const enrichedData = await Promise.all(
    rawData.map(async (c) => {
      let revenue = 0;

      for (const item of c.products) {
        const { finalPrice } = await getBestPrice(item.product);
        revenue += item.quantity * finalPrice;
      }

      return {
        name: c.name,
        sales: c.totalSold,
        revenue
      };
    })
  );

  return enrichedData;
}


async function getMonthlyEarnings() {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  const result = await Order.aggregate([
    {
      $match: {
        orderStatus: {$in:['Delivered','ReturnRequest','Return Rejected']}, 
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



const getYearlySales = async () => {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 4; 
  const startDate = new Date(`${startYear}-01-01T00:00:00Z`);

  const sales = await Order.aggregate([
    {
      $match: {
        orderStatus: {$in:['Delivered','ReturnRequest','Return Rejected']},
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: { year: { $year: "$createdAt" } },
        totalSales: { $sum: "$finalAmount" }
      }
    },
    { $sort: { "_id.year": -1 } }, 
    { $limit: 5 }
  ]);


  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const labels = years.map(year => `${year}`);
  const values = years.map(year => {
    const sale = sales.find(s => s._id.year === year);
    return sale ? sale.totalSales : 0;
  });

  return { labels, values };
};

const getMonthlySales = async () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(endDate.getMonth() - 4); 
  startDate.setDate(1); 
  startDate.setHours(0, 0, 0, 0);

  const sales = await Order.aggregate([
    {
      $match: {
        orderStatus: {$in:['Delivered','ReturnRequest','Return Rejected']},
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        totalSales: { $sum: "$finalAmount" }
      }
    },
    { $sort: { "_id.year": -1, "_id.month": -1 } },
    { $limit: 5 }
  ]);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setMonth(endDate.getMonth() - i);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });
  const labels = months.map(m => `${monthNames[m.month - 1]} ${m.year}`);
  const values = months.map(m => {
    const sale = sales.find(s => s._id.month === m.month && s._id.year === m.year);
    return sale ? sale.totalSales : 0;
  });

  return { labels, values };
};


const getWeeklySales = async () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 28); 

  const sales = await Order.aggregate([
    {
      $match: {
        orderStatus: {$in:['Delivered','ReturnRequest','Return Rejected']},
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          week: { $isoWeek: "$createdAt" }
        },
        totalSales: { $sum: "$finalAmount" }
      }
    },
    { $sort: { "_id.year": -1, "_id.week": -1 } },
    { $limit: 5 }
  ]);

  const weeks = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(endDate.getDate() - i * 7);
    return { week: d.getWeek(), year: d.getFullYear() };
  });
  const labels = weeks.map(w => `Week ${w.week} - ${w.year}`);
  const values = weeks.map(w => {
    const sale = sales.find(s => s._id.week === w.week && s._id.year === w.year);
    return sale ? sale.totalSales : 0;
  });

  return { labels, values };
};


Date.prototype.getWeek = function() {
  const date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return Math.round(((date - week1) / 86400000 + 1) / 7);
};

const getDailySales = async () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 4);

  const sales = await Order.aggregate([
    {
      $match: {
        orderStatus: {$in:['Delivered','ReturnRequest','Return Rejected']},
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
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
    { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
    { $limit: 5 }
  ]);

  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(endDate.getDate() - i);
    return d;
  });
  const labels = dates.map(d => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`);
  const values = dates.map(d => {
    const sale = sales.find(s =>
      s._id.day === d.getDate() &&
      s._id.month === d.getMonth() + 1 &&
      s._id.year === d.getFullYear()
    );
    return sale ? sale.totalSales : 0;
  });

  return { labels, values };
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


const loadDashboard = async (req, res) => {
  try {
    const topProducts = await fetchTopProducts(5);
    const topBrands = await fetchTopBrands(5);
    const topCategories = await fetchTopCategories(5);

      const monthlyEarnings = await getMonthlyEarnings();
  
      const total_products = await Product.countDocuments();
    const total_categories = await Category.countDocuments();
    const total_orders = await Order.countDocuments({orderStatus:{$in:['Delivered','ReturnRequest','Return Rejected']}});

    
   
    const revenue = await Order.aggregate([
      { $match: { orderStatus:{$in:['Delivered','ReturnRequest','Return Rejected']}} },
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
      monthly_earnings:monthlyEarnings,
      
    });
  } catch (err) {
    logger.error("Error loading dashboard:", err);
  }
};






function drawTable(doc, title, headers, rows, startY) {
  let startX = 50;
  let y = startY;


  doc.fontSize(14).text(title, startX, y, { underline: true });
  y += 20;


  doc.fontSize(12).text(headers[0], startX, y);
  doc.text(headers[1], startX + 200, y);
  doc.text(headers[2], startX + 350, y);
  y += 15;


  doc.moveTo(startX, y).lineTo(550, y).stroke();
  y += 10;


rows.forEach((r, i) => {
    const cleanRevenue = parseFloat(r.revenue.toString().replace(/[^\d.-]/g, ''));

    doc.text(`${i + 1}. ${r.name}`, startX, y);
    doc.text(r.sales, startX + 200, y);
    doc.text(`₹${cleanRevenue.toFixed(2)}`, startX + 350, y);

    y += 20;
});


  return y + 20; 
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

    doc.fontSize(20).text("Sales of Perfuma", { align: "center" });
    doc.moveDown(2);

    let y = 100;
    y = drawTable(doc, "Top Products", ["Product", "Sales", "Revenue"], topProducts, y);
    y = drawTable(doc, "Top Brands", ["Brand", "Sales", "Revenue"], topBrands, y);
    y = drawTable(doc, "Top Categories", ["Category", "Sales", "Revenue"], topCategories, y);

    doc.end();
  } catch (err) {
    logger.error("Ledger generation error:", err);
    res.status(500).send("Error generating ledger");
  }
};



module.exports={
    loadDashboard,
    generateLedger,
    filteredSales
}

