import { db } from '../../db/index.js';

/**
 * ব্র্যান্ড+জেনেরিক নাম থেকে একটা normalized "প্রোডাক্ট কি" বানায় — গ্রুপিং/অ্যাগ্রিগেশনের জন্য।
 * এক্সট্রা স্পেস, কেস (বড়/ছোট হাতের অক্ষর) উপেক্ষা করে, যাতে "Napa · 500mg" আর
 * "Napa · 500 mg" (স্পেসের ফারাক) আলাদা প্রোডাক্ট হিসেবে গণ্য না হয়।
 */
export function normalizeKey(brandName, genericName) {
  // অক্ষর ও সংখ্যা ছাড়া সব (স্পেস, ·, কমা, হাইফেন ইত্যাদি) বাদ দেওয়া হয়,
  // যাতে "Paracetamol · 500mg" আর "Paracetamol 500 mg" একই প্রোডাক্ট হিসেবে গণ্য হয়
  const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return `${norm(brandName)}|${norm(genericName)}`;
}

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
  purchasePrice = null,
  lowStockThreshold = null,
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
    // কেনার সময়ের আসল তথ্য — সেল হয়ে স্টক কমলেও এটা বদলাবে না, ইতিহাস হিসেবে থেকে যাবে
    purchasedQuantity: Number(quantity),
    purchasedUnit: unit,
    purchasedTotalPieces: totalPieces,
    batchNo: batchNo.trim(),
    expiryDate: expiryDate || null,
    unitPrice: unitPrice !== null && unitPrice !== '' ? Number(unitPrice) : null,
    purchasePrice: purchasePrice !== null && purchasePrice !== '' ? Number(purchasePrice) : null,
    lowStockThreshold: lowStockThreshold !== null && lowStockThreshold !== '' ? Number(lowStockThreshold) : null,
    createdAt: new Date().toISOString(),
  });

  return id;
}

/**
 * সেল স্ক্রিনের জন্য — দোকানের নিজস্ব স্টকে সার্চ করা, একই প্রোডাক্টের সব ব্যাচ
 * একসাথে যোগ করে একটাই রেজাল্ট হিসেবে দেখানো হয় (কাস্টমার "কোন ব্যাচ" জানতে চায় না,
 * সেটা confirmSale এর সময় FEFO অনুযায়ী নিজে থেকে ঠিক হয়)।
 */
export async function searchStock(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const matches = await db.medicines
    .where('brandName')
    .startsWithIgnoreCase(trimmed)
    .toArray();

  return aggregateByProduct(matches).slice(0, 10);
}

/** ব্যাচ-লেভেল রেকর্ডের লিস্ট থেকে প্রোডাক্ট-লেভেল অ্যাগ্রিগেট বানানো (helper, স্টক/অ্যালার্ট/সেল সব জায়গায় ব্যবহারযোগ্য) */
export function aggregateByProduct(batchRecords, { filterAvailable = true } = {}) {
  const groups = new Map();
  for (const m of batchRecords) {
    const key = normalizeKey(m.brandName, m.genericName);
    if (!groups.has(key)) {
      groups.set(key, {
        productKey: key,
        brandName: m.brandName,
        genericName: m.genericName,
        batches: [],
        totalPieces: 0,
      });
    }
    const g = groups.get(key);
    g.batches.push(m);
    g.totalPieces += m.totalPieces ?? m.quantity;
  }

  let list = Array.from(groups.values());
  if (filterAvailable) {
    list = list.filter((g) => g.totalPieces > 0);
  }

  return list
    .map((g) => {
      // যে ব্যাচে সবচেয়ে ভালো conversion তথ্য (piecesPerStrip > 1) আছে সেটাই representative —
      // শুধু "latest by id" ধরলে পুরনো/ভুল ব্যাচের তথ্য চলে আসতে পারে
      const sorted = [...g.batches].sort((a, b) => {
        const aHas = (a.piecesPerStrip || 1) > 1 ? 1 : 0;
        const bHas = (b.piecesPerStrip || 1) > 1 ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return b.id - a.id;
      });
      const best = sorted[0];
      return {
        ...g,
        piecesPerStrip: best.piecesPerStrip || 1,
        unitPrice: best.unitPrice ?? 0,
        lowStockThreshold: g.batches.find((b) => b.lowStockThreshold != null)?.lowStockThreshold ?? null,
      };
    })
    .sort((a, b) => Math.max(...b.batches.map((x) => x.id)) - Math.max(...a.batches.map((x) => x.id)));
}

/** একটা মেডিসিনের বর্তমান স্টক (id দিয়ে) — সেল কনফার্ম করার আগে যাচাইয়ের জন্য */
export async function getMedicineById(id) {
  return await db.medicines.get(id);
}

/** দোকানের বর্তমান স্টক লিস্ট — নতুনগুলো আগে দেখানোর জন্য id অনুযায়ী উল্টো সাজানো */
export async function getAllStock() {
  return await db.medicines.orderBy('id').reverse().toArray();
}

/** এক্সিস্টিং স্টক এন্ট্রি আপডেট করা (একই validation ও conversion লজিক প্রয়োগ হয়) */
export async function updateMedicineInStock(id, {
  brandName,
  genericName = '',
  quantity,
  unit = 'piece',
  piecesPerStrip = 1,
  stripsPerBox = 1,
  batchNo = '',
  expiryDate = '',
  unitPrice = null,
  purchasePrice = null,
  lowStockThreshold = null,
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

  await db.medicines.update(id, {
    brandName: brandName.trim(),
    genericName: genericName.trim(),
    quantity: Number(quantity),
    unit,
    piecesPerStrip: pps,
    stripsPerBox: spb,
    totalPieces,
    purchasedQuantity: Number(quantity),
    purchasedUnit: unit,
    purchasedTotalPieces: totalPieces,
    batchNo: batchNo.trim(),
    expiryDate: expiryDate || null,
    unitPrice: unitPrice !== null && unitPrice !== '' ? Number(unitPrice) : null,
    purchasePrice: purchasePrice !== null && purchasePrice !== '' ? Number(purchasePrice) : null,
    lowStockThreshold: lowStockThreshold !== null && lowStockThreshold !== '' ? Number(lowStockThreshold) : null,
  });
}

/**
 * একই ব্র্যান্ড (ও সম্ভব হলে একই জেনেরিক/স্ট্রেংথ) এর সর্বশেষ স্টক এন্ট্রি খুঁজে বের করা।
 * এটা দিয়ে ইউনিট/কনভার্শন/দাম আগের এন্ট্রি থেকে অটো-ফিল করা হয়।
 */
export async function getLastEntryForBrand(brandName, genericName = '') {
  if (!brandName) return null;

  const candidates = await db.medicines
    .where('brandName')
    .equalsIgnoreCase(brandName.trim())
    .toArray();

  if (candidates.length === 0) return null;

  let matches = candidates;
  if (genericName && genericName.trim()) {
    const filtered = candidates.filter(
      (c) => (c.genericName || '').toLowerCase() === genericName.trim().toLowerCase()
    );
    if (filtered.length > 0) matches = filtered;
  }

  matches.sort((a, b) => b.id - a.id);
  return matches[0];
}

/** স্টক থেকে একটা এন্ট্রি ডিলিট করা */
export async function deleteMedicineFromStock(id) {
  await db.medicines.delete(id);
}
