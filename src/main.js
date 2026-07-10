import './style.css';
import { seedMasterListIfEmpty } from './db/seedMasterList.js';
import { renderAddMedicineForm } from './modules/stock/addMedicineForm.js';
import { getAllStock } from './modules/stock/stockRepo.js';

// এই ফাইলটাই অ্যাপের এন্ট্রি পয়েন্ট।
// পরের মাইক্রোস্টেপে এখান থেকে সেল/ইনভয়েস মডিউল ও রাউটিং যোগ হবে।

const contentEl = document.getElementById('app-content');

const unitLabels = { piece: 'পিস', strip: 'স্ট্রিপ', box: 'বক্স' };

function filterStock(stock, query) {
  const q = query.trim().toLowerCase();
  if (!q) return stock;
  return stock.filter(
    (m) =>
      m.brandName.toLowerCase().includes(q) ||
      (m.genericName && m.genericName.toLowerCase().includes(q))
  );
}

function renderStockRows(listEl, stock) {
  if (stock.length === 0) {
    listEl.innerHTML = '<p class="empty-note">কোনো মেডিসিন পাওয়া যায়নি।</p>';
    return;
  }
  listEl.innerHTML = stock
    .map((m) => {
      const unitLabel = unitLabels[m.unit] || 'পিস';
      const showTotalPieces = m.unit && m.unit !== 'piece' && m.totalPieces;
      return `
      <div class="stock-row">
        <div>
          <strong>${m.brandName}</strong>
          ${m.genericName ? `<span class="s-generic"> · ${m.genericName}</span>` : ''}
        </div>
        <div>
          ${m.quantity} ${unitLabel}
          ${showTotalPieces ? `<span class="s-generic"> (${m.totalPieces} পিস)</span>` : ''}
        </div>
      </div>`;
    })
    .join('');
}

let currentStock = [];

async function renderStockList(listEl, searchQuery = '') {
  currentStock = await getAllStock();
  renderStockRows(listEl, filterStock(currentStock, searchQuery));
}

async function init() {
  contentEl.innerHTML = '<p>মেডিসিন লিস্ট লোড হচ্ছে, একটু অপেক্ষা করুন...</p>';
  await seedMasterListIfEmpty();

  contentEl.innerHTML = `
    <h2>নতুন মেডিসিন যোগ করো</h2>
    <div id="add-form-container"></div>
    <h2 style="margin-top:2rem">বর্তমান স্টক</h2>
    <div class="form-field" style="max-width:420px">
      <input type="text" id="stock-search" placeholder="স্টকে খুঁজুন (নাম বা জেনেরিক)..." />
    </div>
    <div id="stock-list-container"></div>
  `;

  const formContainer = document.getElementById('add-form-container');
  const listContainer = document.getElementById('stock-list-container');
  const searchInput = document.getElementById('stock-search');

  await renderStockList(listContainer);

  searchInput.addEventListener('input', (e) => {
    renderStockRows(listContainer, filterStock(currentStock, e.target.value));
  });

  renderAddMedicineForm(formContainer, async () => {
    await renderStockList(listContainer, searchInput.value);
  });
}

init();
