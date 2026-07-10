import Dexie from 'dexie';

// একটাই IndexedDB ডাটাবেজ, নাম: PharmacyDB
export const db = new Dexie('PharmacyDB');

// ভার্সন ১ স্কিমা
// Dexie-তে প্রতিটা স্ট্রিং হলো ইনডেক্স করা কলামের লিস্ট।
// প্রথম কলাম সবসময় প্রাইমারি কি (++ মানে অটো-ইনক্রিমেন্ট)।
db.version(1).stores({
  // দোকানের নিজস্ব স্টক — যেসব মেডিসিন আসলে বিক্রি হচ্ছে
  medicines: '++id, brandName, genericName, batchNo, expiryDate, quantity',

  // সরকারি/পাবলিক মেডিসিন মাস্টার লিস্ট — শুধু অটোকমপ্লিট সাজেশনের জন্য
  // (ফেজ ০ স্টেপ ৩-এ CSV থেকে এখানে ডাটা লোড হবে)
  medicinesMaster: '++id, brandName, genericName',

  // প্রতিটা সেল ট্রানজেকশন
  sales: '++id, date, customerName, total',

  // প্রতিটা সেলের ইনভয়েস রেকর্ড
  invoices: '++id, saleId, invoiceNumber, date, printed',
});

// ছোট্ট হেলথ-চেক ফাংশন — DB ঠিকমতো ওপেন হচ্ছে কিনা যাচাই করতে
export async function checkDbConnection() {
  await db.open();
  return db.isOpen();
}
