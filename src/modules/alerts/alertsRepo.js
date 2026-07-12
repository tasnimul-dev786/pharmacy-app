import { db } from '../../db/index.js';

const SETTINGS_KEY = 'alertSettings';

const defaultAlertSettings = {
  lowStockThreshold: 10,
  expiryWarningDays: 60,
};

export async function getAlertSettings() {
  const row = await db.settings.get(SETTINGS_KEY);
  return row ? { ...defaultAlertSettings, ...row.value } : defaultAlertSettings;
}

export async function saveAlertSettings(settings) {
  await db.settings.put({ key: SETTINGS_KEY, value: settings });
}

/** যেসব মেডিসিন থ্রেশহোল্ডের নিচে (প্রতিটার নিজস্ব lowStockThreshold থাকলে সেটা, নাহলে গ্লোবাল ডিফল্ট) */
export async function getLowStockItems(globalThreshold) {
  const all = await db.medicines.toArray();
  return all
    .filter((m) => {
      const threshold = m.lowStockThreshold ?? globalThreshold;
      return (m.totalPieces ?? m.quantity) <= threshold;
    })
    .sort((a, b) => (a.totalPieces ?? a.quantity) - (b.totalPieces ?? b.quantity));
}

/** যেসব মেডিসিনের এক্সপায়ারি ডেট আছে এবং আগামী N দিনের মধ্যে (বা ইতিমধ্যে পার হয়ে গেছে) */
export async function getExpiringItems(days) {
  const all = await db.medicines.toArray();
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() + days);

  return all
    .filter((m) => m.expiryDate)
    .map((m) => ({ ...m, expiryDateObj: new Date(m.expiryDate) }))
    .filter((m) => m.expiryDateObj <= cutoff)
    .sort((a, b) => a.expiryDateObj - b.expiryDateObj);
}
