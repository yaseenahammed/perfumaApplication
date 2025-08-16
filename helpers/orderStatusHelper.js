function updateOrderStatus(order) {
    const itemStatuses = order.items.map(i => i.orderStatus);

    if (itemStatuses.every(s => s === 'Cancelled')) {
        order.orderStatus = 'Cancelled';
    } 
    else if (itemStatuses.every(s => s === 'Delivered')) {
        order.orderStatus = 'Delivered';
    } 
    else if (itemStatuses.every(s => s === 'ReturnRequest')) {
        order.orderStatus = 'ReturnRequest';
    }
    else if (itemStatuses.every(s => s === 'Returned')) {
        order.orderStatus = 'Returned';
    }
    else if (itemStatuses.every(s => s === 'Rejected')) {
        order.orderStatus = 'Rejected';
    }
    else {
        // If mixed statuses, keep it as Processing
        order.orderStatus = 'Processing';
    }
}

module.exports={updateOrderStatus}