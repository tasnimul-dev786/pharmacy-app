import { db } from '../../db/index.js';

function dateKey(isoString) {
  return new Date(isoString).toISOString().slice(0, 10); // YYYY-MM-DD
}

function monthKey(isoString) {
  return new Date(isoString).toISOString().slice(0, 7); // YYYY-MM
}

/** শেষ N দিনের দৈনিক সেলস টোটাল — চার্টের জন্য {labels, values} */
export async function getDailySales(days = 14) {
  const sales = await db.sales.toArray();
  const totalsByDate = {};
  sales.forEach((s) => {
    const key = dateKey(s.date);
    totalsByDate[key] = (totalsByDate[key] || 0) + s.total;
  });

  const labels = [];
  const values = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    values.push(totalsByDate[key] || 0);
  }
  return { labels, values };
}

/** শেষ N মাসের মাসিক সেলস টোটাল */
export async function getMonthlySales(months = 6) {
  const sales = await db.sales.toArray();
  const totalsByMonth = {};
  sales.forEach((s) => {
    const key = monthKey(s.date);
    totalsByMonth[key] = (totalsByMonth[key] || 0) + s.total;
  });

  const monthNames = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'];
  const labels = [];
  const values = [];
  const today = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    labels.push(monthNames[d.getMonth()]);
    values.push(totalsByMonth[key] || 0);
  }
  return { labels, values };
}

/** সর্বকালের টপ সেলিং মেডিসিন (qty ও revenue ভিত্তিতে) */
export async function getTopSellingMedicines(limit = 10) {
  const sales = await db.sales.toArray();
  const agg = {};
  sales.forEach((s) => {
    s.items.forEach((i) => {
      const key = i.brandName;
      if (!agg[key]) agg[key] = { brandName: i.brandName, genericName: i.genericName, qty: 0, revenue: 0 };
      agg[key].qty += i.qty;
      agg[key].revenue += i.subtotal;
    });
  });
  return Object.values(agg)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}
