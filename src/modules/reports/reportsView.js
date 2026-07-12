import Chart from 'chart.js/auto';
import { getDailySales, getMonthlySales, getTopSellingMedicines } from './reportsRepo.js';

let dailyChartInstance = null;
let monthlyChartInstance = null;

function renderTopSellingTable(el, items) {
  if (items.length === 0) {
    el.innerHTML = '<p class="empty-note">এখনো কোনো সেল হয়নি।</p>';
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
  container.innerHTML = `
    <h2>রিপোর্ট</h2>
    <h3>দৈনিক সেলস (শেষ ১৪ দিন)</h3>
    <canvas id="daily-chart" height="200"></canvas>
    <h3 style="margin-top:2rem">মাসিক সেলস (শেষ ৬ মাস)</h3>
    <canvas id="monthly-chart" height="200"></canvas>
    <h3 style="margin-top:2rem">টপ সেলিং মেডিসিন</h3>
    <div id="top-selling-container"></div>
  `;

  const dailyCanvas = container.querySelector('#daily-chart');
  const monthlyCanvas = container.querySelector('#monthly-chart');
  const topSellingEl = container.querySelector('#top-selling-container');

  const daily = await getDailySales(14);
  const monthly = await getMonthlySales(6);
  const topSelling = await getTopSellingMedicines(10);

  if (dailyChartInstance) dailyChartInstance.destroy();
  dailyChartInstance = new Chart(dailyCanvas, {
    type: 'line',
    data: {
      labels: daily.labels,
      datasets: [{ label: 'সেলস (৳)', data: daily.values, borderColor: '#1a7f4e', backgroundColor: 'rgba(26,127,78,0.1)', fill: true, tension: 0.2 }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });

  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(monthlyCanvas, {
    type: 'bar',
    data: {
      labels: monthly.labels,
      datasets: [{ label: 'সেলস (৳)', data: monthly.values, backgroundColor: '#1a7f4e' }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });

  renderTopSellingTable(topSellingEl, topSelling);
}
