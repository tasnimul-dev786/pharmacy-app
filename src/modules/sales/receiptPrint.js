import { getShopInfo } from '../settings/settingsRepo.js';

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildReceiptHtml(sale, invoiceNumber, shop) {
  return `
    <div style="font-family:'Noto Sans Bengali', Arial, sans-serif;font-size:11px;width:100%;">
      <div style="text-align:center;font-weight:bold;font-size:14px;">${shop.shopName || 'Pharmacy'}</div>
      ${shop.address ? `<div style="text-align:center;">${shop.address}</div>` : ''}
      ${shop.phone ? `<div style="text-align:center;">ফোন: ${shop.phone}</div>` : ''}
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div>Invoice: ${invoiceNumber}</div>
      <div>${formatDateTime(sale.date)}</div>
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      ${sale.items
        .map(
          (i) => `
        <div style="display:flex;justify-content:space-between;">
          <span>${i.brandName} x${i.saleQty ?? i.qty} ${i.saleUnit === 'strip' ? 'স্ট্রিপ' : 'পিস'}</span>
          <span>${i.subtotal.toFixed(2)}</span>
        </div>`
        )
        .join('')}
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      ${sale.discountAmount > 0 ? `
      <div style="display:flex;justify-content:space-between;">
        <span>সাবটোটাল</span><span>৳${sale.subtotal.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span>ছাড়${sale.discountType === 'percent' ? ` (${sale.discountValue}%)` : ''}</span><span>-৳${sale.discountAmount.toFixed(2)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;">
        <span>মোট</span><span>৳${sale.total.toFixed(2)}</span>
      </div>
      <div style="text-align:center;margin-top:10px;">ধন্যবাদ</div>
    </div>
  `;
}

/**
 * ৫৮mm/৮০mm থার্মাল প্রিন্টারের জন্য রিসিট প্রিন্ট করে (browser print dialog দিয়ে)।
 * প্রিন্ট ডায়ালগে পেপার সাইজ ৫৮mm বা ৮০mm বেছে নিতে হবে (প্রিন্টার সেটিংসে)।
 */
export async function printReceipt(sale, invoiceNumber) {
  const shop = await getShopInfo();

  let area = document.getElementById('print-receipt-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'print-receipt-area';
    document.body.appendChild(area);
  }
  area.innerHTML = buildReceiptHtml(sale, invoiceNumber, shop);

  window.print();
}
