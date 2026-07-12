import {
  getAlertSettings,
  saveAlertSettings,
  getLowStockItems,
  getExpiringItems,
} from './alertsRepo.js';

const unitLabels = { piece: 'পিস', strip: 'স্ট্রিপ', box: 'বক্স' };

function daysUntil(dateObj) {
  const now = new Date();
  const diffMs = dateObj - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function renderLowStockList(el, items) {
  if (items.length === 0) {
    el.innerHTML = '<p class="empty-note">লো স্টকে কিছু নেই — সব ঠিক আছে।</p>';
    return;
  }
  el.innerHTML = items
    .map((m) => {
      const qty = m.totalPieces ?? m.quantity;
      return `
      <div class="stock-row">
        <div>
          <strong>${m.brandName}</strong>
          ${m.genericName ? `<span class="s-generic"> · ${m.genericName}</span>` : ''}
        </div>
        <span class="badge badge-danger">${qty} পিস বাকি</span>
      </div>`;
    })
    .join('');
}

function renderExpiryList(el, items) {
  if (items.length === 0) {
    el.innerHTML = '<p class="empty-note">মেয়াদ শেষ হওয়ার মতো কিছু নেই।</p>';
    return;
  }
  el.innerHTML = items
    .map((m) => {
      const d = daysUntil(m.expiryDateObj);
      const expired = d < 0;
      const label = expired ? `${Math.abs(d)} দিন আগে মেয়াদ শেষ হয়েছে` : `${d} দিনে মেয়াদ শেষ`;
      const badgeClass = expired ? 'badge-danger' : 'badge-warning';
      return `
      <div class="stock-row">
        <div>
          <strong>${m.brandName}</strong>
          ${m.genericName ? `<span class="s-generic"> · ${m.genericName}</span>` : ''}
          <div class="s-generic">ব্যাচ: ${m.batchNo || '—'}</div>
        </div>
        <span class="badge ${badgeClass}">${label}</span>
      </div>`;
    })
    .join('');
}

export async function renderAlertsView(container) {
  const settings = await getAlertSettings();

  container.innerHTML = `
    <h2>অ্যালার্ট</h2>
    <details class="optional-fields">
      <summary>থ্রেশহোল্ড সেটিংস</summary>
      <div class="form-field">
        <label for="low-stock-threshold">লো স্টক থ্রেশহোল্ড (পিস)</label>
        <input type="number" id="low-stock-threshold" min="0" value="${settings.lowStockThreshold}" />
      </div>
      <div class="form-field">
        <label for="expiry-days">এক্সপায়ারির কত দিন আগে থেকে ওয়ার্নিং</label>
        <input type="number" id="expiry-days" min="0" value="${settings.expiryWarningDays}" />
      </div>
      <button id="save-alert-settings-btn" class="btn-secondary">সেভ করো</button>
      <span id="alert-settings-msg" class="form-message"></span>
    </details>

    <h3 style="margin-top:1.5rem">লো স্টক</h3>
    <div id="low-stock-container"></div>

    <h3 style="margin-top:1.5rem">এক্সপায়ারি ওয়ার্নিং</h3>
    <div id="expiry-container"></div>
  `;

  const lowStockEl = container.querySelector('#low-stock-container');
  const expiryEl = container.querySelector('#expiry-container');

  async function refresh() {
    const s = await getAlertSettings();
    const lowStock = await getLowStockItems(s.lowStockThreshold);
    const expiring = await getExpiringItems(s.expiryWarningDays);
    renderLowStockList(lowStockEl, lowStock);
    renderExpiryList(expiryEl, expiring);
  }

  await refresh();

  container.querySelector('#save-alert-settings-btn').addEventListener('click', async () => {
    const lowStockThreshold = Number(container.querySelector('#low-stock-threshold').value) || 0;
    const expiryWarningDays = Number(container.querySelector('#expiry-days').value) || 0;
    await saveAlertSettings({ lowStockThreshold, expiryWarningDays });
    const msg = container.querySelector('#alert-settings-msg');
    msg.textContent = '✓ সেভ হয়েছে';
    msg.className = 'form-message success';
    await refresh();
  });
}
