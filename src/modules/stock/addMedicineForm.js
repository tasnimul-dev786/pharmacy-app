import { searchMasterList, addMedicineToStock } from './stockRepo.js';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * container এর ভেতরে "নতুন মেডিসিন যোগ করো" ফর্ম রেন্ডার করে।
 * onSuccess কল হয় যখন মেডিসিন সফলভাবে স্টকে যোগ হয় (list রিফ্রেশ করার জন্য)।
 */
export function renderAddMedicineForm(container, onSuccess) {
  container.innerHTML = `
    <form id="add-medicine-form" class="stock-form">
      <div class="form-field autocomplete-wrapper">
        <label for="brandName">মেডিসিনের নাম *</label>
        <input type="text" id="brandName" name="brandName" autocomplete="off" required placeholder="যেমন: Napa" />
        <ul id="suggestions" class="suggestions-list hidden"></ul>
      </div>

      <div class="form-field">
        <label for="genericName">জেনেরিক নাম (ঐচ্ছিক)</label>
        <input type="text" id="genericName" name="genericName" placeholder="যেমন: Paracetamol" />
      </div>

      <div class="form-field">
        <label for="quantity">কোয়ান্টিটি *</label>
        <input type="number" id="quantity" name="quantity" min="0" required placeholder="যেমন: 100" />
      </div>

      <details class="optional-fields">
        <summary>ব্যাচ / এক্সপায়ারি / দাম (ঐচ্ছিক)</summary>

        <div class="form-field">
          <label for="batchNo">ব্যাচ নম্বর</label>
          <input type="text" id="batchNo" name="batchNo" placeholder="যেমন: B-2026-01" />
        </div>

        <div class="form-field">
          <label for="expiryDate">এক্সপায়ারি ডেট</label>
          <input type="date" id="expiryDate" name="expiryDate" />
        </div>

        <div class="form-field">
          <label for="unitPrice">ইউনিট প্রাইস (টাকা)</label>
          <input type="number" id="unitPrice" name="unitPrice" min="0" step="0.01" placeholder="যেমন: 5.00" />
        </div>
      </details>

      <div id="form-message" class="form-message"></div>

      <button type="submit" class="btn-primary">স্টকে যোগ করো</button>
    </form>
  `;

  const form = container.querySelector('#add-medicine-form');
  const brandInput = container.querySelector('#brandName');
  const genericInput = container.querySelector('#genericName');
  const suggestionsList = container.querySelector('#suggestions');
  const messageEl = container.querySelector('#form-message');

  let selectedFromList = false;

  // --- অটোকমপ্লিট ---
  const runSearch = debounce(async (query) => {
    if (selectedFromList) {
      selectedFromList = false;
      return;
    }
    if (!query.trim()) {
      suggestionsList.classList.add('hidden');
      suggestionsList.innerHTML = '';
      return;
    }

    const results = await searchMasterList(query);
    if (results.length === 0) {
      suggestionsList.classList.add('hidden');
      suggestionsList.innerHTML = '';
      return;
    }

    suggestionsList.innerHTML = results
      .map(
        (r, i) => `
        <li data-index="${i}" class="suggestion-item">
          <span class="s-brand">${r.brandName}</span>
          <span class="s-generic">${r.genericName || ''} ${r.strength ? '· ' + r.strength : ''}</span>
        </li>`
      )
      .join('');
    suggestionsList.classList.remove('hidden');

    suggestionsList.querySelectorAll('.suggestion-item').forEach((li, i) => {
      li.addEventListener('click', () => {
        const chosen = results[i];
        selectedFromList = true;
        brandInput.value = chosen.brandName;
        genericInput.value = chosen.genericName || '';
        suggestionsList.classList.add('hidden');
        suggestionsList.innerHTML = '';
      });
    });
  }, 250);

  brandInput.addEventListener('input', (e) => runSearch(e.target.value));

  // ইনপুটের বাইরে ক্লিক করলে সাজেশন লিস্ট বন্ধ হবে
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) return;
    if (!e.target.closest('.autocomplete-wrapper')) {
      suggestionsList.classList.add('hidden');
    }
  });

  // --- ফর্ম সাবমিট ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageEl.textContent = '';
    messageEl.className = 'form-message';

    const formData = new FormData(form);

    try {
      await addMedicineToStock({
        brandName: formData.get('brandName'),
        genericName: formData.get('genericName'),
        quantity: formData.get('quantity'),
        batchNo: formData.get('batchNo'),
        expiryDate: formData.get('expiryDate'),
        unitPrice: formData.get('unitPrice'),
      });

      messageEl.textContent = '✓ মেডিসিন স্টকে যোগ হয়েছে';
      messageEl.classList.add('success');
      form.reset();

      if (onSuccess) onSuccess();
    } catch (err) {
      messageEl.textContent = '✗ ' + err.message;
      messageEl.classList.add('error');
    }
  });
}
