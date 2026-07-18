import { db } from '../../db/index.js';
import { normalizeKey, aggregateByProduct } from '../stock/stockRepo.js';

/**
 * সেল কনফার্ম করা।
 * cartItems: [{ productKey, brandName, genericName, saleUnit, saleQty, piecesPerStrip, unitPrice }]
 *
 * - প্রতিটা প্রোডাক্টের মোট স্টক (সব ব্যাচ মিলিয়ে) যথেষ্ট কিনা যাচাই করে
 * - FEFO (First-Expiry-First-Out): যে ব্যাচের মেয়াদ আগে শেষ হবে সেটা আগে কমে —
 *   এক্সপায়ারি-না-থাকা ব্যাচ সবার শেষে ব্যবহার হয়
 * - sales ও invoices টেবিলে রেকর্ড সেভ করে
 * সব একটা transaction-এ হয় — মাঝপথে সমস্যা হলে কিছুই সেভ হবে না।
 */
export async function confirmSale(cartItems, customerName = '') {
  if (!cartItems || cartItems.length === 0) {
    throw new Error('কার্ট খালি');
  }

  const itemsWithPieces = cartItems.map((c) => ({
    ...c,
    qtyPieces: c.saleUnit === 'strip' ? Number(c.saleQty) * (c.piecesPerStrip || 1) : Number(c.saleQty),
  }));

  for (const item of itemsWithPieces) {
    if (!item.qtyPieces || item.qtyPieces <= 0) {
      throw new Error(`"${item.brandName}" এর কোয়ান্টিটি সঠিকভাবে দাও`);
    }
  }

  return await db.transaction('rw', db.medicines, db.sales, db.invoices, async () => {
    // --- ভ্যালিডেশন: প্রতিটা প্রোডাক্টের এগ্রিগেট স্টক যথেষ্ট কিনা ---
    for (const item of itemsWithPieces) {
      const allBatches = await db.medicines.where('brandName').equalsIgnoreCase(item.brandName).toArray();
      const matching = allBatches.filter((b) => normalizeKey(b.brandName, b.genericName) === item.productKey);
      const available = matching.reduce((sum, b) => sum + (b.totalPieces ?? b.quantity), 0);
      if (item.qtyPieces > available) {
        throw new Error(`"${item.brandName}" এ পর্যাপ্ত স্টক নেই (আছে ${available} পিস, চাওয়া হয়েছে ${item.qtyPieces} পিস)`);
      }
    }

    // --- FEFO ডিডাকশন ---
    for (const item of itemsWithPieces) {
      let remaining = item.qtyPieces;
      const allBatches = await db.medicines.where('brandName').equalsIgnoreCase(item.brandName).toArray();
      const matching = allBatches
        .filter((b) => normalizeKey(b.brandName, b.genericName) === item.productKey)
        .sort((a, b) => {
          const ea = a.expiryDate || '9999-99-99';
          const eb = b.expiryDate || '9999-99-99';
          if (ea !== eb) return ea < eb ? -1 : 1;
          return a.id - b.id;
        });

      for (const batch of matching) {
        if (remaining <= 0) break;
        const batchQty = batch.totalPieces ?? batch.quantity;
        if (batchQty <= 0) continue;
        const deduct = Math.min(batchQty, remaining);
        const newQty = batchQty - deduct;
        await db.medicines.update(batch.id, {
          unit: 'piece',
          quantity: newQty,
          totalPieces: newQty,
          piecesPerStrip: 1,
          stripsPerBox: 1,
        });
        remaining -= deduct;
      }
    }

    const total = itemsWithPieces.reduce((sum, c) => sum + Number(c.saleQty) * c.unitPrice, 0);
    const date = new Date().toISOString();

    const saleItems = itemsWithPieces.map((c) => ({
      brandName: c.brandName,
      genericName: c.genericName,
      saleUnit: c.saleUnit,
      saleQty: Number(c.saleQty),
      qtyPieces: c.qtyPieces,
      unitPrice: c.unitPrice,
      subtotal: Number(c.saleQty) * c.unitPrice,
    }));

    const saleId = await db.sales.add({
      date,
      customerName: customerName.trim(),
      items: saleItems,
      total,
    });

    const invoiceNumber = `INV-${new Date(date).getTime()}`;
    await db.invoices.add({ saleId, invoiceNumber, date, printed: false });

    return { saleId, invoiceNumber, total, date, items: saleItems };
  });
}

/** সেলস হিস্ট্রি — নতুন আগে */
export async function getAllSales() {
  return await db.sales.orderBy('id').reverse().toArray();
}

/** নির্দিষ্ট sale এর ইনভয়েস নম্বর খুঁজে বের করা (PDF আবার বানানোর জন্য) */
export async function getInvoiceBySaleId(saleId) {
  return await db.invoices.where('saleId').equals(saleId).first();
}

/**
 * সবচেয়ে বেশি বিক্রি হওয়া প্রোডাক্ট (এখনো স্টকে আছে এমন) — সেল স্ক্রিনে সার্চ বক্সে
 * ক্লিক করলে ডিফল্ট সাজেশন হিসেবে দেখানোর জন্য। বিক্রির ইতিহাস না থাকলে
 * সাম্প্রতিক যোগ করা স্টক দিয়ে পূরণ করা হয়।
 */
export async function getTopSellingStock(limit = 8) {
  const sales = await db.sales.toArray();
  const qtyByProduct = {};
  sales.forEach((s) => {
    s.items.forEach((i) => {
      const key = normalizeKey(i.brandName, i.genericName);
      qtyByProduct[key] = (qtyByProduct[key] || 0) + (i.qtyPieces ?? i.qty ?? 0);
    });
  });

  const allBatches = await db.medicines.toArray();
  const products = aggregateByProduct(allBatches); // filterAvailable: true by default

  const sortedKeys = Object.entries(qtyByProduct)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  const results = [];
  for (const key of sortedKeys) {
    if (results.length >= limit) break;
    const p = products.find((x) => x.productKey === key);
    if (p) results.push(p);
  }

  if (results.length < limit) {
    for (const p of products) {
      if (results.length >= limit) break;
      if (!results.find((r) => r.productKey === p.productKey)) results.push(p);
    }
  }

  return results;
}

/** নির্দিষ্ট তারিখ রেঞ্জের (from, to ইনক্লুসিভ, YYYY-MM-DD ফরম্যাট) দৈনিক সেলস, টোটাল, বিল সংখ্যা ও সবচেয়ে ভালো দিন */
export async function getSalesInRange(fromDateStr, toDateStr) {
  const sales = await db.sales.toArray();
  const from = new Date(fromDateStr + 'T00:00:00');
  const to = new Date(toDateStr + 'T23:59:59');

  const totalsByDate = {};
  let total = 0;
  let billCount = 0;

  sales.forEach((s) => {
    const d = new Date(s.date);
    if (d >= from && d <= to) {
      const key = new Date(s.date).toISOString().slice(0, 10);
      totalsByDate[key] = (totalsByDate[key] || 0) + s.total;
      total += s.total;
      billCount += 1;
    }
  });

  let bestDay = null;
  Object.entries(totalsByDate).forEach(([key, amount]) => {
    if (!bestDay || amount > bestDay.amount) bestDay = { date: key, amount };
  });

  const numDays = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;

  return { total, billCount, bestDay, numDays };
}

/** আগের সমান-দৈর্ঘ্যের পিরিয়ডের সাথে তুলনা — কত % বাড়ল/কমল */
export async function getPeriodComparison(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr + 'T00:00:00');
  const to = new Date(toDateStr + 'T23:59:59');
  const numDays = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;

  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - numDays + 1);

  const sales = await db.sales.toArray();
  let prevTotal = 0;
  sales.forEach((s) => {
    const d = new Date(s.date);
    if (
      d >= new Date(prevFrom.toISOString().slice(0, 10) + 'T00:00:00') &&
      d <= new Date(prevTo.toISOString().slice(0, 10) + 'T23:59:59')
    ) {
      prevTotal += s.total;
    }
  });

  return { prevTotal };
}

/** নির্দিষ্ট তারিখ রেঞ্জের টপ সেলিং মেডিসিন (রেঞ্জ না দিলে সর্বকালের) */
export async function getTopSellingMedicines(limit = 10, fromDateStr = null, toDateStr = null) {
  const sales = await db.sales.toArray();
  const from = fromDateStr ? new Date(fromDateStr + 'T00:00:00') : null;
  const to = toDateStr ? new Date(toDateStr + 'T23:59:59') : null;

  const agg = {};
  sales.forEach((s) => {
    const d = new Date(s.date);
    if (from && d < from) return;
    if (to && d > to) return;
    s.items.forEach((i) => {
      const key = normalizeKey(i.brandName, i.genericName);
      if (!agg[key]) agg[key] = { brandName: i.brandName, genericName: i.genericName, qty: 0, revenue: 0 };
      agg[key].qty += i.qtyPieces ?? i.qty ?? 0;
      agg[key].revenue += i.subtotal;
    });
  });
  return Object.values(agg)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}
