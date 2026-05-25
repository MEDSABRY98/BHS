import React from 'react';

export const normalizeCustomerKey = (name: string): string =>
  name.toString().toLowerCase().trim().replace(/\s+/g, ' ');

export const isPaymentTxn = (inv: { number?: string | null; credit?: number | null }): boolean => {
  const num = (inv.number?.toString() || '').toUpperCase();
  if (num.startsWith('BNK')) return true;
  if (num.startsWith('PBNK')) {
    return (inv.credit || 0) > 0.01;
  }
  if ((inv.credit || 0) <= 0.01) return false;
  return (
    !num.startsWith('SAL') &&
    !num.startsWith('RSAL') &&
    !num.startsWith('BIL') &&
    !num.startsWith('JV') &&
    !num.startsWith('OB') &&
    !num.startsWith('PBNK')
  );
};

export const getPaymentAmount = (inv: { credit?: number | null; debit?: number | null }): number => {
  const credit = inv.credit || 0;
  const debit = inv.debit || 0;
  return credit - debit;
};

export const parseInvoiceDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);

    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p3 > 1000) {
        const parsed = new Date(p3, p2 - 1, p1);
        if (!isNaN(parsed.getTime())) return parsed;
      } else if (p1 > 1000) {
        const parsed = new Date(p1, p2 - 1, p3);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
  }
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  return null;
};

export const shortenInvoiceNumber = (invoiceNumber: string | undefined | null, maxLength: number = 18): string => {
  if (!invoiceNumber) return '';
  const cleaned = invoiceNumber.replace(/\s*\(.*?\)\s*$/, '').trim();
  const upper = cleaned.toUpperCase();

  if (upper.startsWith('SAL') || upper.startsWith('RSAL') || upper.startsWith('BIL') || upper.startsWith('JV')) {
    const mainPart = cleaned.split(/\s+/)[0];
    return mainPart;
  }

  if (cleaned.length <= maxLength) return cleaned;
  const parts = cleaned.split(/[-_]/);
  if (parts.length >= 2) {
    const prefix = parts[0];
    const suffix = parts[parts.length - 1];
    if (prefix.length + suffix.length + 3 <= maxLength) {
      return `${prefix}...${suffix}`;
    }
  }

  const head = cleaned.substring(0, Math.max(6, maxLength - 10));
  const tail = cleaned.substring(cleaned.length - 6);
  return `${head}...${tail}`;
};

export const renderNoteWithLinks = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
  const parts: (string | React.JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    let url = match[0];
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {match[0]}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

export const NOTES_TEXTAREA_MAX_HEIGHT = 360;

export const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  const nextHeight = Math.min(el.scrollHeight, NOTES_TEXTAREA_MAX_HEIGHT);
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > NOTES_TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
};
