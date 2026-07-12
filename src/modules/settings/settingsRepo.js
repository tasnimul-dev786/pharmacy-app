import { db } from '../../db/index.js';

const SETTINGS_KEY = 'shopInfo';

const defaultShopInfo = {
  shopName: 'আমার ফার্মেসি',
  address: '',
  phone: '',
};

export async function getShopInfo() {
  const row = await db.settings.get(SETTINGS_KEY);
  return row ? row.value : defaultShopInfo;
}

export async function saveShopInfo(shopInfo) {
  await db.settings.put({ key: SETTINGS_KEY, value: shopInfo });
}
