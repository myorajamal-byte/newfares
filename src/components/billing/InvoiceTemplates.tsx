import { generateModernInvoiceHTML, ModernInvoiceData } from './ModernInvoiceTemplate';

export { generateModernInvoiceHTML };

// Modern print invoice generator used by ModernPrintInvoiceDialog
export interface ModernPrintInvoiceData {
  invoiceNumber: string;
  invoiceType: string;
  invoiceDate: string;
  customerName: string;
  items: Array<{
    size: string;
    quantity: number | string;
    faces: number | string;
    totalFaces: number | string;
    width?: number | string;
    height?: number | string;
    area?: number | string;
    pricePerMeter?: number | string;
    totalPrice?: number | string;
  }>;
  totalAmount: number;
  notes?: string;
  printerName?: string;
  hidePrices?: boolean;
}

export const generateModernPrintInvoiceHTML = (data: ModernPrintInvoiceData): string => {
  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const fileName = `فاتورة ${data.invoiceType}_${(data.customerName||'').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_')}`;
  const FIXED_ROWS = 10;
  const displayItems = [...(data.items || [])];
  while (displayItems.length < FIXED_ROWS) {
    displayItems.push({ size: '', quantity: '', faces: '', totalFaces: '', width: '', height: '', area: '', pricePerMeter: '', totalPrice: '' } as any);
  }

  const rowsHtml = displayItems.map(item => {
    if (data.hidePrices) {
      return `
      <tr>
        <td style="padding:8px">${item.size || ''}</td>
        <td style="padding:8px">${item.quantity ?? ''}</td>
        <td style="padding:8px">${item.faces ?? ''}</td>
        <td style="padding:8px">${item.totalFaces ?? ''}</td>
        <td style="padding:8px">${item.width ?? ''} × ${item.height ?? ''}</td>
        <td style="padding:8px">${Number(item.area || 0).toFixed(2)} م²</td>
      </tr>
    `;
    }
    return `
    <tr>
      <td style="padding:8px">${item.size || ''}</td>
      <td style="padding:8px">${item.quantity ?? ''}</td>
      <td style="padding:8px">${item.faces ?? ''}</td>
      <td style="padding:8px">${item.totalFaces ?? ''}</td>
      <td style="padding:8px">${item.width ?? ''} × ${item.height ?? ''}</td>
      <td style="padding:8px">${Number(item.area || 0).toFixed(2)} م²</td>
      <td style="padding:8px">${(Number(item.pricePerMeter || 0)).toLocaleString('ar-LY')}</td>
      <td style="padding:8px">${(Number(item.totalPrice || 0)).toLocaleString('ar-LY')} د.ل</td>
    </tr>
  `;
  }).join('');

  // Full header + footer to match the dialog preview
  const html = `<!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName}</title>
    <style>
      /* Fonts */
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');
      @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Bold.otf') format('opentype'); font-weight: 700; }
      @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Regular.otf') format('opentype'); font-weight: 400; }

      :root{
        --bg: #ffffff;
        --muted: #f8fafc;
        --primary: #0b5d7a;
        --primary-foreground: #ffffff;
        --border: #e6eef2;
        --card: #f1f8fb;
        --text: #111827;
      }

      html,body{height:100%;margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Manrope, 'Doran', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif}
      .container{max-width:1000px;margin:12px auto;padding:18px;background:var(--bg);border:1px solid var(--border);border-radius:10px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
      .logo img{max-width:200px;height:auto}
      .company{font-size:13px;color:#4b5563;text-align:left}
      .title{font-size:28px;color:var(--primary);font-weight:700;text-align:left}
      .customer-info{background:var(--muted);padding:12px;border-radius:6px;margin:12px 0;border-right:4px solid var(--primary)}

      table{width:100%;border-collapse:collapse;margin-top:12px;background:transparent}
      thead th{background:var(--primary);color:var(--primary-foreground);padding:10px 8px;text-align:center;font-weight:700}
      tbody td{border:1px solid var(--border);padding:10px;text-align:center;vertical-align:middle}
      tbody tr:nth-child(even){background:#fbfcfd}

      .num, .quantity{font-variant-numeric:tabular-nums;font-weight:600}
      .totals{margin-top:16px;display:flex;justify-content:flex-end}
      .totals .box{width:360px;padding:12px;background:var(--card);border-radius:6px}
      .notes{margin-top:12px;color:#374151}
      .footer{margin-top:28px;border-top:1px dashed var(--border);padding-top:12px;text-align:center;color:#6b7280;font-size:12px}

      /* responsive print tweaks */
      @media print{
        html,body{background:white}
        .container{margin:0;padding:8mm;border:none;border-radius:0}
        thead th{color:#fff}
        @page{size:A4;margin:10mm}
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="right" style="text-align:right">
          <div class="logo"><img src="/logofares.svg" alt="logo"/></div>
        </div>
        <div class="left" style="text-align:left">
          <div class="title">فاتورة ${data.invoiceType}</div>
          <div class="company">طرابلس – طريق المطار، حي الزهور<br/>هاتف: 0912612255</div>
        </div>
      </div>

      <div class="customer-info">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div><strong>العميل:</strong> ${data.customerName || ''}</div>
          <div style="direction:ltr">التاريخ: ${new Date(data.invoiceDate).toLocaleDateString('ar-LY')}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>المقاس</th>
            <th>عدد اللوحات</th>
            <th>أوجه/لوحة</th>
            <th>إجمالي الأوجه</th>
            <th>الأبعاد (م)</th>
            <th>المساحة/الوجه</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      ${data.hidePrices ? `
      <div class="totals">
        <div class="box">
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px">
            <div>إجمالي الأوجه:</div>
            <div style="direction:ltr">${Number(data.totalAmount || 0).toLocaleString('ar-LY')} وحدة</div>
          </div>
        </div>
      </div>
      ` : `
      <div class="totals">
        <div class="box">
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px">
            <div>المجموع الإجمالي:</div>
            <div style="direction:ltr">${data.totalAmount.toLocaleString('ar-LY')} د.ل</div>
          </div>
          <div style="margin-top:8px">المبلغ بالكلمات: ${data.totalAmount ? numberToArabicWords(Number(data.totalAmount)) : ''} ${data.totalAmount ? 'د.ل' : ''}</div>
        </div>
      </div>
      `}

      <div class="notes">${data.notes || ''}</div>

      <div class="footer">شكراً لتعاملكم معنا | Thank you for your business<br/>هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع</div>
    </div>
    <script>window.onload=function(){window.print();}</script>
  </body>
  </html>`;

  return html;
};

// Helper function to convert number to Arabic words (re-exported for convenience)
export const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر';
  
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? ' و' + ones[one] : '');
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return ones[hundred] + ' مائة' + (remainder > 0 ? ' و' + numberToArabicWords(remainder) : '');
  }
  if (num < 1000000) {
    const thousand = Math.floor(num / 1000);
    const remainder = num % 1000;
    return numberToArabicWords(thousand) + ' ألف' + (remainder > 0 ? ' و' + numberToArabicWords(remainder) : '');
  }
  
  return num.toString(); // Fallback for very large numbers
};

// Generate invoice with modern template
export const generateInvoiceHTML = (invoiceData: ModernInvoiceData): string => {
  return generateModernInvoiceHTML(invoiceData);
};
