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
  rtl = false,
  style: 'normal' | 'bold' | 'italic' = 'bold'
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

  const lines = splitLatinLines(doc, content, width, fontSize, style);
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
  const headerHeight = 28;
  const infoBarHeight = 12;
  const infoBarBottom = headerHeight + infoBarHeight;

  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  let headerY = 10;

  setLabelFont(doc, 14, 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, headerY, { align: 'center' });

  headerY += 8;
  doc.setFontSize(12);
  doc.text('CASH RECEIPT', pageWidth / 2, headerY, { align: 'center' });

  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(0.4);
  doc.line(margin, headerHeight - 3, pageWidth - margin, headerHeight - 3);

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

  // ----- BOX 1: RECEIVED FROM & SENT BY -----
  const payerBoxY = y;
  
  const receivedFromStr = (data.receivedFrom || '').trim();
  const sentByStr = (data.sendBy || '').trim();
  const showSentBy = sentByStr !== '' && sentByStr.toLowerCase() !== receivedFromStr.toLowerCase();

  // Measure Received From
  doc.setTextColor(...COLORS.gray900);
  let rfHeight = 15;
  if (receivedFromStr) {
    if (hasArabic(receivedFromStr)) {
      setContentFont(doc, 14);
      rfHeight = measureTextBlockHeight(splitContentLines(doc, receivedFromStr, contentWidth - 16, 14).length, 7);
    } else {
      rfHeight = measureTextBlockHeight(splitLatinLines(doc, receivedFromStr, contentWidth - 16, 14, 'bold').length, 6);
    }
  }

  // Measure Sent By
  let sbHeight = 0;
  if (showSentBy) {
    if (hasArabic(sentByStr)) {
      setContentFont(doc, 12);
      sbHeight = measureTextBlockHeight(splitContentLines(doc, sentByStr, contentWidth - 16, 12).length, 6);
    } else {
      sbHeight = measureTextBlockHeight(splitLatinLines(doc, sentByStr, contentWidth - 16, 12, 'bold').length, 5);
    }
  }

  const payerBoxHeight = showSentBy 
    ? 8 + rfHeight + 4 + 8 + sbHeight + 4 
    : 8 + rfHeight + 4;

  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, payerBoxY, contentWidth, payerBoxHeight, 3, 3, 'D');

  let currentY = payerBoxY + 8;
  setLabelFont(doc, 9, 'bold');
  doc.setTextColor(...COLORS.gray500);
  doc.text('RECEIVED FROM', margin + 6, currentY);

  currentY += 6;
  doc.setTextColor(...COLORS.gray900);
  drawTextBlock(doc, receivedFromStr, margin + 6, currentY, contentWidth - 12, 14, true, 'bold');

  if (showSentBy) {
    currentY += rfHeight + 2;
    drawDivider(doc, margin + 6, currentY, contentWidth - 12, 0.4);

    currentY += 6;
    setLabelFont(doc, 9, 'bold');
    doc.setTextColor(...COLORS.gray500);
    doc.text('SENT BY', margin + 6, currentY);

    currentY += 6;
    doc.setTextColor(...COLORS.gray700);
    drawTextBlock(doc, sentByStr, margin + 6, currentY, contentWidth - 12, 12, true, 'bold');
  }

  y += payerBoxHeight + 8;

  // ----- BOX 2: AMOUNT (Stacked) -----
  const wordsVal = data.amountInWords || '---';
  const wordsWidth = contentWidth - 12;
  let wordsHeight = 10;
  
  if (hasArabic(wordsVal)) {
    setContentFont(doc, 12);
    wordsHeight = measureTextBlockHeight(splitContentLines(doc, wordsVal, wordsWidth, 12).length, 6);
  } else {
    wordsHeight = measureTextBlockHeight(splitLatinLines(doc, wordsVal, wordsWidth, 11, 'bold').length, 5);
  }

  const amountBoxHeight = 6 + 6 + 8 + 6 + 4 + wordsHeight + 2;
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, amountBoxHeight, 3, 3, 'D');

  let amtY = y + 6;
  
  // Top - Number
  setLabelFont(doc, 9, 'bold');
  doc.setTextColor(...COLORS.gray500);
  doc.text('TOTAL AMOUNT', margin + 6, amtY);

  amtY += 8;
  setLabelFont(doc, 18, 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(formatAmount(data.amount), margin + 6, amtY);

  amtY += 8;

  // Bottom - Words
  setLabelFont(doc, 9, 'bold');
  doc.setTextColor(...COLORS.gray500);
  doc.text('AMOUNT IN WORDS', margin + 6, amtY);

  amtY += 5;
  doc.setTextColor(...COLORS.gray900);
  
  if (hasArabic(wordsVal)) {
    setContentFont(doc, 12);
    doc.text(wordsVal, margin + 6 + wordsWidth, amtY, { align: 'right', maxWidth: wordsWidth });
  } else {
    setLabelFont(doc, 11, 'bold');
    const words = splitLatinLines(doc, wordsVal, wordsWidth, 11, 'bold');
    doc.text(words, margin + 6, amtY);
  }

  y += amountBoxHeight + 8;

  // ----- BOX 3: PAYMENT FOR -----
  let pfHeight = 15;
  if (data.reason) {
    if (hasArabic(data.reason)) {
      setContentFont(doc, 13);
      pfHeight = measureTextBlockHeight(splitContentLines(doc, data.reason, contentWidth - 12, 13).length, 6);
    } else {
      pfHeight = measureTextBlockHeight(splitLatinLines(doc, data.reason, contentWidth - 12, 13, 'bold').length, 5);
    }
  }

  const paymentBoxHeight = Math.max(30, 8 + 6 + pfHeight + 4);
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, paymentBoxHeight, 3, 3, 'D');

  setLabelFont(doc, 9, 'bold');
  doc.setTextColor(...COLORS.gray500);
  doc.text('PAYMENT FOR / REASON', margin + 6, y + 8);

  doc.setTextColor(...COLORS.gray900);
  drawTextBlock(doc, data.reason, margin + 6, y + 16, contentWidth - 12, 13, true, 'bold');

  y += paymentBoxHeight + 20;

  // ----- SIGNATURE AREA -----
  const signatureTop = Math.max(y, pageHeight - 55);

  const sigBoxWidth = 60;
  const sigBoxX = pageWidth - margin - sigBoxWidth;
  
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.line(sigBoxX, signatureTop + 20, sigBoxX + sigBoxWidth, signatureTop + 20);

  setLabelFont(doc, 9, 'bold');
  doc.setTextColor(...COLORS.gray500);
  doc.text('AUTHORISED SIGNATURE', sigBoxX + sigBoxWidth / 2, signatureTop + 26, { align: 'center' });
  
  setLabelFont(doc, 11, 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('Mohamed Sabry', sigBoxX + sigBoxWidth / 2, signatureTop + 32, { align: 'center' });

  if (data.receivedBySignature?.startsWith('data:image')) {
    try {
      const format = data.receivedBySignature.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(
        data.receivedBySignature,
        format,
        sigBoxX + sigBoxWidth / 2 - 20,
        signatureTop + 2,
        40,
        16,
      );
    } catch {
      // ignore
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
