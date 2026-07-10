import './style.css';
import { seedMasterListIfEmpty } from './db/seedMasterList.js';
import { renderAddMedicineForm } from './modules/stock/addMedicineForm.js';
import { getAllStock, deleteMedicineFromStock } from './modules/stock/stockRepo.js';

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
      <div class="stock-row" data-id="${m.id}">
        <div>
          <strong>${m.brandName}</strong>
          ${m.genericName ? `<span class="s-generic"> · ${m.genericName}</span>` : ''}
        </div>
        <div class="stock-row-right">
          <span>
            ${m.quantity} ${unitLabel}
            ${showTotalPieces ? `<span class="s-generic"> (${m.totalPieces} পিস)</span>` : ''}
          </span>
          <button class="row-btn edit-btn" data-id="${m.id}" title="এডিট">✏️</button>
          <button class="row-btn delete-btn" data-id="${m.id}" title="ডিলিট">🗑️</button>
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
    <h2 id="form-title">নতুন মেডিসিন যোগ করো</h2>
    <div id="add-form-container"></div>
    <h2 style="margin-top:2rem">বর্তমান স্টক</h2>
    <div class="form-field" style="max-width:420px">
      <input type="text" id="stock-search" placeholder="স্টকে খুঁজুন (নাম বা জেনেরিক)..." />
    </div>
    <div id="stock-list-container"></div>
  `;

  const formTitleEl = document.getElementById('form-title');
  const formContainer = document.getElementById('add-form-container');
  const listContainer = document.getElementById('stock-list-container');
  const searchInput = document.getElementById('stock-search');

  await renderStockList(listContainer);

  searchInput.addEventListener('input', (e) => {
    renderStockRows(listContainer, filterStock(currentStock, e.target.value));
  });

  function showAddForm() {
    formTitleEl.textContent = 'নতুন মেডিসিন যোগ করো';
    renderAddMedicineForm(formContainer, async () => {
      await renderStockList(listContainer, searchInput.value);
    });
  }

  function showEditForm(record) {
    formTitleEl.textContent = `মেডিসিন এডিট করো — ${record.brandName}`;
    renderAddMedicineForm(
      formContainer,
      async ({ cancelled }) => {
        await renderStockList(listContainer, searchInput.value);
        showAddForm(); // এডিট শেষ হলে বা বাতিল করলে আবার সাধারণ "যোগ করো" ফর্মে ফেরত
      },
      record
    );
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- এডিট/ডিলিট বাটনের ক্লিক হ্যান্ডলিং (ইভেন্ট ডেলিগেশন) ---
  listContainer.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      const id = Number(editBtn.dataset.id);
      const record = currentStock.find((m) => m.id === id);
      if (record) showEditForm(record);
    }

    if (deleteBtn) {
      const id = Number(deleteBtn.dataset.id);
      const record = currentStock.find((m) => m.id === id);
      const confirmed = window.confirm(
        `"${record?.brandName || 'এই মেডিসিন'}" স্টক থেকে ডিলিট করতে চাও? এটা আর ফেরত আনা যাবে না।`
      );
      if (confirmed) {
        await deleteMedicineFromStock(id);
        await renderStockList(listContainer, searchInput.value);
      }
    }
  });

  showAddForm();
}

init();
