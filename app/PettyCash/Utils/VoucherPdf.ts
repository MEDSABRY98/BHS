import jsPDF from 'jspdf';
import { addArabicFont } from '@/app/Components/Pdf/shared';

export interface VoucherPdfData {
  voucherNumber: string;
  date: string;
  amount: string | number;
  source: string;
  description: string;
}

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const COLORS = {
  white: [255, 255, 255] as [number, number, number],
  gray50: [249, 250, 251] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray400: [156, 163, 175] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray700: [55, 65, 81] as [number, number, number],
  gray900: [17, 24, 39] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
};

function hasArabic(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

function formatAmount(amount: string | number): string {
  const value = parseFloat(String(amount));
  if (Number.isNaN(value)) return '0.00';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date: string): string {
  if (!date) return '---';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB');
}

function setLabelFont(doc: jsPDF, size = 8) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
}

function setContentFont(doc: jsPDF, size = 12) {
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(size);
}

function splitContentLines(doc: jsPDF, text: string, maxWidth: number, fontSize = 12): string[] {
  setContentFont(doc, fontSize);
  return doc.splitTextToSize(text || '', maxWidth) as string[];
}

function drawDescriptionBlock(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number
): number {
  const description = text || '---';
  const fontSize = 12;
  const lineHeight = 6;
  const startY = y + 6;
  const isRtl = hasArabic(description);

  setContentFont(doc, fontSize);
  doc.setTextColor(...COLORS.gray900);

  if (isRtl) {
    doc.text(description, x + width, startY, {
      align: 'right',
      maxWidth: width,
    });
    const lines = splitContentLines(doc, description, width, fontSize);
    return Math.max(12, lines.length * lineHeight + 2);
  }

  const lines = splitContentLines(doc, description, width, fontSize);
  doc.text(lines, x, startY);
  return Math.max(12, lines.length * lineHeight + 2);
}

function formatDisplayText(text: string, uppercase = false): string {
  const value = text || '---';
  if (uppercase && !hasArabic(value)) {
    return value.toUpperCase();
  }
  return value;
}

function drawLabeledLine(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  valueColor: [number, number, number] = COLORS.gray900,
  valueFontSize = 12,
  uppercaseValue = false,
  useContentFont = false
): number {
  setLabelFont(doc, 8);
  doc.setTextColor(...COLORS.gray500);
  doc.text(label.toUpperCase(), x, y);

  if (useContentFont) {
    setContentFont(doc, valueFontSize);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valueFontSize);
  }
  doc.setTextColor(...valueColor);
  doc.text(formatDisplayText(value, uppercaseValue), x, y + 6);

  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(0.2);
  doc.line(x, y + 9, x + width, y + 9);

  return 16;
}

function drawReceiverSignature(doc: jsPDF, data: VoucherPdfData, y: number, contentWidth: number, margin: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const signatureWidth = contentWidth * 0.55;
  const signatureX = margin + (contentWidth - signatureWidth) / 2;
  const signatureY = Math.max(y + 4, pageHeight - 68);

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.line(signatureX, signatureY, signatureX + signatureWidth, signatureY);

  setLabelFont(doc, 8);
  doc.setTextColor(...COLORS.gray500);
  doc.text("RECEIVER'S SIGNATURE", signatureX + signatureWidth / 2, signatureY + 6, { align: 'center' });

  setContentFont(doc, 10);
  doc.setTextColor(...COLORS.gray900);
  doc.text(formatDisplayText(data.source || '---'), signatureX + signatureWidth / 2, signatureY + 18, {
    align: 'center',
  });
}

function renderVoucherPage(doc: jsPDF, data: VoucherPdfData, isCopy: boolean) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const amountText = formatAmount(data.amount);

  if (isCopy) {
    setLabelFont(doc, 72);
    doc.setTextColor(240, 240, 240);
    doc.text('COPY', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
  }

  const headerHeight = 28;
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  let y = 10;

  setLabelFont(doc, 14);
  doc.setTextColor(...COLORS.white);
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.setFontSize(12);
  doc.text('PAYMENT VOUCHER', pageWidth / 2, y, { align: 'center' });

  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(0.4);
  doc.line(margin, headerHeight - 3, pageWidth - margin, headerHeight - 3);

  y = headerHeight + 10;

  const leftWidth = contentWidth * 0.58;
  const rightWidth = contentWidth * 0.38;
  const rightX = margin + leftWidth + contentWidth * 0.04;

  y += drawLabeledLine(doc, 'Voucher No:', data.voucherNumber || '---', margin, y, leftWidth, COLORS.red, 13);
  y += drawLabeledLine(doc, 'Date:', formatDate(data.date), margin, y, leftWidth);
  y += drawLabeledLine(doc, 'Amount:', `${amountText} AED`, margin, y, leftWidth, COLORS.gray900, 12);

  const boxTop = y - 44;
  const boxHeight = 44;
  doc.setFillColor(...COLORS.gray50);
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightX, boxTop, rightWidth, boxHeight, 2, 2, 'FD');

  setLabelFont(doc, 8);
  doc.setTextColor(...COLORS.gray500);
  doc.text('TOTAL AMOUNT', rightX + rightWidth / 2, boxTop + 10, { align: 'center' });

  setLabelFont(doc, 18);
  doc.setTextColor(...COLORS.gray900);
  doc.text(amountText, rightX + rightWidth / 2, boxTop + 24, { align: 'center' });

  doc.setFontSize(10);
  doc.text('AED', rightX + rightWidth / 2, boxTop + 34, { align: 'center' });

  y += 8;
  y += drawLabeledLine(
    doc,
    'Paid to:',
    data.source || '---',
    margin,
    y,
    contentWidth,
    COLORS.gray900,
    14,
    true,
    true
  );

  setLabelFont(doc, 8);
  doc.setTextColor(...COLORS.gray400);
  doc.text('DESCRIPTION:', margin, y);

  const descriptionHeight = drawDescriptionBlock(doc, data.description || '', margin, y, contentWidth);
  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 6 + descriptionHeight, margin + contentWidth, y + 6 + descriptionHeight);

  y += descriptionHeight + 10;

  if (!isCopy) {
    drawReceiverSignature(doc, data, y, contentWidth, margin);
  }

  if (isCopy) {
    doc.setDrawColor(...COLORS.gray200);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
    setLabelFont(doc, 8);
    doc.setTextColor(...COLORS.gray500);
    doc.text('True Copy of Original', pageWidth / 2, pageHeight - 12, { align: 'center' });
  }
}

export async function generateVoucherPdf(options: {
  data: VoucherPdfData;
  filename: string;
}): Promise<void> {
  const { data, filename } = options;
  const doc = new jsPDF('p', 'mm', 'a4');

  await addArabicFont(doc);

  doc.setProperties({
    title: filename,
  });

  renderVoucherPage(doc, data, false);
  doc.addPage();
  renderVoucherPage(doc, data, true);

  doc.save(`${filename}.pdf`);
}
