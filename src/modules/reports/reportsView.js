import Chart from 'chart.js/auto';
import { getSalesInRange, getMonthlySales, getTopSellingMedicines } from './reportsRepo.js';

let dailyChartInstance = null;
let monthlyChartInstance = null;

function toInputValue(d) {
  return d.toISOString().slice(0, 10);
}

function toDDMMYYYY(dateInputValue) {
  if (!dateInputValue) return '';
  const [y, m, d] = dateInputValue.split('-');
  return `${d}/${m}/${y}`;
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

  container.innerHTML = `
    <h2>রিপোর্ট</h2>

    <div class="preset-btns">
      <button class="btn-secondary preset-btn" data-preset="today">আজ</button>
      <button class="btn-secondary preset-btn active" data-preset="week">এই সপ্তাহ</button>
      <button class="btn-secondary preset-btn" data-preset="month">এই মাস</button>
      <button class="btn-secondary preset-btn" data-preset="lastMonth">গত মাস</button>
      <button class="btn-secondary preset-btn" data-preset="custom">কাস্টম তারিখ</button>
    </div>

    <div id="custom-range-fields" class="hidden" style="display:flex;gap:0.6rem;align-items:end;flex-wrap:wrap;max-width:480px;margin-top:0.8rem">
      <div class="form-field">
        <label for="from-date">থেকে</label>
        <input type="date" id="from-date" value="${defaultRange.from}" />
        <span id="from-date-display" class="s-generic"></span>
      </div>
      <div class="form-field">
        <label for="to-date">পর্যন্ত</label>
        <input type="date" id="to-date" value="${defaultRange.to}" />
        <span id="to-date-display" class="s-generic"></span>
      </div>
      <button id="apply-range-btn" class="btn-primary">দেখাও</button>
    </div>

    <div id="range-summary" class="report-summary"></div>

    <canvas id="daily-chart" height="200"></canvas>

    <h3 style="margin-top:2rem">কোন ওষুধ সবচেয়ে বেশি বিক্রি হয়েছে</h3>
    <div id="top-selling-container"></div>

    <h3 style="margin-top:2rem">গত ৬ মাসের বিক্রির ধারা</h3>
    <canvas id="monthly-chart" height="180"></canvas>
  `;

  const fromInput = container.querySelector('#from-date');
  const toInput = container.querySelector('#to-date');
  const fromDisplay = container.querySelector('#from-date-display');
  const toDisplay = container.querySelector('#to-date-display');
  const customFields = container.querySelector('#custom-range-fields');
  const summaryEl = container.querySelector('#range-summary');
  const dailyCanvas = container.querySelector('#daily-chart');
  const monthlyCanvas = container.querySelector('#monthly-chart');
  const topSellingEl = container.querySelector('#top-selling-container');

  function updateDateDisplays() {
    fromDisplay.textContent = toDDMMYYYY(fromInput.value);
    toDisplay.textContent = toDDMMYYYY(toInput.value);
  }
  fromInput.addEventListener('change', updateDateDisplays);
  toInput.addEventListener('change', updateDateDisplays);
  updateDateDisplays();

  async function refreshRange(from, to) {
    const { labels, values, total, billCount } = await getSalesInRange(from, to);

    const fromLabel = toDDMMYYYY(from);
    const toLabel = toDDMMYYYY(to);
    summaryEl.innerHTML = `
      <div class="report-summary-line">${fromLabel} থেকে ${toLabel} পর্যন্ত</div>
      <div class="report-summary-big">৳${total.toFixed(2)}</div>
      <div class="report-summary-line">মোট ${billCount} টা বিল</div>
    `;

    if (dailyChartInstance) dailyChartInstance.destroy();
    dailyChartInstance = new Chart(dailyCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'সেলস (৳)', data: values, backgroundColor: '#1a7f4e' }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });

    const topSelling = await getTopSellingMedicines(10, from, to);
    renderTopSellingTable(topSellingEl, topSelling);
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
      fromInput.value = from;
      toInput.value = to;
      updateDateDisplays();
      await refreshRange(from, to);
    });
  });

  container.querySelector('#apply-range-btn').addEventListener('click', () => {
    if (fromInput.value && toInput.value && fromInput.value <= toInput.value) {
      refreshRange(fromInput.value, toInput.value);
    }
  });

  await refreshRange(defaultRange.from, defaultRange.to);

  const monthly = await getMonthlySales(6);
  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(monthlyCanvas, {
    type: 'bar',
    data: {
      labels: monthly.labels,
      datasets: [{ label: 'সেলস (৳)', data: monthly.values, backgroundColor: '#7fb99a' }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}
