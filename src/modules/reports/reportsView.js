import Chart from 'chart.js/auto';
import { getSalesInRange, getMonthlySales, getTopSellingMedicines } from './reportsRepo.js';

let dailyChartInstance = null;
let monthlyChartInstance = null;

function toDateInputValue(d) {
  return d.toISOString().slice(0, 10);
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

export async function renderReportsView(container) {
  const today = new Date();
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(today.getDate() - 13);

  container.innerHTML = `
    <h2>রিপোর্ট</h2>

    <div style="display:flex;gap:0.6rem;align-items:end;flex-wrap:wrap;max-width:480px">
      <div class="form-field">
        <label for="from-date">থেকে</label>
        <input type="date" id="from-date" value="${toDateInputValue(twoWeeksAgo)}" />
      </div>
      <div class="form-field">
        <label for="to-date">পর্যন্ত</label>
        <input type="date" id="to-date" value="${toDateInputValue(today)}" />
      </div>
      <button id="apply-range-btn" class="btn-secondary">দেখাও</button>
    </div>

    <div id="range-total" style="font-weight:600;margin:0.8rem 0;"></div>

    <h3>সেলস (নির্বাচিত রেঞ্জ)</h3>
    <canvas id="daily-chart" height="200"></canvas>

    <h3 style="margin-top:2rem">মাসিক সেলস (শেষ ৬ মাস)</h3>
    <canvas id="monthly-chart" height="200"></canvas>

    <h3 style="margin-top:2rem">টপ সেলিং মেডিসিন (নির্বাচিত রেঞ্জ)</h3>
    <div id="top-selling-container"></div>
  `;

  const fromInput = container.querySelector('#from-date');
  const toInput = container.querySelector('#to-date');
  const rangeTotalEl = container.querySelector('#range-total');
  const dailyCanvas = container.querySelector('#daily-chart');
  const monthlyCanvas = container.querySelector('#monthly-chart');
  const topSellingEl = container.querySelector('#top-selling-container');

  async function refreshRange() {
    const from = fromInput.value;
    const to = toInput.value;
    if (!from || !to || from > to) return;

    const { labels, values, total } = await getSalesInRange(from, to);
    rangeTotalEl.textContent = `এই রেঞ্জে মোট সেলস: ৳${total.toFixed(2)}`;

    if (dailyChartInstance) dailyChartInstance.destroy();
    dailyChartInstance = new Chart(dailyCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: 'সেলস (৳)', data: values, borderColor: '#1a7f4e', backgroundColor: 'rgba(26,127,78,0.1)', fill: true, tension: 0.2 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });

    const topSelling = await getTopSellingMedicines(10, from, to);
    renderTopSellingTable(topSellingEl, topSelling);
  }

  container.querySelector('#apply-range-btn').addEventListener('click', refreshRange);

  await refreshRange();

  const monthly = await getMonthlySales(6);
  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(monthlyCanvas, {
    type: 'bar',
    data: {
      labels: monthly.labels,
      datasets: [{ label: 'সেলস (৳)', data: monthly.values, backgroundColor: '#1a7f4e' }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}
