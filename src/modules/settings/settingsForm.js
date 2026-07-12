import { getShopInfo, saveShopInfo } from './settingsRepo.js';

export async function renderShopInfoForm(container) {
  const info = await getShopInfo();
  container.innerHTML = `
    <details class="optional-fields">
      <summary>দোকানের তথ্য (ইনভয়েসে দেখাবে)</summary>
      <div class="form-field">
        <label for="shopName">দোকানের নাম</label>
        <input type="text" id="shopName" value="${info.shopName || ''}" />
      </div>
      <div class="form-field">
        <label for="shopAddress">ঠিকানা</label>
        <input type="text" id="shopAddress" value="${info.address || ''}" />
      </div>
      <div class="form-field">
        <label for="shopPhone">ফোন নম্বর</label>
        <input type="text" id="shopPhone" value="${info.phone || ''}" />
      </div>
      <button id="save-shop-info-btn" class="btn-secondary">সেভ করো</button>
      <span id="shop-info-msg" class="form-message"></span>
    </details>
  `;

  container.querySelector('#save-shop-info-btn').addEventListener('click', async () => {
    const shopName = container.querySelector('#shopName').value;
    const address = container.querySelector('#shopAddress').value;
    const phone = container.querySelector('#shopPhone').value;
    await saveShopInfo({ shopName, address, phone });
    const msg = container.querySelector('#shop-info-msg');
    msg.textContent = '✓ সেভ হয়েছে';
    msg.className = 'form-message success';
  });
}
