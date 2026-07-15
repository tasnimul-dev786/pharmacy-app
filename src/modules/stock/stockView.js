import { renderAddMedicineForm } from './addMedicineForm.js';
import { getAllStock, deleteMedicineFromStock, aggregateByProduct } from './stockRepo.js';

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

function batchRowHtml(m, { showName = false } = {}) {
  const unitLabel = unitLabels[m.unit] || 'পিস';
  const purchasedUnitLabel = unitLabels[m.purchasedUnit] || unitLabel;
  const addedDate = formatDate(m.createdAt);
  const showCurrentPieces = m.unit && m.unit !== 'piece' && m.totalPieces;

  const purchasedLine =
    m.purchasedQuantity != null
      ? `${m.purchasedQuantity} ${purchasedUnitLabel}${m.purchasedTotalPieces && m.purchasedUnit !== 'piece' ? ` (${m.purchasedTotalPieces} পিস)` : ''}`
      : `${m.quantity} ${unitLabel}`;

  return `
    <div class="stock-row" data-id="${m.id}">
      <div>
        ${showName ? `<strong>${m.brandName}</strong>${m.genericName ? `<span class="s-generic"> · ${m.genericName}</span>` : ''}<br/>` : ''}
        <span class="s-generic">কেনা হয়েছিল: ${purchasedLine}</span>
        ${m.batchNo ? `<span class="s-generic"> · ব্যাচ: ${m.batchNo}</span>` : ''}
        ${m.expiryDate ? `<span class="s-generic"> · মেয়াদ: ${m.expiryDate}</span>` : ''}
        ${addedDate ? `<div class="s-date">যোগ হয়েছে: ${addedDate}</div>` : ''}
      </div>
      <div class="stock-row-right">
        <span>
          বর্তমানে: ${m.quantity} ${unitLabel}
          ${showCurrentPieces ? `<span class="s-generic"> (${m.totalPieces} পিস)</span>` : ''}
        </span>
        <button class="row-btn edit-btn" data-id="${m.id}" title="এডিট">✏️</button>
        <button class="row-btn delete-btn" data-id="${m.id}" title="ডিলিট">🗑️</button>
      </div>
    </div>`;
}

/** ব্যাচ হিস্ট্রি মোডাল খোলা — একটা প্রোডাক্টের সব ব্যাচ দেখাতে */
function openBatchModal(group, { onChanged }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <strong>${group.brandName}</strong>
          ${group.genericName ? `<span class="s-generic"> · ${group.genericName}</span>` : ''}
        </div>
        <button class="modal-close-btn" title="বন্ধ করো">✕</button>
      </div>
      <div class="batch-list">
        ${group.batches.map(batchRowHtml).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
  }

  overlay.querySelector('.modal-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelectorAll('.edit-btn, .delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      close();
    });
  });

  return { overlay, close };
}

function renderStockRows(listEl, stock, handlers) {
  if (stock.length === 0) {
    listEl.innerHTML = '<p class="empty-note">কোনো মেডিসিন পাওয়া যায়নি।</p>';
    return;
  }
  const groups = aggregateByProduct(stock, { filterAvailable: false });

  listEl.innerHTML = groups
    .map((g) => {
      if (g.batches.length === 1) {
        return batchRowHtml(g.batches[0], { showName: true });
      }
      return `
        <div class="stock-summary-row" data-key="${g.productKey}">
          <div>
            <strong>${g.brandName}</strong>
            ${g.genericName ? `<span class="s-generic"> · ${g.genericName}</span>` : ''}
          </div>
          <span class="badge badge-total">মোট ${g.totalPieces} পিস · ${g.batches.length} ব্যাচ</span>
        </div>`;
    })
    .join('');

  // মাল্টি-ব্যাচ সামারি রো-তে ক্লিক করলে মোডাল খুলবে
  listEl.querySelectorAll('.stock-summary-row').forEach((row) => {
    row.addEventListener('click', () => {
      const group = groups.find((g) => g.productKey === row.dataset.key);
      if (!group) return;
      const { close } = openBatchModal(group, {});
      const modalBox = document.querySelector('.modal-overlay .modal-box');
      wireEditDelete(modalBox, handlers, close);
    });
  });

  wireEditDelete(listEl, handlers);
}

function wireEditDelete(scopeEl, handlers, afterActionClose) {
  scopeEl.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      handlers.onEdit(id);
      if (afterActionClose) afterActionClose();
    });
  });
  scopeEl.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      handlers.onDelete(id);
      if (afterActionClose) afterActionClose();
    });
  });
}

let currentStock = [];

async function renderStockList(listEl, searchQuery, handlers) {
  currentStock = await getAllStock();
  renderStockRows(listEl, filterStock(currentStock, searchQuery), handlers);
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

  function showAddForm() {
    formTitleEl.textContent = 'নতুন মেডিসিন যোগ করো';
    renderAddMedicineForm(formContainer, async () => {
      await renderStockList(listContainer, searchInput.value, handlers);
    });
  }

  function showEditForm(record) {
    formTitleEl.textContent = `মেডিসিন এডিট করো — ${record.brandName}`;
    renderAddMedicineForm(
      formContainer,
      async () => {
        await renderStockList(listContainer, searchInput.value, handlers);
        showAddForm();
      },
      record
    );
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const handlers = {
    onEdit: (id) => {
      const record = currentStock.find((m) => m.id === id);
      if (record) showEditForm(record);
    },
    onDelete: async (id) => {
      const record = currentStock.find((m) => m.id === id);
      const confirmed = window.confirm(
        `"${record?.brandName || 'এই মেডিসিন'}" ব্যাচ স্টক থেকে ডিলিট করতে চাও? এটা আর ফেরত আনা যাবে না।`
      );
      if (confirmed) {
        await deleteMedicineFromStock(id);
        await renderStockList(listContainer, searchInput.value, handlers);
      }
    },
  };

  await renderStockList(listContainer, '', handlers);

  searchInput.addEventListener('input', (e) => {
    renderStockRows(listContainer, filterStock(currentStock, e.target.value), handlers);
  });

  showAddForm();
}
