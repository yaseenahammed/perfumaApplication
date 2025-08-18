// helpers/orderHelper.js
function getItemStatus(orderStatus, itemStatus) {
  if (orderStatus === "Delivered") return itemStatus || "Delivered";
  if (orderStatus === "Cancelled") {
    return itemStatus === "Returned" ? "Returned" : "Cancelled";
  }
  return itemStatus || orderStatus;
}

function getOrderStatus(order) {
  const statuses = order.items.map(item =>
    getItemStatus(order.orderStatus, item.orderStatus)
  );

  if (statuses.every(s => s === "Cancelled")) return "Cancelled";
  if (statuses.every(s => s === "Returned")) return "Returned";
  if (statuses.every(s => s === "Delivered" || s === "Cancelled"))
    return "Delivered";

  if (statuses.some(s => s === "ReturnRequest")) return "ReturnRequest";
  if (statuses.some(s => s === "ReturnRejected")) return "ReturnRejected";
  if (statuses.some(s => s === "Processing")) return "Processing";
  if (statuses.some(s => s === "Shipped")) return "Shipped";

  return order.orderStatus;
}

function canCancelOrder(order) {
  return ["Processing", "Shipped"].includes(order.orderStatus);
}

function canReturnOrder(order) {
  return order.orderStatus === "Delivered";
}

function canCancelItem(orderStatus, itemStatus) {
  return (
    orderStatus === "Processing" &&
    !["Cancelled", "Returned"].includes(itemStatus)
  );
}

function canReturnItem(orderStatus, itemStatus) {
  return (
    orderStatus === "Delivered" &&
    !["Cancelled", "Returned", "ReturnRequest", "ReturnRejected"].includes(
      itemStatus
    )
  );
}



// helpers/orderHelper.js
function updateOrderStatus(order) {
  if (!order.items || order.items.length === 0) {
    return order.orderStatus; // keep old status if no items
  }

  const itemStatuses = order.items.map(item => item.orderStatus);

  // --- Priority Rules ---
  if (itemStatuses.every(s => s === "Cancelled")) {
    return "Cancelled";
  }

  if (itemStatuses.every(s => s === "Returned")) {
    return "Returned";
  }

  if (itemStatuses.includes("Processing")) {
    return "Processing";
  }

  if (itemStatuses.includes("ReturnRequest")) {
    return "ReturnRequest";
  }

  if (itemStatuses.includes("Shipped")) {
    return "Shipped";
  }

  // If at least one Delivered (even if some Returned or ReturnRejected) → Delivered
  if (itemStatuses.includes("Delivered")) {
    return "Delivered";
  }

  // Default fallback
  return order.orderStatus;
}




module.exports = {
  getItemStatus,
  getOrderStatus,
  canCancelOrder,
  canReturnOrder,
  canCancelItem,
  canReturnItem,
  updateOrderStatus
};
