let cart = [];
const listeners = [];

export function getCart() {
  return cart;
}

export function addToCart(medicine) {
  const existing = cart.find((c) => c.medicineId === medicine.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      medicineId: medicine.id,
      brandName: medicine.brandName,
      genericName: medicine.genericName,
      unitPrice: medicine.unitPrice || 0,
      availableTotalPieces: medicine.totalPieces ?? medicine.quantity,
      qty: 1,
    });
  }
  notify();
}

export function updateCartItemQty(medicineId, qty) {
  const item = cart.find((c) => c.medicineId === medicineId);
  if (item) item.qty = Math.max(1, Number(qty) || 1);
  notify();
}

export function updateCartItemPrice(medicineId, price) {
  const item = cart.find((c) => c.medicineId === medicineId);
  if (item) item.unitPrice = Math.max(0, Number(price) || 0);
  notify();
}

export function removeFromCart(medicineId) {
  cart = cart.filter((c) => c.medicineId !== medicineId);
  notify();
}

export function clearCart() {
  cart = [];
  notify();
}

export function getCartTotal() {
  return cart.reduce((sum, c) => sum + c.qty * c.unitPrice, 0);
}

export function onCartChange(fn) {
  listeners.push(fn);
}

function notify() {
  listeners.forEach((fn) => fn(cart));
}
