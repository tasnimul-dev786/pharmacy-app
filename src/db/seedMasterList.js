import { db } from './index.js';

/**
 * medicinesMaster টেবিল খালি থাকলে, public/data/medicines-master.json
 * থেকে ডাটা লোড করে একবারই সিড করে।
 * অ্যাপ চালু হওয়ার সময় main.js থেকে কল করতে হবে।
 */
export async function seedMasterListIfEmpty() {
  const existingCount = await db.medicinesMaster.count();
  if (existingCount > 0) {
    console.log(`medicinesMaster আগে থেকেই আছে (${existingCount} এন্ট্রি) — সিড স্কিপ করা হলো।`);
    return { seeded: false, count: existingCount };
  }

  console.log('medicinesMaster খালি — মাস্টার লিস্ট ডাউনলোড করে সিড করা হচ্ছে...');
  const res = await fetch('/data/medicines-master.json');
  if (!res.ok) {
    throw new Error(`মাস্টার লিস্ট ফেচ করতে ব্যর্থ: ${res.status}`);
  }
  const data = await res.json();

  // bulkAdd বড় ডাটাসেটের জন্য একটা একটা করে add() এর চেয়ে অনেক ফাস্ট
  await db.medicinesMaster.bulkAdd(data);

  console.log(`সিডিং সম্পন্ন — ${data.length} টা মেডিসিন যোগ হয়েছে।`);
  return { seeded: true, count: data.length };
}
