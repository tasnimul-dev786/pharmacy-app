import { searchStock } from '../stock/stockRepo.js';
import { confirmSale, getAllSales, getInvoiceBySaleId, getTopSellingStock } from './salesRepo.js';
import { downloadInvoicePDF } from './invoicePdf.js';
import { printReceipt } from './receiptPrint.js';
import { renderShopInfoForm } from '../settings/settingsForm.js';
import {
  getCart,
  addToCart,
  removeFromCart,
  updateCartItemUnit,
  getCartTotal,
  onCartChange,
  clearCart,
} from './cart.js';

const unitOptionLabels = { piece: 'পিস', strip: 'স্ট্রিপ' };

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function renderCartTable(el, { onConfirmed } = {}) {
  const cart = getCart();
  if (cart.length === 0) {
    el.innerHTML = '<p class="empty-note">কার্ট খালি — উপরে সার্চ করে মেডিসিন যোগ করো।</p>';
    return;
  }

  el.innerHTML = `
    <table class="cart-table">
      <thead>
        <tr><th>নাম</th><th>কোয়ান্টিটি</th><th>একক</th><th>দাম</th><th>সাবটোটাল</th><th></th></tr>
      </thead>
      <tbody>
        ${cart
          .map(
            (c) => `
          <tr data-key="${c.productKey}">
            <td>${c.brandName}${c.genericName ? `<div class="s-generic">${c.genericName}</div>` : ''}</td>
            <td><input type="number" class="cart-qty" min="1" value="${c.saleQty}" data-key="${c.productKey}" placeholder="সংখ্যা" /></td>
            <td>
              <select class="cart-unit" data-key="${c.productKey}">
                <option value="piece" ${c.saleUnit === 'piece' ? 'selected' : ''}>পিস</option>
                <option value="strip" ${c.saleUnit === 'strip' ? 'selected' : ''} ${c.piecesPerStrip <= 1 ? 'disabled' : ''}>
                  স্ট্রিপ${c.piecesPerStrip <= 1 ? ' (তথ্য নেই)' : ''}
                </option>
              </select>
            </td>
            <td><input type="number" class="cart-price" min="0" step="0.01" value="${c.unitPrice}" data-key="${c.productKey}" /></td>
            <td class="cart-subtotal">৳${((Number(c.saleQty) || 0) * c.unitPrice).toFixed(2)}</td>
            <td><button class="row-btn cart-remove-btn" data-key="${c.productKey}" title="বাদ দাও">🗑️</button></td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="cart-total">মোট: ৳${getCartTotal().toFixed(2)}</div>
    <div id="sale-message" class="form-message"></div>
    <button id="confirm-sale-btn" class="btn-primary" style="margin-top:0.4rem">সেল কনফার্ম করো</button>
  `;

  el.querySelector('#confirm-sale-btn').addEventListener('click', async () => {
    const msgEl = el.querySelector('#sale-message');
    msgEl.textContent = '';
    msgEl.className = 'form-message';
    try {
      const result = await confirmSale(getCart());
      msgEl.innerHTML = `✓ সেল সম্পন্ন — ইনভয়েস: ${result.invoiceNumber}, মোট: ৳${result.total.toFixed(2)} &nbsp; <button id="download-pdf-btn" class="btn-secondary">📄 PDF</button> <button id="print-receipt-btn" class="btn-secondary">🖨️ প্রিন্ট</button>`;
      msgEl.classList.add('success');
      msgEl.querySelector('#download-pdf-btn').addEventListener('click', () => {
        downloadInvoicePDF(result, result.invoiceNumber);
      });
      msgEl.querySelector('#print-receipt-btn').addEventListener('click', () => {
        printReceipt(result, result.invoiceNumber);
      });
      clearCart();
      if (onConfirmed) onConfirmed();
    } catch (err) {
      msgEl.textContent = '✗ ' + err.message;
      msgEl.classList.add('error');
    }
  });

  function updateRowDisplay(productKey) {
    const item = cart.find((c) => c.productKey === productKey);
    if (!item) return;
    const row = el.querySelector(`tr[data-key="${productKey}"]`);
    if (row) {
      row.querySelector('.cart-subtotal').textContent = `৳${((Number(item.saleQty) || 0) * item.unitPrice).toFixed(2)}`;
    }
    const totalEl = el.querySelector('.cart-total');
    if (totalEl) totalEl.textContent = `মোট: ৳${getCartTotal().toFixed(2)}`;
  }

  el.querySelectorAll('.cart-qty').forEach((input) => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const item = cart.find((c) => c.productKey === key);
      if (item) item.saleQty = e.target.value;
      updateRowDisplay(key);
    });
  });

  el.querySelectorAll('.cart-unit').forEach((select) => {
    select.addEventListener('change', (e) => {
      updateCartItemUnit(e.target.dataset.key, e.target.value);
    });
  });

  el.querySelectorAll('.cart-price').forEach((input) => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const item = cart.find((c) => c.productKey === key);
      if (item) item.unitPrice = e.target.value === '' ? 0 : Number(e.target.value);
      updateRowDisplay(key);
    });
  });

  el.querySelectorAll('.cart-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      removeFromCart(e.target.dataset.key);
    });
  });
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  const monthNames = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'];
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${d.getDate()} ${monthNames[d.getMonth()]}, ${hh}:${mm}`;
}

async function renderSalesHistory(el) {
  const sales = await getAllSales();
  if (sales.length === 0) {
    el.innerHTML = '<p class="empty-note">এখনো কোনো সেল হয়নি।</p>';
    return;
  }
  el.innerHTML = sales
    .slice(0, 20)
    .map(
      (s) => `
      <div class="stock-row" data-sale-id="${s.id}">
        <div>
          <strong>${formatDateTime(s.date)}</strong>
          <div class="s-generic">${s.items.map((i) => `${i.brandName} × ${i.saleQty ?? i.qty} ${unitOptionLabels[i.saleUnit] || 'পিস'}`).join(', ')}</div>
        </div>
        <div class="stock-row-right">
          <span>৳${s.total.toFixed(2)}</span>
          <button class="row-btn history-pdf-btn" data-sale-id="${s.id}" title="PDF ডাউনলোড">📄</button>
          <button class="row-btn history-print-btn" data-sale-id="${s.id}" title="প্রিন্ট">🖨️</button>
        </div>
      </div>`
    )
    .join('');

  el.querySelectorAll('.history-pdf-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const saleId = Number(btn.dataset.saleId);
      const sale = sales.find((s) => s.id === saleId);
      const invoice = await getInvoiceBySaleId(saleId);
      if (sale && invoice) await downloadInvoicePDF(sale, invoice.invoiceNumber);
    });
  });

  el.querySelectorAll('.history-print-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const saleId = Number(btn.dataset.saleId);
      const sale = sales.find((s) => s.id === saleId);
      const invoice = await getInvoiceBySaleId(saleId);
      if (sale && invoice) await printReceipt(sale, invoice.invoiceNumber);
    });
  });
}

/** সেল ভিউ container এর ভেতরে রেন্ডার করে — সার্চ+কার্ট দুটোই পপআপের ভেতরে */
export function renderSaleView(container) {
  container.innerHTML = `
    <h2>সেল</h2>
    <div id="shop-info-container" style="max-width:420px;margin-bottom:1rem"></div>
    <h3>সেলস হিস্ট্রি</h3>
    <div id="sales-history-container"></div>
    <div id="cart-float-bar" class="cart-float-bar">
      <span id="cart-float-summary">+ নতুন সেল</span>
    </div>
  `;

  renderShopInfoForm(container.querySelector('#shop-info-container'));

  const historyContainer = container.querySelector('#sales-history-container');
  const floatBar = container.querySelector('#cart-float-bar');
  const floatSummary = container.querySelector('#cart-float-summary');

  let cartModalOverlay = null;

  function updateFloatBar() {
    const cart = getCart();
    if (cart.length === 0) {
      floatSummary.textContent = '+ নতুন সেল';
    } else {
      floatSummary.textContent = `🛒 ${cart.length} · ৳${getCartTotal().toFixed(2)}`;
    }
    if (cartModalOverlay) {
      const modalCartEl = cartModalOverlay.querySelector('.cart-modal-body');
      if (modalCartEl) renderCartTable(modalCartEl, { onConfirmed: closeCartModal });
    }
  }

  function closeCartModal() {
    if (cartModalOverlay) {
      cartModalOverlay.remove();
      cartModalOverlay = null;
    }
    renderSalesHistory(historyContainer);
  }

  function openCartModal() {
    if (cartModalOverlay) return;
    cartModalOverlay = document.createElement('div');
    cartModalOverlay.className = 'modal-overlay';
    cartModalOverlay.innerHTML = `
      <div class="modal-box cart-modal-box">
        <div class="modal-header">
          <strong>নতুন সেল</strong>
          <button class="modal-close-btn" title="বন্ধ করো">✕</button>
        </div>
        <div class="form-field autocomplete-wrapper">
          <input type="text" id="sale-search" autocomplete="off" placeholder="মেডিসিন খুঁজুন..." />
          <ul id="sale-suggestions" class="suggestions-list hidden"></ul>
        </div>
        <div class="cart-modal-body" style="margin-top:1rem"></div>
      </div>
    `;
    document.body.appendChild(cartModalOverlay);

    cartModalOverlay.querySelector('.modal-close-btn').addEventListener('click', closeCartModal);
    cartModalOverlay.addEventListener('click', (e) => {
      if (e.target === cartModalOverlay) closeCartModal();
    });

    renderCartTable(cartModalOverlay.querySelector('.cart-modal-body'), { onConfirmed: closeCartModal });
    wireSearch(cartModalOverlay);
  }

  function wireSearch(modalEl) {
    const searchInput = modalEl.querySelector('#sale-search');
    const suggestionsList = modalEl.querySelector('#sale-suggestions');

    function hideSuggestions() {
      suggestionsList.classList.add('hidden');
      suggestionsList.innerHTML = '';
    }

    function showSuggestions(results, { emptyLabel = 'স্টকে পাওয়া যায়নি' } = {}) {
      if (results.length === 0) {
        suggestionsList.innerHTML = `<li class="suggestion-item">${emptyLabel}</li>`;
        suggestionsList.classList.remove('hidden');
        return;
      }
      suggestionsList.innerHTML = results
        .map(
          (r, i) => `
          <li data-index="${i}" class="suggestion-item">
            <span class="s-brand">${r.brandName}</span>
            <span class="s-generic">${r.genericName || ''} · স্টকে ${r.totalPieces} পিস</span>
          </li>`
        )
        .join('');
      suggestionsList.classList.remove('hidden');

      suggestionsList.querySelectorAll('.suggestion-item').forEach((li, i) => {
        li.addEventListener('click', () => {
          addToCart(results[i]);
          searchInput.value = '';
          hideSuggestions();
          searchInput.focus();
        });
      });
    }

    const runSearch = debounce(async (query) => {
      if (!query.trim()) {
        const top = await getTopSellingStock(8);
        showSuggestions(top, { emptyLabel: 'স্টকে এখনো কিছু নেই' });
        return;
      }
      const results = await searchStock(query);
      showSuggestions(results);
    }, 250);

    searchInput.addEventListener('input', (e) => runSearch(e.target.value));

    searchInput.addEventListener('focus', async () => {
      if (!searchInput.value.trim()) {
        const top = await getTopSellingStock(8);
        showSuggestions(top, { emptyLabel: 'স্টকে এখনো কিছু নেই' });
      }
    });

    modalEl.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-wrapper')) hideSuggestions();
    });

    searchInput.focus();
  }

  floatBar.addEventListener('click', openCartModal);

  onCartChange(updateFloatBar);
  updateFloatBar();
  renderSalesHistory(historyContainer);
}
