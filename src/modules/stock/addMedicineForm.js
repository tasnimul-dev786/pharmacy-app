import { searchMasterList, addMedicineToStock, updateMedicineInStock, getLastEntryForBrand } from './stockRepo.js';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * container এর ভেতরে "নতুন মেডিসিন যোগ করো" (বা এডিট) ফর্ম রেন্ডার করে।
 * onSuccess কল হয় যখন মেডিসিন সফলভাবে সেভ হয় (list রিফ্রেশ করার জন্য)।
 * editRecord দিলে ফর্ম এডিট-মোডে চলে যায় (প্রিফিল করা, "আপডেট করো" বাটন)।
 */
export function renderAddMedicineForm(container, onSuccess, editRecord = null) {
  const isEdit = !!editRecord;

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

      <div class="form-field">
        <label for="unit">এককের ধরন *</label>
        <select id="unit" name="unit">
          <option value="piece">পিস</option>
          <option value="strip">স্ট্রিপ</option>
          <option value="box">বক্স</option>
        </select>
      </div>

      <div id="conversion-fields" class="conversion-fields hidden">
        <div class="form-field" id="piecesPerStrip-field">
          <label for="piecesPerStrip">১ স্ট্রিপে কয়টা পিস?</label>
          <input type="number" id="piecesPerStrip" name="piecesPerStrip" min="1" placeholder="যেমন: 10" />
        </div>
        <div class="form-field" id="stripsPerBox-field">
          <label for="stripsPerBox">১ বক্সে কয়টা স্ট্রিপ?</label>
          <input type="number" id="stripsPerBox" name="stripsPerBox" min="1" placeholder="যেমন: 10" />
        </div>
      </div>

      <details class="optional-fields" ${isEdit ? 'open' : ''}>
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

        <div class="form-field">
          <label for="lowStockThreshold">লো স্টক থ্রেশহোল্ড (পিস, খালি রাখলে গ্লোবাল ডিফল্ট ব্যবহার হবে)</label>
          <input type="number" id="lowStockThreshold" name="lowStockThreshold" min="0" placeholder="যেমন: 20" />
        </div>
      </details>

      <div id="form-message" class="form-message"></div>

      <div class="form-actions">
        <button type="submit" class="btn-primary">${isEdit ? 'আপডেট করো' : 'স্টকে যোগ করো'}</button>
        ${isEdit ? '<button type="button" id="cancel-edit-btn" class="btn-secondary">বাতিল</button>' : ''}
      </div>
    </form>
  `;

  const form = container.querySelector('#add-medicine-form');
  const brandInput = container.querySelector('#brandName');
  const genericInput = container.querySelector('#genericName');
  const suggestionsList = container.querySelector('#suggestions');
  const messageEl = container.querySelector('#form-message');
  const unitSelect = container.querySelector('#unit');
  const conversionFields = container.querySelector('#conversion-fields');
  const piecesPerStripField = container.querySelector('#piecesPerStrip-field');
  const stripsPerBoxField = container.querySelector('#stripsPerBox-field');
  const quantityInput = container.querySelector('#quantity');
  const batchInput = container.querySelector('#batchNo');
  const expiryInput = container.querySelector('#expiryDate');
  const priceInput = container.querySelector('#unitPrice');
  const lowStockThresholdInput = container.querySelector('#lowStockThreshold');
  const piecesPerStripInput = container.querySelector('#piecesPerStrip');
  const stripsPerBoxInput = container.querySelector('#stripsPerBox');

  // --- এডিট মোড হলে ফিল্ডগুলো প্রিফিল করা ---
  if (isEdit) {
    brandInput.value = editRecord.brandName || '';
    genericInput.value = editRecord.genericName || '';
    quantityInput.value = editRecord.quantity ?? '';
    unitSelect.value = editRecord.unit || 'piece';
    batchInput.value = editRecord.batchNo || '';
    expiryInput.value = editRecord.expiryDate || '';
    priceInput.value = editRecord.unitPrice ?? '';
    lowStockThresholdInput.value = editRecord.lowStockThreshold ?? '';
    piecesPerStripInput.value = editRecord.piecesPerStrip || '';
    stripsPerBoxInput.value = editRecord.stripsPerBox || '';
  }

  function updateConversionFieldsVisibility() {
    const unit = unitSelect.value;
    if (unit === 'piece') {
      conversionFields.classList.add('hidden');
    } else if (unit === 'strip') {
      conversionFields.classList.remove('hidden');
      piecesPerStripField.classList.remove('hidden');
      stripsPerBoxField.classList.add('hidden');
    } else if (unit === 'box') {
      conversionFields.classList.remove('hidden');
      piecesPerStripField.classList.remove('hidden');
      stripsPerBoxField.classList.remove('hidden');
    }
  }

  unitSelect.addEventListener('change', updateConversionFieldsVisibility);
  updateConversionFieldsVisibility();

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
      li.addEventListener('click', async () => {
        const chosen = results[i];
        selectedFromList = true;
        brandInput.value = chosen.brandName;
        // জেনেরিক নামের সাথে স্ট্রেংথও জুড়ে দেওয়া হচ্ছে (যেমন: Metronidazole · 400mg)
        // যাতে একই ব্র্যান্ডের বিভিন্ন স্ট্রেংথ (400mg vs 200mg) আলাদা করা যায়
        genericInput.value = [chosen.genericName, chosen.strength].filter(Boolean).join(' · ');
        suggestionsList.classList.add('hidden');
        suggestionsList.innerHTML = '';

        // --- আগে এই মেডিসিন (একই ব্র্যান্ড+স্ট্রেংথ) স্টকে যোগ করা থাকলে
        // তার ইউনিট/কনভার্শন/দাম অটো-ফিল করা হচ্ছে ---
        const lastEntry = await getLastEntryForBrand(chosen.brandName, genericInput.value);
        if (lastEntry && !isEdit) {
          unitSelect.value = lastEntry.unit || 'piece';
          piecesPerStripInput.value = lastEntry.piecesPerStrip || '';
          stripsPerBoxInput.value = lastEntry.stripsPerBox || '';
          priceInput.value = lastEntry.unitPrice ?? '';
          lowStockThresholdInput.value = lastEntry.lowStockThreshold ?? '';
          updateConversionFieldsVisibility();
          messageEl.textContent = 'ℹ️ আগের এন্ট্রি থেকে ইউনিট ও দাম অটো-ফিল করা হয়েছে, চাইলে বদলে দাও';
          messageEl.className = 'form-message';
        }
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

  // --- বাতিল বাটন (শুধু এডিট মোডে) ---
  if (isEdit) {
    container.querySelector('#cancel-edit-btn').addEventListener('click', () => {
      if (onSuccess) onSuccess({ cancelled: true });
    });
  }

  // --- ফর্ম সাবমিট ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageEl.textContent = '';
    messageEl.className = 'form-message';

    const formData = new FormData(form);
    const unit = formData.get('unit');

    if (unit === 'strip' && !formData.get('piecesPerStrip')) {
      messageEl.textContent = '✗ স্ট্রিপ বাছাই করলে "১ স্ট্রিপে কয়টা পিস" দিতে হবে';
      messageEl.classList.add('error');
      return;
    }
    if (unit === 'box' && (!formData.get('piecesPerStrip') || !formData.get('stripsPerBox'))) {
      messageEl.textContent = '✗ বক্স বাছাই করলে স্ট্রিপ ও পিস দুইটাই দিতে হবে';
      messageEl.classList.add('error');
      return;
    }

    const payload = {
      brandName: formData.get('brandName'),
      genericName: formData.get('genericName'),
      quantity: formData.get('quantity'),
      unit,
      piecesPerStrip: formData.get('piecesPerStrip') || 1,
      stripsPerBox: formData.get('stripsPerBox') || 1,
      batchNo: formData.get('batchNo'),
      expiryDate: formData.get('expiryDate'),
      unitPrice: formData.get('unitPrice'),
      lowStockThreshold: formData.get('lowStockThreshold'),
    };

    try {
      if (isEdit) {
        await updateMedicineInStock(editRecord.id, payload);
        messageEl.textContent = '✓ মেডিসিন আপডেট হয়েছে';
      } else {
        await addMedicineToStock(payload);
        messageEl.textContent = '✓ মেডিসিন স্টকে যোগ হয়েছে';
        form.reset();
        updateConversionFieldsVisibility();
      }
      messageEl.classList.add('success');

      if (onSuccess) onSuccess({ cancelled: false });
    } catch (err) {
      messageEl.textContent = '✗ ' + err.message;
      messageEl.classList.add('error');
    }
  });
}
