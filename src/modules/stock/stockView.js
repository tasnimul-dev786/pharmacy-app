import { renderAddMedicineForm } from './addMedicineForm.js';
import { getAllStock, deleteMedicineFromStock } from './stockRepo.js';

const unitLabels = { piece: 'পিস', strip: 'স্ট্রিপ', box: 'বক্স' };

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const day = d.getDate();
  const monthNames = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'];
  return `${day} ${monthNames[d.getMonth()]}`;
}

function filterStock(stock, query) {
  const q = query.trim().toLowerCase();
  if (!q) return stock;
  return stock.filter(
    (m) =>
      m.brandName.toLowerCase().includes(q) ||
      (m.genericName && m.genericName.toLowerCase().includes(q))
  );
}

/** brandName+genericName অনুযায়ী গ্রুপ করা — একই প্রোডাক্টের একাধিক ব্যাচ একসাথে দেখানোর জন্য */
function groupStock(stock) {
  const groups = new Map();
  for (const m of stock) {
    const key = `${m.brandName}|${m.genericName || ''}`;
    if (!groups.has(key)) {
      groups.set(key, { brandName: m.brandName, genericName: m.genericName, batches: [], totalPieces: 0 });
    }
    const g = groups.get(key);
    g.batches.push(m);
    g.totalPieces += m.totalPieces ?? m.quantity;
  }
  // নতুন batch যোগ হওয়ার ভিত্তিতে গ্রুপ সাজানো (সবচেয়ে সাম্প্রতিক আগে)
  return Array.from(groups.values()).sort((a, b) => Math.max(...b.batches.map((x) => x.id)) - Math.max(...a.batches.map((x) => x.id)));
}

function renderBatchRow(m) {
  const unitLabel = unitLabels[m.unit] || 'পিস';
  const showTotalPieces = m.unit && m.unit !== 'piece' && m.totalPieces;
  const addedDate = formatDate(m.createdAt);
  return `
    <div class="stock-row" data-id="${m.id}" style="padding-left:1rem;border-left:2px solid #eee;">
      <div>
        ${m.batchNo ? `<span class="s-generic">ব্যাচ: ${m.batchNo}</span>` : ''}
        ${m.expiryDate ? `<span class="s-generic"> · মেয়াদ: ${m.expiryDate}</span>` : ''}
        ${addedDate ? `<div class="s-date">যোগ হয়েছে: ${addedDate}</div>` : ''}
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
}

function renderStockRows(listEl, stock) {
  if (stock.length === 0) {
    listEl.innerHTML = '<p class="empty-note">কোনো মেডিসিন পাওয়া যায়নি।</p>';
    return;
  }
  const groups = groupStock(stock);
  listEl.innerHTML = groups
    .map((g) => {
      const multiBatch = g.batches.length > 1;
      const batchesHtml = g.batches.map(renderBatchRow).join('');
      if (!multiBatch) {
        // একটাই ব্যাচ হলে আলাদা করে গ্রুপ হেডার না দেখিয়ে সরাসরি রো দেখানো
        return batchesHtml;
      }
      return `
        <details class="stock-group">
          <summary class="stock-group-summary">
            <strong>${g.brandName}</strong>
            ${g.genericName ? `<span class="s-generic"> · ${g.genericName}</span>` : ''}
            <span class="badge badge-total">মোট ${g.totalPieces} পিস · ${g.batches.length} ব্যাচ</span>
          </summary>
          ${batchesHtml}
        </details>`;
    })
    .join('');
}

let currentStock = [];

async function renderStockList(listEl, searchQuery = '') {
  currentStock = await getAllStock();
  renderStockRows(listEl, filterStock(currentStock, searchQuery));
}

/** স্টক ভিউ (ফর্ম + লিস্ট + সার্চ + এডিট/ডিলিট) container এর ভেতরে রেন্ডার করে */
export async function renderStockView(container) {
  container.innerHTML = `
    <h2 id="form-title">নতুন মেডিসিন যোগ করো</h2>
    <div id="add-form-container"></div>
    <h2 style="margin-top:2rem">বর্তমান স্টক</h2>
    <div class="form-field" style="max-width:420px">
      <input type="text" id="stock-search" placeholder="স্টকে খুঁজুন (নাম বা জেনেরিক)..." />
    </div>
    <div id="stock-list-container"></div>
  `;

  const formTitleEl = container.querySelector('#form-title');
  const formContainer = container.querySelector('#add-form-container');
  const listContainer = container.querySelector('#stock-list-container');
  const searchInput = container.querySelector('#stock-search');

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
      async () => {
        await renderStockList(listContainer, searchInput.value);
        showAddForm();
      },
      record
    );
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
        `"${record?.brandName || 'এই মেডিসিন'}" ব্যাচ স্টক থেকে ডিলিট করতে চাও? এটা আর ফেরত আনা যাবে না।`
      );
      if (confirmed) {
        await deleteMedicineFromStock(id);
        await renderStockList(listContainer, searchInput.value);
      }
    }
  });

  showAddForm();
}
