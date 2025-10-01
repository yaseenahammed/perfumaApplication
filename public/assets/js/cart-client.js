// Update the cart count badge
function updateCartCount(newCount) {
  const span = document.querySelector('.cart-count');
  if (!span) return;

  span.textContent = newCount || 0;

  if (newCount > 0) {
    span.classList.remove('hidden');
  } else {
    span.classList.add('hidden');
  }
}

// Handle adding product to cart
async function handleAddToCart(productId, btn) {
  try {
    btn.disabled = true;

    const res = await fetch(`/add-to-cart/${productId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ quantity: 1 })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      updateCartCount(data.cartItemCount);

      // Show feedback on button
      const originalText = btn.innerHTML;
      btn.innerHTML = `<i class="fas fa-check mr-2 text-green-600"></i> Added`;
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 1000);
    } else {
   
      Swal.fire({
            title: data.error || data.message || 'Failed to add cart',
            text: 'Failed Adding to Cart',
            icon:'error',
            showConfirmButton: false,
            timer: 1500,
            toast: true,
            position: 'top-end',
            width: '300px'
          });
    }
  } catch (err) {
    console.error('Add to cart error:', err);
   
  } finally {
    btn.disabled = false;
  }
}

// Attach event listeners on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // All buttons across different pages
  document.querySelectorAll('.button-add-to-cart, .add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = btn.dataset.productId || btn.dataset.id;
      if (productId) handleAddToCart(productId, btn);
    });
  });
});


