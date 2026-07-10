import { db } from '../../db/index.js';

/**
 * অটোকমপ্লিট সাজেশনের জন্য — medicinesMaster টেবিলে brandName দিয়ে সার্চ
 * শুরুর অক্ষর দিয়ে ম্যাচ করে (case-insensitive), সর্বোচ্চ ১০টা রেজাল্ট
 */
export async function searchMasterList(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results = await db.medicinesMaster
    .where('brandName')
    .startsWithIgnoreCase(trimmed)
    .limit(10)
    .toArray();

  return results;
}

/**
 * দোকানের নিজস্ব স্টকে নতুন মেডিসিন যোগ করা
 * শুধু brandName ও quantity আবশ্যিক, বাকি সব ঐচ্ছিক
 *
 * unit: 'piece' | 'strip' | 'box'
 * piecesPerStrip: unit যদি 'strip' বা 'box' হয়, তাহলে ১ স্ট্রিপে কয়টা পিস
 * stripsPerBox: unit যদি 'box' হয়, তাহলে ১ বক্সে কয়টা স্ট্রিপ
 */
export async function addMedicineToStock({
  brandName,
  genericName = '',
  quantity,
  unit = 'piece',
  piecesPerStrip = 1,
  stripsPerBox = 1,
  batchNo = '',
  expiryDate = '',
  unitPrice = null,
}) {
  if (!brandName || !brandName.trim()) {
    throw new Error('মেডিসিনের নাম আবশ্যিক');
  }
  if (quantity === null || quantity === undefined || quantity === '' || isNaN(quantity)) {
    throw new Error('সঠিক কোয়ান্টিটি দিতে হবে');
  }
  if (Number(quantity) < 0) {
    throw new Error('কোয়ান্টিটি ঋণাত্মক হতে পারে না');
  }

  const pps = Number(piecesPerStrip) > 0 ? Number(piecesPerStrip) : 1;
  const spb = Number(stripsPerBox) > 0 ? Number(stripsPerBox) : 1;

  let totalPieces;
  if (unit === 'box') {
    totalPieces = Number(quantity) * spb * pps;
  } else if (unit === 'strip') {
    totalPieces = Number(quantity) * pps;
  } else {
    totalPieces = Number(quantity);
  }

  const id = await db.medicines.add({
    brandName: brandName.trim(),
    genericName: genericName.trim(),
    quantity: Number(quantity),
    unit,
    piecesPerStrip: pps,
    stripsPerBox: spb,
    totalPieces,
    batchNo: batchNo.trim(),
    expiryDate: expiryDate || null,
    unitPrice: unitPrice !== null && unitPrice !== '' ? Number(unitPrice) : null,
    createdAt: new Date().toISOString(),
  });

  return id;
}

/** দোকানের বর্তমান স্টক লিস্ট — নতুনগুলো আগে দেখানোর জন্য id অনুযায়ী উল্টো সাজানো */
export async function getAllStock() {
  return await db.medicines.orderBy('id').reverse().toArray();
}
