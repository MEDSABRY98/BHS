'use client';

// Arabic / mixed text in jsPDF.
// By default jsPDF orders mixed lines wrongly (brackets flip, English words jump to the wrong side).
// Its built-in Bidi engine does it right when told that the text is logical, the paragraph is right-to-left
// and the output must be visual (with mirrored brackets). Call enableArabicBidi(doc) once after creating the document:
// every doc.text() / autoTable cell that contains Arabic is then ordered correctly; text without Arabic is untouched.

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export const BIDI_OPTIONS = {
  isInputVisual: false,
  isOutputVisual: true,
  isInputRtl: true,
  isOutputRtl: false,
  isSymmetricSwapping: true,
};

export const hasArabicText = (s: unknown): boolean => ARABIC.test(Array.isArray(s) ? (s as unknown[]).flat(2).join('') : String(s ?? ''));

export function enableArabicBidi<T extends { text: any }>(doc: T): T {
  const flag = '__arabicBidi';
  if ((doc as any)[flag]) return doc;
  const original = doc.text.bind(doc);
  (doc as any).text = (text: any, x: any, y: any, options?: any, ...rest: any[]) =>
    hasArabicText(text) ? original(text, x, y, { ...(options || {}), ...BIDI_OPTIONS }, ...rest) : original(text, x, y, options, ...rest);
  (doc as any)[flag] = true;
  return doc;
}
