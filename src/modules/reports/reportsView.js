import { getSalesInRange, getPeriodComparison, getTopSellingMedicines } from './reportsRepo.js';
import { downloadReportPDF } from './reportPdf.js';
import { mountDatePicker } from './datePicker.js';

function toInputValue(d) {
  return d.toISOString().slice(0, 10);
}

function toDDMMYYYY(dateInputValue) {
  if (!dateInputValue) return '';
  const [y, m, d] = dateInputValue.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateReadable(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const monthNames = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'];
  return `${d.getDate()} ${monthNames[d.getMonth()]}`;
}

function renderTopSellingTable(el, items) {
  if (items.length === 0) {
    el.innerHTML = '<p class="empty-note">এই সময়ে কোনো সেল হয়নি।</p>';
    return;
  }
  el.innerHTML = `
    <table class="cart-table">
      <thead><tr><th>মেডিসিন</th><th>বিক্রি (পিস)</th><th>আয়</th></tr></thead>
      <tbody>
        ${items
          .map(
            (i) => `
          <tr>
            <td>${i.brandName}${i.genericName ? `<div class="s-generic">${i.genericName}</div>` : ''}</td>
            <td>${i.qty}</td>
            <td>৳${i.revenue.toFixed(2)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function getPresetRange(preset) {
  const today = new Date();
  let from, to;

  if (preset === 'today') {
    from = new Date(today);
    to = new Date(today);
  } else if (preset === 'week') {
    from = new Date(today);
    from.setDate(today.getDate() - 6);
    to = new Date(today);
  } else if (preset === 'month') {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = new Date(today);
  } else if (preset === 'lastMonth') {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    to = new Date(today.getFullYear(), today.getMonth(), 0);
  }
  return { from: toInputValue(from), to: toInputValue(to) };
}

export async function renderReportsView(container) {
  const defaultRange = getPresetRange('week');
  let currentRange = { ...defaultRange };
  let currentTopSelling = [];
  let currentStats = null;

  container.innerHTML = `
    <h2>রিপোর্ট</h2>

    <div class="preset-btns">
      <button class="btn-secondary preset-btn" data-preset="today">আজ</button>
      <button class="btn-secondary preset-btn active" data-preset="week">এই সপ্তাহ</button>
      <button class="btn-secondary preset-btn" data-preset="month">এই মাস</button>
      <button class="btn-secondary preset-btn" data-preset="lastMonth">গত মাস</button>
      <button class="btn-secondary preset-btn" data-preset="custom">কাস্টম তারিখ</button>
    </div>

    <div id="custom-range-fields" class="hidden" style="display:flex;gap:0.6rem;align-items:end;flex-wrap:wrap;max-width:520px;margin-top:0.8rem">
      <div class="form-field">
        <label>থেকে</label>
        <div id="from-date-picker"></div>
      </div>
      <div class="form-field">
        <label>পর্যন্ত</label>
        <div id="to-date-picker"></div>
      </div>
      <button id="apply-range-btn" class="btn-primary">দেখাও</button>
    </div>

    <div id="range-summary" class="report-summary"></div>
    <button id="download-report-pdf-btn" class="btn-secondary">📄 রিপোর্ট PDF ডাউনলোড</button>

    <h3 style="margin-top:1.5rem">কোন ওষুধ সবচেয়ে বেশি বিক্রি হয়েছে</h3>
    <div id="top-selling-container"></div>
  `;

  const customFields = container.querySelector('#custom-range-fields');
  const summaryEl = container.querySelector('#range-summary');
  const topSellingEl = container.querySelector('#top-selling-container');
  const downloadPdfBtn = container.querySelector('#download-report-pdf-btn');

  const fromPicker = mountDatePicker(container.querySelector('#from-date-picker'), defaultRange.from, () => {});
  const toPicker = mountDatePicker(container.querySelector('#to-date-picker'), defaultRange.to, () => {});

  async function refreshRange(from, to) {
    currentRange = { from, to };
    const { total, billCount, bestDay, numDays, totalProfit } = await getSalesInRange(from, to);
    const { prevTotal } = await getPeriodComparison(from, to);

    const fromLabel = toDDMMYYYY(from);
    const toLabel = toDDMMYYYY(to);
    const avgPerDay = numDays > 0 ? total / numDays : 0;

    let changePercent = null;
    if (prevTotal > 0) {
      changePercent = ((total - prevTotal) / prevTotal) * 100;
    }

    currentStats = { total, billCount, avgPerDay, bestDay, changePercent, fromLabel, toLabel, totalProfit };

    let comparisonHtml = '';
    if (changePercent !== null) {
      const up = changePercent >= 0;
      comparisonHtml = `<div class="report-summary-line ${up ? 'trend-up' : 'trend-down'}">
        আগের একই দৈর্ঘ্যের সময়ের তুলনায় ${up ? '▲' : '▼'} ${Math.abs(changePercent).toFixed(0)}%
      </div>`;
    }

    const bestDayHtml = bestDay
      ? `<div class="report-summary-line">সবচেয়ে বেশি বিক্রি: ${formatDateReadable(bestDay.date)} (৳${bestDay.amount.toFixed(2)})</div>`
      : '';

    summaryEl.innerHTML = `
      <div class="report-summary-line">${fromLabel} থেকে ${toLabel} পর্যন্ত</div>
      <div class="report-summary-big">৳${total.toFixed(2)}</div>
      <div class="report-summary-line">মোট ${billCount} টা বিল · গড়ে দৈনিক ৳${avgPerDay.toFixed(2)}</div>
      <div class="report-summary-line trend-up">মোট লাভ: ৳${totalProfit.toFixed(2)}</div>
      ${comparisonHtml}
      ${bestDayHtml}
    `;

    currentTopSelling = await getTopSellingMedicines(10, from, to);
    renderTopSellingTable(topSellingEl, currentTopSelling);
  }

  container.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      container.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.dataset.preset;
      if (preset === 'custom') {
        customFields.classList.remove('hidden');
        return;
      }
      customFields.classList.add('hidden');
      const { from, to } = getPresetRange(preset);
      fromPicker.setValue(from);
      toPicker.setValue(to);
      await refreshRange(from, to);
    });
  });

  container.querySelector('#apply-range-btn').addEventListener('click', () => {
    const from = fromPicker.getValue();
    const to = toPicker.getValue();
    if (from && to && from <= to) {
      refreshRange(from, to);
    } else {
      alert('"পর্যন্ত" তারিখ "থেকে" তারিখের আগে হতে পারবে না');
    }
  });

  downloadPdfBtn.addEventListener('click', () => {
    if (currentStats) {
      downloadReportPDF(currentStats, currentTopSelling);
    }
  });

  await refreshRange(defaultRange.from, defaultRange.to);
}
