import { triggerTrackedDownload } from '@/app/Audit/Utils/TrackedDownload';

/**
 * Download a text file detailing any issues encountered during Excel upload.
 *
 * @param fileName The name of the file to download (e.g., 'Upload_Issues.txt')
 * @param title The title inside the text file
 * @param sections An array of sections containing a heading and an array of lines. Sections with empty lines will be omitted.
 */
export const downloadUploadIssuesReport = (
  fileName: string,
  title: string,
  sections: { heading: string; lines: string[] }[]
) => {
  const nonEmptySections = sections.filter((section) => section.lines.length > 0);
  if (nonEmptySections.length === 0) return;

  const lines: string[] = [title, `Generated: ${new Date().toLocaleString('en-GB')}`, ''];
  nonEmptySections.forEach((section) => {
    lines.push(section.heading);
    section.lines.forEach((line) => lines.push(line));
    lines.push('');
  });

  const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
  triggerTrackedDownload(blob, fileName);
};

/**
 * Normalizes Excel IDs to ensure they are clean strings.
 */
export const normalizeExcelId = (val: unknown): string => {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Number.isInteger(val) ? String(Math.trunc(val)) : String(val);
  }
  return String(val).trim();
};
