import jsPDF from 'jspdf';

export interface ReceiptPdfData {
  receiptNumber: string;
  date: string;
  receivedFrom: string;
  sendBy: string;
  amount: string | number;
  amountInWords: string;
  reason: string;
  receivedBySignature?: string;
}

const COLORS = {
  white: [255, 255, 255] as [number, number, number],
  gray50: [249, 250, 251] as [number, number, number],
  gray100: [243, 244, 246] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray600: [75, 85, 99] as [number, number, number],
  gray700: [55, 65, 81] as [number, number, number],
  gray900: [17, 24, 39] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
};

function formatAmount(amount: string | number): string {
  const value = parseFloat(String(amount));
  if (Number.isNaN(value)) return 'AED 0.00';
  return `AED ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: string): string {
  if (!date) return '---';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB');
}

function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || '', maxWidth) as string[];
}

function drawDivider(doc: jsPDF, x: number, y: number, width: number, thickness = 0.2) {
  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(thickness);
  doc.line(x, y, x + width, y);
}

function drawFieldBlock(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  valueFontSize = 11
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray700);
  doc.text(label, x, y);

  doc.setFont('helvetica', valueFontSize >= 12 ? 'bold' : 'normal');
  doc.setFontSize(valueFontSize);
  doc.setTextColor(...COLORS.gray900);

  const lines = splitLines(doc, value || '', width);
  doc.text(lines, x, y + 6);

  const blockHeight = Math.max(12, lines.length * 5 + 4);
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.4);
  doc.line(x, y + blockHeight, x + width, y + blockHeight);

  return blockHeight + 10;
}

function renderReceiptPage(doc: jsPDF, data: ReceiptPdfData, isCopy: boolean) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const headerHeight = 20;
  const infoBarHeight = 12;
  const infoBarBottom = headerHeight + infoBarHeight;

  if (isCopy) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(72);
    doc.setTextColor(240, 240, 240);
    doc.text('COPY', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
  }

  doc.setFillColor(...COLORS.gray900);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.white);
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', margin, 9);

  const receiptLabel = 'RECEIPT';
  const cashLabel = 'CASH PAYMENT';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const receiptWidth = doc.getTextWidth(receiptLabel);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const cashWidth = doc.getTextWidth(cashLabel);
  const labelGap = 4;
  const labelsStartX = pageWidth - margin - receiptWidth - labelGap - cashWidth;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(receiptLabel, labelsStartX, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(cashLabel, labelsStartX + receiptWidth + labelGap, 10);

  doc.setFillColor(...COLORS.gray100);
  doc.rect(0, headerHeight, pageWidth, infoBarHeight, 'F');
  doc.setDrawColor(...COLORS.gray900);
  doc.setLineWidth(0.5);
  doc.line(0, infoBarBottom, pageWidth, infoBarBottom);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray900);
  doc.text(`Receipt No: ${data.receiptNumber || '---'}`, margin, infoBarBottom - 5);
  doc.text(`Date: ${formatDate(data.date)}`, pageWidth - margin, infoBarBottom - 5, { align: 'right' });

  let y = infoBarBottom + 10;

  y += drawFieldBlock(doc, 'Received From:', data.receivedFrom, margin, y, contentWidth, 12);
  drawDivider(doc, margin, y - 4, contentWidth);
  y += drawFieldBlock(doc, 'Send By:', data.sendBy, margin, y, contentWidth, 12);
  drawDivider(doc, margin, y - 4, contentWidth);

  const amountBoxHeight = 34;
  doc.setFillColor(...COLORS.gray50);
  doc.setDrawColor(...COLORS.gray900);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, amountBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray700);
  doc.text('Amount:', margin + 4, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.gray900);
  doc.text(formatAmount(data.amount), margin + 4, y + 18);

  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(0.2);
  doc.line(margin + 4, y + 22, margin + contentWidth - 4, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray700);
  doc.text('Amount in Words:', margin + 4, y + 28);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray900);
  const words = splitLines(doc, data.amountInWords || '', contentWidth - 40);
  doc.text(words, margin + 34, y + 28);

  y += amountBoxHeight + 6;
  y += drawFieldBlock(doc, 'Payment For:', data.reason, margin, y, contentWidth, 10);

  y += 4;
  const signatureTop = Math.max(y, pageHeight - 72);
  const columnWidth = (contentWidth - 8) / 2;

  if (!isCopy) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray600);
    doc.text("Payer's Signature", margin + columnWidth / 2, signatureTop, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.gray900);
    const payerLines = splitLines(doc, data.receivedFrom || '', columnWidth - 6);
    doc.text(payerLines, margin + columnWidth / 2, signatureTop + 8, { align: 'center' });
  }

  const receivedX = margin + columnWidth + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray600);
  doc.text('Received By', receivedX + columnWidth / 2, signatureTop, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.gray900);
  doc.text('Mohamed Sabry', receivedX + columnWidth / 2, signatureTop + 8, { align: 'center' });

  if (data.receivedBySignature?.startsWith('data:image')) {
    try {
      const format = data.receivedBySignature.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(data.receivedBySignature, format, receivedX + columnWidth / 2 - 18, signatureTop + 12, 36, 14);
    } catch {
      // ignore invalid signature image
    }
  }

  if (isCopy) {
    doc.setDrawColor(...COLORS.gray200);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray500);
    doc.text('True Copy of Original', pageWidth / 2, pageHeight - 12, { align: 'center' });
  }
}

export async function generateReceiptPdf(options: {
  data: ReceiptPdfData;
  filename: string;
}): Promise<void> {
  const { data, filename } = options;
  const doc = new jsPDF('p', 'mm', 'a4');

  doc.setProperties({
    title: filename,
  });

  renderReceiptPage(doc, data, false);
  doc.addPage();
  renderReceiptPage(doc, data, true);

  doc.save(`${filename}.pdf`);
}
