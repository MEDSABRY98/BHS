import jsPDF from 'jspdf';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { bhs_supabas } from '@/lib/supabase';

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

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

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

function hasArabic(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

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

function setLabelFont(doc: jsPDF, size = 8, style: 'normal' | 'bold' | 'italic' = 'bold') {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
}

function setContentFont(doc: jsPDF, size = 12) {
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(size);
}

function splitLatinLines(doc: jsPDF, text: string, maxWidth: number, fontSize: number, style: 'normal' | 'bold' | 'italic' = 'normal'): string[] {
  doc.setFont('helvetica', style);
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(text || '', maxWidth) as string[];
}

function splitContentLines(doc: jsPDF, text: string, maxWidth: number, fontSize = 12): string[] {
  setContentFont(doc, fontSize);
  return doc.splitTextToSize(text || '', maxWidth) as string[];
}

function measureTextBlockHeight(lineCount: number, lineHeight = 5): number {
  return Math.max(12, lineCount * lineHeight + 4);
}

function drawDivider(doc: jsPDF, x: number, y: number, width: number, thickness = 0.2) {
  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(thickness);
  doc.line(x, y, x + width, y);
}

function drawTextBlock(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  rtl = false
): number {
  const content = text || '---';
  const lineHeight = rtl ? 6 : 5;
  const isRtl = rtl && hasArabic(content);

  if (isRtl) {
    setContentFont(doc, fontSize);
    doc.text(content, x + width, y, { align: 'right', maxWidth: width });
    const lines = splitContentLines(doc, content, width, fontSize);
    return measureTextBlockHeight(lines.length, lineHeight);
  }

  if (hasArabic(content)) {
    setContentFont(doc, fontSize);
    const lines = splitContentLines(doc, content, width, fontSize);
    doc.text(lines, x, y);
    return measureTextBlockHeight(lines.length, lineHeight);
  }

  const lines = splitLatinLines(doc, content, width, fontSize);
  doc.text(lines, x, y);
  return measureTextBlockHeight(lines.length, lineHeight);
}

function drawFieldBlock(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  valueFontSize = 11,
  rtl = false
): number {
  setLabelFont(doc, 9, 'bold');
  doc.setTextColor(...COLORS.gray700);
  doc.text(label, x, y);

  doc.setTextColor(...COLORS.gray900);
  const blockHeight = drawTextBlock(doc, value, x, y + 6, width, valueFontSize, rtl);

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.4);
  doc.line(x, y + blockHeight, x + width, y + blockHeight);

  return blockHeight + 10;
}

function renderReceiptPage(doc: jsPDF, data: ReceiptPdfData) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const headerHeight = 20;
  const infoBarHeight = 12;
  const infoBarBottom = headerHeight + infoBarHeight;

  doc.setFillColor(...COLORS.gray900);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  setLabelFont(doc, 11, 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', margin, 9);

  const receiptLabel = 'RECEIPT';
  const cashLabel = 'CASH PAYMENT';
  setLabelFont(doc, 18, 'bold');
  const receiptWidth = doc.getTextWidth(receiptLabel);
  setLabelFont(doc, 8, 'normal');
  const cashWidth = doc.getTextWidth(cashLabel);
  const labelGap = 4;
  const labelsStartX = pageWidth - margin - receiptWidth - labelGap - cashWidth;

  setLabelFont(doc, 18, 'bold');
  doc.text(receiptLabel, labelsStartX, 10);
  setLabelFont(doc, 8, 'normal');
  doc.text(cashLabel, labelsStartX + receiptWidth + labelGap, 10);

  doc.setFillColor(...COLORS.gray100);
  doc.rect(0, headerHeight, pageWidth, infoBarHeight, 'F');
  doc.setDrawColor(...COLORS.gray900);
  doc.setLineWidth(0.5);
  doc.line(0, infoBarBottom, pageWidth, infoBarBottom);

  setLabelFont(doc, 9, 'bold');
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

  setLabelFont(doc, 9, 'bold');
  doc.setTextColor(...COLORS.gray700);
  doc.text('Amount:', margin + 4, y + 8);

  setLabelFont(doc, 16, 'bold');
  doc.setTextColor(...COLORS.gray900);
  doc.text(formatAmount(data.amount), margin + 4, y + 18);

  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(0.2);
  doc.line(margin + 4, y + 22, margin + contentWidth - 4, y + 22);

  setLabelFont(doc, 8, 'bold');
  doc.setTextColor(...COLORS.gray700);
  doc.text('Amount in Words:', margin + 4, y + 28);

  doc.setTextColor(...COLORS.gray900);
  const wordsWidth = contentWidth - 40;
  const wordsX = margin + 34;
  if (hasArabic(data.amountInWords || '')) {
    setContentFont(doc, 8);
    doc.text(data.amountInWords || '', wordsX + wordsWidth, y + 28, {
      align: 'right',
      maxWidth: wordsWidth,
    });
  } else {
    setLabelFont(doc, 8, 'italic');
    const words = splitLatinLines(doc, data.amountInWords || '', wordsWidth, 8, 'italic');
    doc.text(words, wordsX, y + 28);
  }

  y += amountBoxHeight + 6;
  y += drawFieldBlock(doc, 'Payment For:', data.reason, margin, y, contentWidth, 10, true);

  y += 4;
  const signatureTop = Math.max(y, pageHeight - 72);
  const signatureWidth = contentWidth * 0.55;
  const signatureX = margin + (contentWidth - signatureWidth) / 2;

  setLabelFont(doc, 8, 'bold');
  doc.setTextColor(...COLORS.gray600);
  doc.text('Received By', signatureX + signatureWidth / 2, signatureTop, { align: 'center' });

  setLabelFont(doc, 12, 'bold');
  doc.setTextColor(...COLORS.gray900);
  doc.text('Mohamed Sabry', signatureX + signatureWidth / 2, signatureTop + 8, { align: 'center' });

  if (data.receivedBySignature?.startsWith('data:image')) {
    try {
      const format = data.receivedBySignature.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(
        data.receivedBySignature,
        format,
        signatureX + signatureWidth / 2 - 18,
        signatureTop + 12,
        36,
        14,
      );
    } catch {
      // ignore invalid signature image
    }
  }
}

async function fetchReceiverSignature(): Promise<string> {
  try {
    const { data } = await bhs_supabas
      .from('bhs_USERS')
      .select('SIGNATURE')
      .eq('NAME', 'MED Sabry')
      .maybeSingle();

    return data?.SIGNATURE || '';
  } catch {
    return '';
  }
}

export async function generateReceiptPdf(options: {
  data: ReceiptPdfData;
  filename: string;
}): Promise<void> {
  const { data, filename } = options;
  const doc = new jsPDF('p', 'mm', 'a4');

  await addArabicFont(doc);

  const receivedBySignature = data.receivedBySignature || await fetchReceiverSignature();

  doc.setProperties({
    title: filename,
  });

  renderReceiptPage(doc, { ...data, receivedBySignature });

  doc.save(`${filename}.pdf`);
}
