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

// ভার্সন ২ — Unit conversion (বক্স/স্ট্রিপ/পিস) যোগ হওয়ায় totalPieces ইনডেক্স করা হলো।
// পুরনো এন্ট্রিতে totalPieces খালি থাকবে, নতুন এন্ট্রি থেকে ভরবে।
// Dexie নিজে থেকেই পুরনো ডাটা সংরক্ষণ করে ভার্সন আপগ্রেড করে।
db.version(2).stores({
  medicines: '++id, brandName, genericName, batchNo, expiryDate, quantity, totalPieces',
  medicinesMaster: '++id, brandName, genericName',
  sales: '++id, date, customerName, total',
  invoices: '++id, saleId, invoiceNumber, date, printed',
});

// ভার্সন ৩ — দোকানের তথ্য (ইনভয়েস হেডারের জন্য) রাখার টেবিল
db.version(3).stores({
  medicines: '++id, brandName, genericName, batchNo, expiryDate, quantity, totalPieces',
  medicinesMaster: '++id, brandName, genericName',
  sales: '++id, date, customerName, total',
  invoices: '++id, saleId, invoiceNumber, date, printed',
  settings: 'key',
});

// ছোট্ট হেলথ-চেক ফাংশন — DB ঠিকমতো ওপেন হচ্ছে কিনা যাচাই করতে
export async function checkDbConnection() {
  await db.open();
  return db.isOpen();
}
