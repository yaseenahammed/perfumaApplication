const Order=require('../../models/orderSchema')
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');



const getSalesReport=async(req,res)=>{
    try {

    const { period = 'daily', startDate, endDate, page = 1 } = req.query;
    const perPage = 10;

    let filter = {};
    let start, end
       
      if (period === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    } else if (period === 'daily') {
      const today = new Date();   
      start = new Date(today.setHours(0, 0, 0, 0));
      end = new Date(today.setHours(23, 59, 59, 999));
      filter.createdAt = { $gte: start, $lte: end };
    } else if (period === 'weekly') {
      start = new Date();
      start.setDate(start.getDate() - 7);
      end = new Date();
      filter.createdAt = { $gte: start, $lte: end };
    } else if (period === 'yearly') {
      start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      end = new Date();
      filter.createdAt = { $gte: start, $lte: end };
    }

    const totalOrders=await Order.countDocuments(filter)

    const orders=await Order.find(filter)
        .populate('user  items.product')
        .sort({createdAt :-1})
        .skip((page-1)*perPage)
        .limit(perPage)
        .lean()


        const summary={
            totalSales:await Order.countDocuments(filter),
            totalAmount:await Order.aggregate([
                {$match:filter},
                {$group:{_id:null,sum:{$sum:'$totalAmount'}}}
            ]),
            discountPrice:await Order.aggregate([
                {$match:filter},
                {$group:{_id:null,sum:{$sum:'$discountPrice'}}}
            ])
        }

    
        res.render('salesReport',{
             salesData:orders,
             summary: {
                 totalSales: summary.totalSales,
                 totalAmount: summary.totalAmount[0]?.sum || 0,
                 discountPrice: summary.discountPrice[0]?.sum || 0
                },
             totalPages: Math.ceil(totalOrders / perPage),
             currentPage: Number(page),
             period,
             startDate,
             endDate,
          
        })
    } catch (error) {
        console.error('error in getting salesReport')
    }
}





const downloadSalesReport = async (req, res) => {
    try {
        const { period = 'daily', startDate, endDate, format } = req.query;
        let filter = {};
        let start, end;

        // 🔹 SAME FILTER LOGIC as getSalesReport
        if (period === 'custom' && startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.createdAt = { $gte: start, $lte: end };
        } else if (period === 'daily') {
            const today = new Date();
            start = new Date(today.setHours(0, 0, 0, 0));
            end = new Date(today.setHours(23, 59, 59, 999));
            filter.createdAt = { $gte: start, $lte: end };
        } else if (period === 'weekly') {
            start = new Date();
            start.setDate(start.getDate() - 7);
            end = new Date();
            filter.createdAt = { $gte: start, $lte: end };
        } else if (period === 'yearly') {
            start = new Date();
            start.setFullYear(start.getFullYear() - 1);
            end = new Date();
            filter.createdAt = { $gte: start, $lte: end };
        }

        const orders = await Order.find(filter).populate('user').lean();

        // 🔹 Generate Excel
        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            worksheet.columns = [
                { header: 'Order ID', key: 'orderID', width: 20 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Customer', key: 'customer', width: 20 },
                { header: 'Total Amount', key: 'totalAmount', width: 15 },
                { header: 'Discount', key: 'discountPrice', width: 15 },
                { header: 'Coupon Code', key: 'couponCode', width: 20 },
                { header: 'Final Amount', key: 'finalAmount', width: 15 }
            ];

            orders.forEach(order => {
                worksheet.addRow({
                    orderID: order.orderID,
                    date: new Date(order.createdAt).toLocaleDateString(),
                    customer: order.user?.name || 'Unknown',
                    totalAmount: order.totalAmount,
                    discountPrice: order.discountPrice,
                    couponCode: order.couponCode || 'None',
                    finalAmount: order.finalAmount
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales_report.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } 

        // 🔹 Generate PDF
        else if (format === 'pdf') {
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
            doc.pipe(res);

            doc.fontSize(18).text('Sales Report', { align: 'center' });
            doc.moveDown();

            orders.forEach(order => {
                doc.fontSize(12).text(`Order ID: ${order.orderID}`);
                doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
                doc.text(`Customer: ${order.user?.name || 'Unknown'}`);
                doc.text(`Total Amount: $${order.totalAmount}`);
                doc.text(`Discount: $${order.discountPrice}`);
                doc.text(`Coupon: ${order.couponCode || 'None'}`);
                doc.text(`Final Amount: $${order.finalAmount}`);
                doc.moveDown();
            });

            doc.end();
        } else {
            res.status(400).send('Invalid format');
        }

    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating sales report');
    }
};



module.exports={
    getSalesReport,
    downloadSalesReport
}