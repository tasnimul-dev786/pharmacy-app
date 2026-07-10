import './style.css';
import { seedMasterListIfEmpty } from './db/seedMasterList.js';
import { renderAddMedicineForm } from './modules/stock/addMedicineForm.js';
import { getAllStock } from './modules/stock/stockRepo.js';

// এই ফাইলটাই অ্যাপের এন্ট্রি পয়েন্ট।
// পরের মাইক্রোস্টেপে এখান থেকে সেল/ইনভয়েস মডিউল ও রাউটিং যোগ হবে।

const contentEl = document.getElementById('app-content');

async function renderStockList(listEl) {
  const stock = await getAllStock();
  if (stock.length === 0) {
    listEl.innerHTML = '<p class="empty-note">এখনো কোনো মেডিসিন যোগ করা হয়নি।</p>';
    return;
  }
  listEl.innerHTML = stock
    .map(
      (m) => `
      <div class="stock-row">
        <div>
          <strong>${m.brandName}</strong>
          ${m.genericName ? `<span class="s-generic"> · ${m.genericName}</span>` : ''}
        </div>
        <div>${m.quantity} পিস</div>
      </div>`
    )
    .join('');
}

async function init() {
  contentEl.innerHTML = '<p>মেডিসিন লিস্ট লোড হচ্ছে, একটু অপেক্ষা করুন...</p>';
  await seedMasterListIfEmpty();

  contentEl.innerHTML = `
    <h2>নতুন মেডিসিন যোগ করো</h2>
    <div id="add-form-container"></div>
    <h2 style="margin-top:2rem">বর্তমান স্টক</h2>
    <div id="stock-list-container"></div>
  `;

  const formContainer = document.getElementById('add-form-container');
  const listContainer = document.getElementById('stock-list-container');

  await renderStockList(listContainer);

  renderAddMedicineForm(formContainer, async () => {
    await renderStockList(listContainer);
  });
}

init();
