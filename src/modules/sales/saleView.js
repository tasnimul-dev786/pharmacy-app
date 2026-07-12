import { searchStock } from '../stock/stockRepo.js';
import { confirmSale, getAllSales, getInvoiceBySaleId } from './salesRepo.js';
import { downloadInvoicePDF } from './invoicePdf.js';
import { renderShopInfoForm } from '../settings/settingsForm.js';
import {
  getCart,
  addToCart,
  updateCartItemQty,
  updateCartItemPrice,
  removeFromCart,
  getCartTotal,
  onCartChange,
  clearCart,
} from './cart.js';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function renderCartTable(el) {
  const cart = getCart();
  if (cart.length === 0) {
    el.innerHTML = '<p class="empty-note">কার্ট খালি — উপরে সার্চ করে মেডিসিন যোগ করো।</p>';
    return;
  }

  el.innerHTML = `
    <table class="cart-table">
      <thead>
        <tr><th>নাম</th><th>কোয়ান্টিটি</th><th>দাম</th><th>সাবটোটাল</th><th></th></tr>
      </thead>
      <tbody>
        ${cart
          .map(
            (c) => `
          <tr data-id="${c.medicineId}">
            <td>${c.brandName}${c.genericName ? `<div class="s-generic">${c.genericName}</div>` : ''}</td>
            <td><input type="number" class="cart-qty" min="1" value="${c.qty}" data-id="${c.medicineId}" /></td>
            <td><input type="number" class="cart-price" min="0" step="0.01" value="${c.unitPrice}" data-id="${c.medicineId}" /></td>
            <td>৳${(c.qty * c.unitPrice).toFixed(2)}</td>
            <td><button class="row-btn cart-remove-btn" data-id="${c.medicineId}" title="বাদ দাও">🗑️</button></td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="cart-total">মোট: ৳${getCartTotal().toFixed(2)}</div>
    <button id="confirm-sale-btn" class="btn-primary" style="margin-top:0.4rem">সেল কনফার্ম করো</button>
  `;

  el.querySelector('#confirm-sale-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('sale-message');
    msgEl.textContent = '';
    msgEl.className = 'form-message';
    try {
      const result = await confirmSale(getCart());
      msgEl.innerHTML = `✓ সেল সম্পন্ন — ইনভয়েস: ${result.invoiceNumber}, মোট: ৳${result.total.toFixed(2)} &nbsp; <button id="download-pdf-btn" class="btn-secondary">📄 PDF ডাউনলোড</button>`;
      msgEl.classList.add('success');
      msgEl.querySelector('#download-pdf-btn').addEventListener('click', () => {
        downloadInvoicePDF(result, result.invoiceNumber);
      });
      clearCart();
      renderSalesHistory(document.getElementById('sales-history-container'));
    } catch (err) {
      msgEl.textContent = '✗ ' + err.message;
      msgEl.classList.add('error');
    }
  });

  el.querySelectorAll('.cart-qty').forEach((input) => {
    input.addEventListener('input', (e) => {
      updateCartItemQty(Number(e.target.dataset.id), e.target.value);
    });
  });
  el.querySelectorAll('.cart-price').forEach((input) => {
    input.addEventListener('input', (e) => {
      updateCartItemPrice(Number(e.target.dataset.id), e.target.value);
    });
  });
  el.querySelectorAll('.cart-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      removeFromCart(Number(e.target.dataset.id));
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
          <div class="s-generic">${s.items.map((i) => `${i.brandName} × ${i.qty}`).join(', ')}</div>
        </div>
        <div class="stock-row-right">
          <span>৳${s.total.toFixed(2)}</span>
          <button class="row-btn history-pdf-btn" data-sale-id="${s.id}" title="PDF ডাউনলোড">📄</button>
        </div>
      </div>`
    )
    .join('');

  el.querySelectorAll('.history-pdf-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const saleId = Number(btn.dataset.saleId);
      const sale = sales.find((s) => s.id === saleId);
      const invoice = await getInvoiceBySaleId(saleId);
      if (sale && invoice) {
        await downloadInvoicePDF(sale, invoice.invoiceNumber);
      }
    });
  });
}

/** সেল ভিউ (সার্চ + কার্ট) container এর ভেতরে রেন্ডার করে */
export function renderSaleView(container) {
  container.innerHTML = `
    <h2>সেল</h2>
    <div id="shop-info-container" style="max-width:420px;margin-bottom:1rem"></div>
    <div class="form-field autocomplete-wrapper" style="max-width:420px">
      <input type="text" id="sale-search" autocomplete="off" placeholder="মেডিসিন খুঁজুন..." />
      <ul id="sale-suggestions" class="suggestions-list hidden"></ul>
    </div>
    <h3 style="margin-top:1.5rem">কার্ট</h3>
    <div id="cart-container"></div>
    <div id="sale-message" class="form-message"></div>
    <h3 style="margin-top:2rem">সেলস হিস্ট্রি (সাম্প্রতিক ২০টা)</h3>
    <div id="sales-history-container"></div>
  `;

  renderShopInfoForm(container.querySelector('#shop-info-container'));

  const searchInput = container.querySelector('#sale-search');
  const suggestionsList = container.querySelector('#sale-suggestions');
  const cartContainer = container.querySelector('#cart-container');
  const historyContainer = container.querySelector('#sales-history-container');

  onCartChange(() => renderCartTable(cartContainer));
  renderCartTable(cartContainer);
  renderSalesHistory(historyContainer);

  const runSearch = debounce(async (query) => {
    if (!query.trim()) {
      suggestionsList.classList.add('hidden');
      suggestionsList.innerHTML = '';
      return;
    }
    const results = await searchStock(query);
    if (results.length === 0) {
      suggestionsList.innerHTML = '<li class="suggestion-item">স্টকে পাওয়া যায়নি</li>';
      suggestionsList.classList.remove('hidden');
      return;
    }
    suggestionsList.innerHTML = results
      .map(
        (r, i) => `
        <li data-index="${i}" class="suggestion-item">
          <span class="s-brand">${r.brandName}</span>
          <span class="s-generic">${r.genericName || ''} · স্টকে ${r.totalPieces ?? r.quantity} পিস</span>
        </li>`
      )
      .join('');
    suggestionsList.classList.remove('hidden');

    suggestionsList.querySelectorAll('.suggestion-item').forEach((li, i) => {
      li.addEventListener('click', () => {
        addToCart(results[i]);
        searchInput.value = '';
        suggestionsList.classList.add('hidden');
        suggestionsList.innerHTML = '';
        searchInput.focus();
      });
    });
  }, 250);

  searchInput.addEventListener('input', (e) => runSearch(e.target.value));

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) return;
    if (!e.target.closest('.autocomplete-wrapper')) {
      suggestionsList.classList.add('hidden');
    }
  });
}
