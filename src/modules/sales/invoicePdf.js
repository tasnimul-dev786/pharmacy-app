import { jsPDF } from 'jspdf';
import { getShopInfo } from '../settings/settingsRepo.js';

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildInvoiceHtml(sale, invoiceNumber, shop) {
  return `
    <div style="width:190mm;font-family:'Noto Sans Bengali', Arial, sans-serif;font-size:12px;color:#000;padding:8mm;box-sizing:border-box;">
      <div style="text-align:center;font-size:18px;font-weight:bold;">${shop.shopName || ''}</div>
      ${shop.address ? `<div style="text-align:center;">${shop.address}</div>` : ''}
      ${shop.phone ? `<div style="text-align:center;">ফোন: ${shop.phone}</div>` : ''}
      <hr style="margin:8px 0;border:none;border-top:1px solid #000;" />
      <div style="display:flex;justify-content:space-between;margin:8px 0;">
        <span>Invoice: ${invoiceNumber}</span>
        <span>Date: ${formatDateTime(sale.date)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="border-bottom:1px solid #000;text-align:left;">
            <th style="padding:4px 0;">Item</th>
            <th style="padding:4px 0;text-align:right;">Qty</th>
            <th style="padding:4px 0;text-align:right;">Price</th>
            <th style="padding:4px 0;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${sale.items
            .map(
              (i) => `<tr>
              <td style="padding:4px 0;">${i.brandName}</td>
              <td style="padding:4px 0;text-align:right;">${i.qty}</td>
              <td style="padding:4px 0;text-align:right;">${i.unitPrice.toFixed(2)}</td>
              <td style="padding:4px 0;text-align:right;">${i.subtotal.toFixed(2)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <hr style="margin:8px 0;border:none;border-top:1px solid #000;" />
      <div style="text-align:right;font-weight:bold;font-size:14px;">Total: ${sale.total.toFixed(2)}</div>
      <div style="text-align:center;margin-top:24px;">ধন্যবাদ</div>
    </div>
  `;
}

/**
 * একটা sale রেকর্ড ও invoiceNumber নিয়ে A4 সাইজ PDF ইনভয়েস বানায় ও ডাউনলোড করে।
 * html2canvas দিয়ে রেন্ডার করা হয় (jsPDF এর সরাসরি টেক্সট রেন্ডারিং বাংলা সাপোর্ট করে না)।
 */
export async function downloadInvoicePDF(sale, invoiceNumber) {
  const shop = await getShopInfo();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.innerHTML = buildInvoiceHtml(sale, invoiceNumber, shop);
  document.body.appendChild(container);

  await new Promise((resolve, reject) => {
    doc.html(container, {
      x: 10,
      y: 10,
      width: 190,
      windowWidth: 720,
      callback: (doc) => {
        try {
          doc.save(`${invoiceNumber}.pdf`);
        } finally {
          document.body.removeChild(container);
          resolve();
        }
      },
    }).catch(reject);
  });
}
