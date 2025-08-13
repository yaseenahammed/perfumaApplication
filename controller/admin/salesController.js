const Order=require('../../models/orderSchema')
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const PDFkit=require('pdfkit-table');

const getSalesReport = async (req, res) => {
    try {
        const { period = 'daily', startDate, endDate, page = 1 } = req.query;
        const perPage = 10;

        let filter = {};
        let start, end;

        // --- Period Filtering ---
       if (period === 'custom' && startDate && endDate) {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const today = new Date();
    today.setHours(23,59,59,999);

    if (startDateObj > today || endDateObj > today) {
        return res.status(400).send('Dates cannot be in the future.');
    }


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

        const startDateObj = new Date(startDate);
const endDateObj = new Date(endDate);
const today = new Date();
today.setHours(23,59,59,999);

if (startDateObj > today || endDateObj > today) {
    return res.status(400).send('Dates cannot be in the future.');
}


        // --- Total Orders Count ---
        const totalOrders = await Order.countDocuments(filter);

        // --- Fetch Orders with Pagination ---
        const orders = await Order.find(filter)
            .populate('user')
            .populate('items.product')
            .sort({ createdAt: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .lean();

        // --- Summary Aggregation ---
        const summaryAgg = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$totalAmount' },
                    discountPrice: { $sum: '$discountPrice' }
                }
            }
        ]);

        const summary = {
            totalSales: totalOrders,
            totalAmount: summaryAgg[0]?.totalAmount || 0,
            discountPrice: summaryAgg[0]?.discountPrice || 0
        };

        // --- Render EJS ---
        res.render('salesReport', {
            salesData: orders,
            summary,
            totalPages: Math.ceil(totalOrders / perPage),
            currentPage: Number(page),
            period,
            startDate,
            endDate
        });

    } catch (error) {
        console.error('Error in getting sales report:', error);
        res.status(500).send('Internal server error');
    }
};





const downloadSalesReport = async (req, res) => {
    try {
        const { period = 'daily', startDate, endDate, format } = req.query;
        let filter = {};
        let start, end;

      
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
        
        
        
        else if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
    doc.pipe(res);

    doc.fontSize(18).text('Sales Report', { align: 'center' });
    doc.moveDown(1.5);

    const headers = ['Order ID', 'Date', 'Customer', 'Total', 'Discount', 'Coupon', 'Final'];
    const columnWidths = [80, 60, 100, 60, 60, 70, 60];
    const startX = doc.x;
    let y = doc.y;
    const rowHeight = 20;

    // Draw headers
    let x = startX;
    headers.forEach((header, i) => {
        doc.font('Helvetica-Bold').fontSize(10).text(header, x + 2, y + 5, { width: columnWidths[i] - 4, align: 'left' });
        x += columnWidths[i];
    });

    // Draw header border
    doc.moveTo(startX, y)
       .lineTo(startX + columnWidths.reduce((a,b) => a+b, 0), y)
       .stroke();
    doc.moveTo(startX, y + rowHeight)
       .lineTo(startX + columnWidths.reduce((a,b) => a+b, 0), y + rowHeight)
       .stroke();

    // Draw vertical lines for headers
    x = startX;
    columnWidths.forEach(width => {
        doc.moveTo(x, y)
           .lineTo(x, y + rowHeight + orders.length * rowHeight)
           .stroke();
        x += width;
    });
    // Last vertical line at the end
    doc.moveTo(x, y)
       .lineTo(x, y + rowHeight + orders.length * rowHeight)
       .stroke();

    y += rowHeight;

    // Draw rows
    orders.forEach((order, index) => {
        x = startX;
        const row = [
            order.orderID,
            new Date(order.createdAt).toLocaleDateString(),
            order.user?.name || 'Unknown',
            `$${order.totalAmount}`,
            `$${order.discountPrice}`,
            order.couponCode || 'None',
            `$${order.finalAmount}`
        ];

        row.forEach((cell, i) => {
            doc.font('Helvetica').fontSize(9).text(cell.toString(), x + 2, y + 5, { width: columnWidths[i] - 4, align: 'left' });
            x += columnWidths[i];
        });

        // Draw horizontal line after row
        doc.moveTo(startX, y + rowHeight)
           .lineTo(startX + columnWidths.reduce((a,b) => a+b, 0), y + rowHeight)
           .stroke();

        y += rowHeight;

        // Add new page if necessary
        if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
            doc.addPage();
            y = doc.y;
        }
    });

    doc.end();
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