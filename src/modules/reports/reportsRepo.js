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

/** নির্দিষ্ট তারিখ রেঞ্জের (from, to ইনক্লুসিভ, YYYY-MM-DD ফরম্যাট) দৈনিক সেলস, টোটাল ও বিল সংখ্যা */
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
      const key = dateKey(s.date);
      totalsByDate[key] = (totalsByDate[key] || 0) + s.total;
      total += s.total;
      billCount += 1;
    }
  });

  const labels = [];
  const values = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    labels.push(`${cursor.getDate()}/${cursor.getMonth() + 1}`);
    values.push(totalsByDate[key] || 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  return { labels, values, total, billCount };
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
