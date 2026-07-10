// এই স্ক্রিপ্ট একবার চালাতে হয় — raw CSV থেকে medicines master list তৈরি করতে।
// ব্যবহার: node scripts/build-medicine-master.mjs

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const RAW_CSV_PATH = process.argv[2] || '../Medicine-s-Dataset/medicine.csv';
const OUTPUT_PATH = './public/data/medicines-master.json';

const raw = fs.readFileSync(RAW_CSV_PATH, 'utf-8');

const records = parse(raw, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
});

console.log('মোট রেকর্ড পাওয়া গেছে:', records.length);

// শুধু দরকারি ফিল্ড রাখছি, নাম দিয়ে ডুপ্লিকেট বাদ দিচ্ছি
const seen = new Set();
const cleaned = [];

for (const r of records) {
  const brandName = (r['Name'] || '').trim();
  const genericName = (r['Generic Name'] || '').trim();
  const strength = (r['MG'] || '').trim();
  const type = (r['Type'] || '').trim();
  const company = (r['Company Name'] || '').trim();

  if (!brandName) continue;

  const key = `${brandName}|${strength}|${company}`;
  if (seen.has(key)) continue;
  seen.add(key);

  cleaned.push({ brandName, genericName, strength, type, company });
}

console.log('ডুপ্লিকেট বাদ দেওয়ার পর:', cleaned.length);

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cleaned));

const sizeKB = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
console.log(`লেখা হয়েছে: ${OUTPUT_PATH} (${sizeKB} KB)`);
