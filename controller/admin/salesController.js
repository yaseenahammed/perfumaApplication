const Order=require('../../models/orderSchema')
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const PDFkit=require('pdfkit-table');

const { getBestPrice } = require('../../helpers/offerHelper');

const getSalesReport = async (req, res) => {
    try {
        const { period = 'daily', startDate, endDate, page = 1 } = req.query;
        const perPage = 10;

        let filter = {};
        let start, end;

      
        if (period === 'custom' && startDate && endDate) {
            const startDateObj = new Date(startDate);
            const endDateObj = new Date(endDate);
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            if (startDateObj > today || endDateObj > today)
                return res.status(400).send('Dates cannot be in the future.');
            if (endDateObj < startDateObj)
                return res.status(400).send('End date cannot be before start date.');

            filter.createdAt = { $gte: startDateObj, $lte: endDateObj };
        } else if (period === 'daily') {
            const today = new Date();
            start = new Date(today.setHours(0, 0, 0, 0));
            end = new Date(today.setHours(23, 59, 59, 999));
            filter.createdAt = { $gte: start, $lte: end };
        } else if (period === 'weekly') {
            end = new Date();
            start = new Date();
            start.setDate(start.getDate() - 7);
            filter.createdAt = { $gte: start, $lte: end };
        } else if (period === 'yearly') {
            end = new Date();
            start = new Date();
            start.setFullYear(start.getFullYear() - 1);
            filter.createdAt = { $gte: start, $lte: end };
        }

        const totalOrders = await Order.countDocuments(filter);
       

       
       

        const orders = await Order.find(filter)
            .populate('user')
            .populate('items.product')
            .sort({ createdAt: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .lean();

           
            


     
        const enrichedOrders = await Promise.all(
            orders.map(async (order) => {
                const itemsWithBestOffer = await Promise.all(
                    order.items.map(async (item) => {
                        const product = item.product;
                        const { finalPrice, bestOffer } = await getBestPrice(product);
                        return {
                            ...item,
                            regularPrice: product.regularPrice,
                            quantity: item.quantity,
                            bestOffer,  
                            finalPrice
                        };
                    })
                );

                const subtotal = itemsWithBestOffer.reduce(
                    (sum, item) => sum + item.regularPrice * item.quantity,
                    0
                );

                const totalAfterOffers = itemsWithBestOffer.reduce(
                    (sum, item) => sum + item.finalPrice * item.quantity,
                    0
                );

                
             
                const shipping =  50;
                const couponDiscount = order.discountPrice || 0
                const finalAmount = order.finalAmount
                const discountPercentage = subtotal > 0  ? ((subtotal - totalAfterOffers) / subtotal * 100).toFixed(2)  : 0;
              
              

                return {
                    ...order,
                    items: itemsWithBestOffer,
                    subtotal,
                    shipping,
                    couponDiscount,
                    finalAmount,
                    discountPercentage,
                    
                   
                };
            })
        );

          
  


      
  
      const summary = {
  totalSales: totalOrders,
  subtotal: enrichedOrders.reduce((sum, o) => sum + o.subtotal, 0),
  totalAmount: enrichedOrders.reduce((sum, o) => sum + (o.netAmount !== undefined ? o.netAmount : o.finalAmount), 0), 
  shipping: enrichedOrders.reduce((sum, o) => sum + o.shipping, 0),
  totalDiscount: enrichedOrders.reduce((sum, o) => sum + o.discountPrice, 0),
 
  

  
};




        res.render('salesReport', {
            salesData: enrichedOrders,
            summary,
            totalPages: Math.ceil(totalOrders / perPage),
            currentPage: Number(page),
            period,
            startDate,
            endDate,
        
            
           
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

      
        const orders = await Order.find(filter)
            .populate('user')
            .populate('items.product')
            .sort({ createdAt: -1 })
            .lean();

   
        const enrichedOrders = await Promise.all(
            orders.map(async (order) => {
                const itemsWithBestOffer = await Promise.all(
                    order.items.map(async (item) => {
                        const product = item.product;
                        const { finalPrice, bestOffer } = await getBestPrice(product);
                        return {
                            ...item,
                            regularPrice: product.regularPrice,
                            quantity: item.quantity,
                            bestOffer,
                            finalPrice
                        };
                    })
                );

                const subtotal = itemsWithBestOffer.reduce(
                    (sum, item) => sum + item.regularPrice * item.quantity,
                    0
                );

                const totalAfterOffers = itemsWithBestOffer.reduce(
                    (sum, item) => sum + item.finalPrice * item.quantity,
                    0
                );

               
                const shipping = 50;
                const couponDiscount = order.discountPrice || 0;
                const finalAmount = order.finalAmount;
                const discountPercentage =
                    subtotal > 0
                        ? ((subtotal - totalAfterOffers) / subtotal * 100).toFixed(2)
                        : 0;

                return {
                    ...order,
                    items: itemsWithBestOffer,
                    subtotal,
                    shipping,
                    couponDiscount,
                    finalAmount,
                    discountPercentage
                };
            })
        );

    
        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            worksheet.columns = [
                { header: 'Order ID', key: 'orderID', width: 20 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Customer', key: 'customer', width: 20 },
                { header: 'Subtotal', key: 'subtotal', width: 15 },
                { header: 'Discount %', key: 'discountPercentage', width: 15 },
                { header: 'Shipping', key: 'shipping', width: 15 },
               { header: 'Coupon Discount', key: 'couponDiscount', width: 20 },
               { header: 'Coupon', key: 'coupon', width: 20 },
                { header: 'Final Amount', key: 'finalAmount', width: 15 },
                 { header: 'Status', key: 'status', width: 15 }
            ];

            enrichedOrders.forEach(order => {
                worksheet.addRow({
                    orderID: order.orderID,
                    date: new Date(order.createdAt).toLocaleDateString(),
                    customer: order.user?.name || 'Unknown',
                    subtotal: order.subtotal,
                    shipping: order.shipping,
                    discountPercentage: order.discountPercentage,
                    couponDiscount: order.discountPrice || 0,
                    coupon:order.couponCode || 'None',
                    finalAmount: order.finalAmount,
                   status: order.orderStatus
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

 
    const headers = [
        'Order ID',
        'Date',
        'Customer',
        'Subtotal',
        'Disc %',
        'Shipping',
        'Discount',
        'Coupon',
        'Final',
        'Status'
    ];

    const columnWidths = [65, 55, 70, 55, 45, 55, 55, 55, 55, 75]; 
    const totalTableWidth = columnWidths.reduce((a, b) => a + b, 0);

    const startX = (doc.page.width - totalTableWidth) / 2; 
    let y = doc.y;
    const rowHeight = 25;


    doc.moveTo(startX, y).lineTo(startX + totalTableWidth, y).stroke();

    let x = startX;
    headers.forEach((header, i) => {
        doc.font('Helvetica-Bold').fontSize(9).text(header, x + 2, y + 7, {
            width: columnWidths[i] - 4,
            align: 'center'
        });
        x += columnWidths[i];
    });

    
    doc.moveTo(startX, y + rowHeight).lineTo(startX + totalTableWidth, y + rowHeight).stroke();
    y += rowHeight;

  
    enrichedOrders.forEach((order, rowIndex) => {
        x = startX;
        const row = [
            order.orderID || 'N/A',
            order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
            order.user?.name || 'Unknown',
            order.subtotal ?? 0,
            (order.discountPercentage ?? 0) + '%',
            order.shipping ?? 0,
            order.discountPrice ?? 0,
            order.couponCode || 'None',
            order.finalAmount ?? 0,
            order.orderStatus || 'None'
        ];

     
        if (rowIndex % 2 === 0) {
            doc.rect(startX, y, totalTableWidth, rowHeight).fill('#f5f5f5').stroke();
            doc.fillColor('black');
        }

        row.forEach((cell, i) => {
            doc.font('Helvetica').fontSize(8).text(cell.toString(), x + 2, y + 7, {
                width: columnWidths[i] - 4,
                align: 'center'
            });
            x += columnWidths[i];
        });

        
        doc.moveTo(startX, y + rowHeight).lineTo(startX + totalTableWidth, y + rowHeight).stroke();

        y += rowHeight;

       
        if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
            doc.addPage();
            y = doc.y;
        }
    });

   
    doc.moveTo(startX, doc.y - (enrichedOrders.length * rowHeight) - rowHeight) // top
        .lineTo(startX, y) 
        .stroke();
    doc.moveTo(startX + totalTableWidth, doc.y - (enrichedOrders.length * rowHeight) - rowHeight)
        .lineTo(startX + totalTableWidth, y)
        .stroke();

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