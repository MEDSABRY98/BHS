export function generateInventoryScrapReportPDF(
  fromDate: string,
  toDate: string,
  items: any[],
  notes: string = '',
  reportNo: string
) {
  const formattedFromDate = fromDate
    ? new Date(fromDate).toLocaleDateString('en-GB')
    : '—';
  const formattedToDate = toDate
    ? new Date(toDate).toLocaleDateString('en-GB')
    : '—';

  const today = new Date();
  const fmt = (n: number) => String(n).padStart(2, '0');
  const reportDateStr = `${fmt(today.getDate())} / ${fmt(today.getMonth() + 1)} / ${today.getFullYear()}`;

  let totalQty = 0;
  const tableRowsHtml = items
    .map((item, idx) => {
      totalQty += Number(item.qty || 0);
      return `
        <tr>
          <td class="row-num">${idx + 1}</td>
          <td class="td-barcode">${item.barcode || '—'}</td>
          <td class="td-name">${item.name || 'Unknown Product'}</td>
          <td class="td-qty">${item.qty}</td>
          <td class="td-unit">${item.unit || 'PCS'}</td>
          <td class="td-reason">${item.reason}</td>
        </tr>
      `;
    })
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Inventory Scrap Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --gold: #B8922A;
      --gold-light: #D4A93A;
      --gold-pale: #F5EDD6;
      --black: #111111;
      --dark: #1E1E1E;
      --gray: #555555;
      --gray-light: #888888;
      --border: #C9A84C;
      --white: #FFFFFF;
      --bg: #FAFAFA;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg);
      font-family: 'Barlow', sans-serif;
      color: var(--black);
      min-height: 100vh;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 20px auto;
      background: var(--white);
      padding: 14mm 16mm 14mm 16mm;
      box-shadow: 0 4px 40px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      gap: 0;
      position: relative;
    }

    .top-rule {
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, var(--black) 0%, var(--gold) 50%, var(--black) 100%);
      margin-bottom: 4mm;
    }

    .header {
      text-align: center;
      margin-bottom: 2mm;
    }

    .company-name {
      font-family: 'Playfair Display', serif;
      font-size: 12pt;
      font-weight: 700;
      color: var(--black);
      letter-spacing: 0.05em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .company-address {
      font-size: 8pt;
      color: var(--gray);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-top: 3px;
      font-weight: 400;
    }

    .doc-badge {
      display: inline-block;
      background: transparent;
      color: #C0392B;
      font-family: 'Playfair Display', serif;
      font-size: 9pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      padding: 2px 16px;
      font-weight: 600;
      margin-top: 2mm;
      margin-bottom: 2mm;
    }

    .doc-meta-row {
      display: flex;
      justify-content: center;
      gap: 10mm;
      font-size: 8pt;
      color: var(--gray);
    }

    .doc-meta-row .meta-item {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .doc-meta-row .meta-item span {
      color: var(--black);
      font-weight: 600;
    }

    .divider {
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--gold), var(--gold), transparent);
      margin: 2mm 0;
    }

    .title-band {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 4mm 0 6mm;
    }

    .title-band::before,
    .title-band::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--gold);
      opacity: 0.5;
    }

    .title-band h1 {
      font-family: 'Playfair Display', serif;
      font-size: 14pt;
      font-weight: 600;
      color: var(--black);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .title-band h1 em {
      color: var(--gold);
      font-style: normal;
    }

    .info-row {
      display: flex;
      gap: 6mm;
      margin-bottom: 7mm;
    }

    .info-box {
      flex: 1;
      border: 1px solid #E0D0A0;
      padding: 5px 10px;
      background: var(--gold-pale);
      position: relative;
    }

    .info-box::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: var(--gold);
    }

    .info-box label {
      display: block;
      font-size: 6.5pt;
      color: var(--gray);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 2px;
      font-weight: 500;
    }

    .info-box .val {
      font-size: 9pt;
      font-weight: 600;
      color: var(--black);
      min-height: 14px;
    }

    .table-wrapper {
      margin-bottom: 7mm;
      flex: 1;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }

    thead tr {
      background: var(--black);
    }

    thead th {
      color: var(--gold-light);
      font-family: 'Barlow', sans-serif;
      font-weight: 600;
      font-size: 7.5pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 7px 8px;
      text-align: center;
      border: none;
    }

    thead th:first-child { padding-left: 10px; }
    thead th:last-child  { padding-right: 10px; }

    tbody tr {
      border-bottom: 1px solid #EEE5CC;
      transition: background 0.15s;
    }

    tbody tr:nth-child(even) { background: #FDFBF5; }
    tbody tr:nth-child(odd)  { background: var(--white); }

    tbody tr:hover { background: var(--gold-pale); }

    tbody td {
      padding: 7px 8px;
      color: var(--dark);
      font-weight: 400;
      vertical-align: middle;
      text-align: center;
    }

    tbody td:first-child { padding-left: 10px; }
    tbody td:last-child  { padding-right: 10px; }

    .td-barcode {
      font-family: 'Courier New', monospace;
      font-size: 8pt;
      font-weight: 600;
      color: var(--black);
      letter-spacing: 0.05em;
    }

    .td-name { font-weight: 500; text-align: center; }

    .td-qty {
      font-weight: 700;
      color: var(--black);
      text-align: center;
    }

    .td-unit {
      color: var(--gray);
      font-size: 8pt;
      text-align: center;
    }

    .td-reason { color: var(--gray); font-size: 8pt; text-align: center; }

    .row-num {
      color: var(--gray-light);
      font-size: 7.5pt;
      text-align: center;
      width: 22px;
    }

    tfoot tr {
      background: #F0E8D0;
      border-top: 2px solid var(--gold);
    }

    tfoot td {
      padding: 7px 8px;
      font-weight: 700;
      font-size: 8.5pt;
      color: var(--black);
    }

    .notes-section {
      margin-bottom: 8mm;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .section-label {
      font-size: 7pt;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #E0D0A0;
    }

    .notes-box {
      border: 1px solid #E0D0A0;
      min-height: 18mm;
      padding: 6px 10px;
      font-size: 8.5pt;
      color: var(--gray);
      background: #FDFCF8;
      white-space: pre-wrap;
    }

    .signature-section {
      margin-top: auto;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .sig-title {
      font-size: 7pt;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 5mm;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sig-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #E0D0A0;
    }

    .sig-row {
      display: flex;
      gap: 8mm;
    }

    .sig-block {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .sig-role {
      font-size: 7pt;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--gray);
      margin-bottom: 3px;
      font-weight: 500;
    }

    .sig-name-line {
      font-size: 8pt;
      font-weight: 600;
      color: var(--black);
      margin-bottom: 12mm;
      min-height: 12px;
    }

    .sig-line {
      width: 100%;
      border-bottom: 1px solid var(--black);
      margin-bottom: 4px;
    }

    .sig-date-label {
      font-size: 7pt;
      color: var(--gray-light);
      letter-spacing: 0.1em;
    }

    .sig-space {
      height: 22mm;
    }

    .bottom-rule {
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, var(--black) 0%, var(--gold) 50%, var(--black) 100%);
      margin-top: 8mm;
    }


    @media print {
      @page {
        size: A4 portrait;
        margin: 15mm 16mm 15mm 16mm;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { background: white; margin: 0; padding: 0; }
      .page {
        margin: 0;
        box-shadow: none;
        width: 100%;
        height: auto !important;
        min-height: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
      .no-print { display: none !important; }

    }

    .controls {
      width: 210mm;
      margin: 0 auto 10px;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .btn {
      font-family: 'Barlow', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 7px 18px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-print {
      background: var(--black);
      color: var(--gold-light);
    }

    .btn-print:hover { background: #333; }
  </style>
</head>
<body>

<div class="controls no-print">
  <button class="btn btn-print" onclick="window.print()" title="Print / Export PDF" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-size: 14pt; padding: 0;">🖨️</button>
</div>

<div class="page">
  <div class="top-rule"></div>

  <div class="header">
    <div class="company-name">Al Marai Al Arabia Trading — Sole Proprietorship L.L.C</div>
    <div class="doc-badge">Inventory Scrap Report</div>
    <div class="doc-meta-row">
      <div class="meta-item">Report No.: <span>${reportNo}</span></div>
      <div class="meta-item">Date: <span>${reportDateStr}</span></div>
      <div class="meta-item">Period: <span>${formattedFromDate} - ${formattedToDate}</span></div>
      <div class="meta-item">Department: <span>Warehouse</span></div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th style="width:22px; text-align:center">#</th>
          <th style="width:120px; text-align:center">Barcode</th>
          <th style="text-align:center">Product Name</th>
          <th style="width:55px; text-align:center">Qty</th>
          <th style="width:45px; text-align:center">Unit</th>
          <th style="width:100px; text-align:center">Reason</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right; padding-right:10px; letter-spacing:0.08em; font-size:8pt; color:var(--gray); font-weight:700;">Total</td>
          <td class="td-qty" style="text-align:center; font-weight:700;">${totalQty}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="notes-section">
    <div class="section-label">Remarks &amp; Notes</div>
    <div class="notes-box">
      ${notes || '&nbsp;'}
    </div>
  </div>

  <div class="signature-section">
    <div class="sig-title">Authorized Signatures</div>
    <div class="sig-row">
      <div class="sig-block">
        <div class="sig-role">Warehouse Manager</div>
        <div class="sig-name-line">&nbsp;</div>
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-date-label">Signature &amp; Date</div>
      </div>
      <div class="sig-block">
        <div class="sig-role">Finance &amp; Admin Manager</div>
        <div class="sig-name-line">&nbsp;</div>
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-date-label">Signature &amp; Date</div>
      </div>
    </div>
  </div>

  <div class="bottom-rule"></div>

</div>

</body>
</html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 5000);
    }, 500);
  }
}
