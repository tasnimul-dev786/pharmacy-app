import { jsPDF } from 'jspdf';
import { getShopInfo } from '../settings/settingsRepo.js';
import { NotoSansBengaliBase64 } from '../../assets/fonts/NotoSansBengali-base64.js';

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function registerBengaliFont(doc) {
  doc.addFileToVFS('NotoSansBengali.ttf', NotoSansBengaliBase64);
  doc.addFont('NotoSansBengali.ttf', 'NotoSansBengali', 'normal');
  doc.setFont('NotoSansBengali');
}

/**
 * একটা sale রেকর্ড ও invoiceNumber নিয়ে A4 সাইজ PDF ইনভয়েস বানায় ও ডাউনলোড করে।
 * বাংলা টেক্সট সঠিকভাবে দেখানোর জন্য Noto Sans Bengali ফন্ট সরাসরি PDF-এ এমবেড করা হয়
 * (html2canvas এর বদলে — সেটা কিছু ব্রাউজারে ফাঁকা PDF দিচ্ছিল)।
 */
export async function downloadInvoicePDF(sale, invoiceNumber) {
  const shop = await getShopInfo();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  registerBengaliFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(16);
  doc.text(shop.shopName || 'Pharmacy', pageWidth / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(10);
  if (shop.address) {
    doc.text(shop.address, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }
  if (shop.phone) {
    doc.text(`Phone: ${shop.phone}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  y += 3;
  doc.setLineWidth(0.3);
  doc.line(15, y, pageWidth - 15, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`Invoice: ${invoiceNumber}`, 15, y);
  doc.text(`Date: ${formatDateTime(sale.date)}`, pageWidth - 15, y, { align: 'right' });
  y += 10;

  doc.setFontSize(10);
  doc.text('Item', 15, y);
  doc.text('Qty', 110, y, { align: 'right' });
  doc.text('Price', 145, y, { align: 'right' });
  doc.text('Subtotal', pageWidth - 15, y, { align: 'right' });
  y += 3;
  doc.line(15, y, pageWidth - 15, y);
  y += 6;

  sale.items.forEach((item) => {
    doc.text(item.brandName, 15, y);
    const unitLabel = item.saleUnit === 'strip' ? 'strip' : 'pc';
    doc.text(`${item.saleQty ?? item.qty} ${unitLabel}`, 110, y, { align: 'right' });
    doc.text(item.unitPrice.toFixed(2), 145, y, { align: 'right' });
    doc.text(item.subtotal.toFixed(2), pageWidth - 15, y, { align: 'right' });
    y += 6;
    if (y > 270) {
      doc.addPage();
      registerBengaliFont(doc);
      y = 20;
    }
  });

  y += 4;
  doc.line(15, y, pageWidth - 15, y);
  y += 8;

  if (sale.discountAmount > 0) {
    doc.setFontSize(10);
    doc.text(`Subtotal: ${sale.subtotal.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });
    y += 6;
    const discLabel = sale.discountType === 'percent' ? `Discount (${sale.discountValue}%)` : 'Discount';
    doc.text(`${discLabel}: -${sale.discountAmount.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });
    y += 8;
  }
  doc.setFontSize(12);
  doc.text(`Total: ${sale.total.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });

  y += 15;
  doc.setFontSize(9);
  doc.text('Thank you', pageWidth / 2, y, { align: 'center' });

  doc.save(`${invoiceNumber}.pdf`);
}
