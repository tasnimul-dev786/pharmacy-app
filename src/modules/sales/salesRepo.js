import { db } from '../../db/index.js';

/**
 * সেল কনফার্ম করা।
 * - স্টক আছে কিনা যাচাই করে (না থাকলে এরর, কিছুই সেভ হবে না)
 * - স্টক থেকে বিক্রিত পরিমাণ বাদ দেয় (totalPieces ভিত্তিতে, ফলে unit 'piece'-এ নেমে আসে)
 * - sales ও invoices টেবিলে রেকর্ড সেভ করে
 * সব একটা transaction-এ হয় — মাঝপথে সমস্যা হলে কিছুই সেভ হবে না।
 */
export async function confirmSale(cartItems, customerName = '') {
  if (!cartItems || cartItems.length === 0) {
    throw new Error('কার্ট খালি');
  }

  return await db.transaction('rw', db.medicines, db.sales, db.invoices, async () => {
    for (const item of cartItems) {
      const medicine = await db.medicines.get(item.medicineId);
      if (!medicine) {
        throw new Error(`"${item.brandName}" স্টকে পাওয়া যায়নি`);
      }
      const available = medicine.totalPieces ?? medicine.quantity;
      if (item.qty > available) {
        throw new Error(`"${item.brandName}" এ পর্যাপ্ত স্টক নেই (আছে ${available}, চাওয়া হয়েছে ${item.qty})`);
      }
    }

    for (const item of cartItems) {
      const medicine = await db.medicines.get(item.medicineId);
      const remaining = (medicine.totalPieces ?? medicine.quantity) - item.qty;
      await db.medicines.update(item.medicineId, {
        unit: 'piece',
        quantity: remaining,
        totalPieces: remaining,
        piecesPerStrip: 1,
        stripsPerBox: 1,
      });
    }

    const total = cartItems.reduce((sum, c) => sum + c.qty * c.unitPrice, 0);
    const date = new Date().toISOString();

    const saleId = await db.sales.add({
      date,
      customerName: customerName.trim(),
      items: cartItems.map((c) => ({
        medicineId: c.medicineId,
        brandName: c.brandName,
        genericName: c.genericName,
        qty: c.qty,
        unitPrice: c.unitPrice,
        subtotal: c.qty * c.unitPrice,
      })),
      total,
    });

    const invoiceNumber = `INV-${new Date(date).getTime()}`;
    await db.invoices.add({
      saleId,
      invoiceNumber,
      date,
      printed: false,
    });

    return { saleId, invoiceNumber, total };
  });
}

/** সেলস হিস্ট্রি — নতুন আগে */
export async function getAllSales() {
  return await db.sales.orderBy('id').reverse().toArray();
}
