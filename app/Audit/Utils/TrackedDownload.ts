'use client';

import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { InferFileType, TrackDownload } from './ActivityQueue';

export function trackFileDownload(fileName: string) {
  const safeName = fileName.trim();
  if (!safeName) return;
  TrackDownload(safeName, InferFileType(safeName));
}

export function saveTrackedAs(data: Blob | File | string, fileName: string) {
  saveAs(data, fileName);
  trackFileDownload(fileName);
}

export function saveTrackedPdf(doc: { save: (fileName: string) => void }, fileName: string) {
  doc.save(fileName);
  trackFileDownload(fileName);
}

export function triggerTrackedDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  trackFileDownload(fileName);
}

export function writeTrackedXlsxFile(workbook: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(workbook, fileName);
  trackFileDownload(fileName);
}
