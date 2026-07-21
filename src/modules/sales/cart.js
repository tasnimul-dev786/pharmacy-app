// কার্টের প্রতিটা আইটেম এখন প্রোডাক্ট-লেভেলে (productKey দিয়ে), ব্যাচ-লেভেল না —
// একই মেডিসিনের একাধিক ব্যাচ থাকলেও কার্টে একটাই লাইন থাকবে।

let cart = [];
let discount = { value: 0, type: 'flat' }; // type: 'flat' (৳) | 'percent' (%)
const listeners = [];

export function getCart() {
  return cart;
}

export function setDiscount(value, type) {
  discount = { value: Math.max(0, Number(value) || 0), type };
  notify();
}

export function getDiscount() {
  return discount;
}

export function getDiscountAmount() {
  const subtotal = getCartTotal();
  const amount = discount.type === 'percent' ? (subtotal * discount.value) / 100 : discount.value;
  return Math.min(subtotal, Math.max(0, amount));
}

export function getGrandTotal() {
  return getCartTotal() - getDiscountAmount();
}

/**
 * product: { productKey, brandName, genericName, totalPieces, piecesPerStrip, unitPrice }
 * নতুন হলে qty ফাঁকা রাখা হয় (বিক্রেতা নিজে হাতে বসাবে, ভুল সংখ্যা এড়াতে)।
 * আগে থেকে থাকলে qty ১ বাড়িয়ে দেওয়া হয়।
 */
export function addToCart(product) {
  const existing = cart.find((c) => c.productKey === product.productKey);
  if (existing) {
    const current = Number(existing.saleQty) || 0;
    existing.saleQty = current + 1;
  } else {
    const pricePerPiece = product.unitPrice || 0;
    cart.push({
      productKey: product.productKey,
      brandName: product.brandName,
      genericName: product.genericName,
      availableTotalPieces: product.totalPieces,
      piecesPerStrip: product.piecesPerStrip || 1,
      saleUnit: 'piece',
      saleQty: '',
      pricePerPiece,
      unitPrice: pricePerPiece,
    });
  }
  notify();
  return existing ? existing.productKey : product.productKey;
}

export function updateCartItemQty(productKey, qty) {
  const item = cart.find((c) => c.productKey === productKey);
  if (item) item.saleQty = qty;
  notify();
}

export function updateCartItemUnit(productKey, unit) {
  const item = cart.find((c) => c.productKey === productKey);
  if (item) {
    item.saleUnit = unit;
    // unit বদলালে দাম-ও যেন সেই ইউনিট অনুযায়ী স্বাভাবিক (সঠিক) মান দেখায়
    // — যেমন স্ট্রিপে বদলালে প্রতি-স্ট্রিপ দাম (পিস দাম × piecesPerStrip)
    item.unitPrice = unit === 'strip' ? item.pricePerPiece * (item.piecesPerStrip || 1) : item.pricePerPiece;
  }
  notify();
}

export function updateCartItemPrice(productKey, price) {
  const item = cart.find((c) => c.productKey === productKey);
  if (item) item.unitPrice = Math.max(0, Number(price) || 0);
  notify();
}

export function removeFromCart(productKey) {
  cart = cart.filter((c) => c.productKey !== productKey);
  notify();
}

export function clearCart() {
  cart = [];
  discount = { value: 0, type: 'flat' };
  notify();
}

/** কার্ট আইটেমকে পিস-এ কনভার্ট করে (স্টক ডিডাকশন/ভ্যালিডেশনের জন্য) */
export function qtyInPieces(item) {
  const qty = Number(item.saleQty) || 0;
  return item.saleUnit === 'strip' ? qty * (item.piecesPerStrip || 1) : qty;
}

export function getCartTotal() {
  return cart.reduce((sum, c) => sum + (Number(c.saleQty) || 0) * c.unitPrice, 0);
}

export function onCartChange(fn) {
  listeners.push(fn);
}

function notify() {
  listeners.forEach((fn) => fn(cart));
}
