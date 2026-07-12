import './style.css';
import { seedMasterListIfEmpty } from './db/seedMasterList.js';
import { renderStockView } from './modules/stock/stockView.js';
import { renderSaleView } from './modules/sales/saleView.js';

const contentEl = document.getElementById('app-content');

function renderNav(activeTab, onSwitch) {
  const tabs = [
    { key: 'sale', label: 'সেল' },
    { key: 'stock', label: 'স্টক' },
    { key: 'alert', label: 'অ্যালার্ট', disabled: true },
    { key: 'report', label: 'রিপোর্ট', disabled: true },
  ];
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = tabs
    .map(
      (t) => `<button class="nav-btn ${t.key === activeTab ? 'active' : ''}" data-key="${t.key}" ${t.disabled ? 'disabled' : ''}>${t.label}</button>`
    )
    .join('');
  nav.querySelectorAll('.nav-btn:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => onSwitch(btn.dataset.key));
  });
  return nav;
}

async function showTab(key) {
  contentEl.innerHTML = '';
  const nav = renderNav(key, showTab);
  contentEl.appendChild(nav);
  const viewEl = document.createElement('div');
  viewEl.className = 'view-container';
  contentEl.appendChild(viewEl);

  if (key === 'sale') {
    renderSaleView(viewEl);
  } else if (key === 'stock') {
    await renderStockView(viewEl);
  }
}

async function init() {
  contentEl.innerHTML = '<p>মেডিসিন লিস্ট লোড হচ্ছে, একটু অপেক্ষা করুন...</p>';
  await seedMasterListIfEmpty();
  await showTab('sale');
}

init();
