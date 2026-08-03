#!/usr/bin/env node
/**
 * Verifies that user file downloads (Excel, PDF, ZIP, CSV, etc.) go through
 * tracked helpers in app/Audit/Utils/TrackedDownload.ts or the shared Excel export shim.
 *
 * Usage: node scripts/verify-audit-download-coverage.mjs
 * Exit code 0 = OK, 1 = untracked download patterns found.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'app');

const TRACKED_HELPERS =
  /saveTrackedAs|saveTrackedPdf|triggerTrackedDownload|writeTrackedXlsxFile|trackFileDownload|exportStyledExcel|exportStyledExcelWorkbook|exportStyledExcelTable/;

/** Files that build blobs for callers; they must not download directly. */
const BLOB_ONLY_ALLOWLIST = new Set([
  'app/Debit/CustomersTab/ExcelEmails.ts',
  'app/Debit/Pdf/SummaryUtils.ts',
  'app/Sales/Reports/ReportsPdf.ts',
  'app/Sales/Reports/ReportsZipExport.ts',
  'app/InventoryScrap/Pdf/InventoryScrapReportPdf.ts',
  'app/LPOs/Pdf/DeliveryUtils.ts',
]);

/** Central shim already tracked. */
const TRACKED_SHIM_ALLOWLIST = new Set([
  'app/Audit/Utils/TrackedDownload.ts',
  'app/Components/Export/ExcelExport.ts',
]);

const FORBIDDEN_PATTERNS = [
  { id: 'file-saver-import', regex: /from\s+['"]file-saver['"]/, label: 'direct file-saver import' },
  { id: 'save-as', regex: /\bsaveAs\s*\(/, label: 'saveAs(' },
  { id: 'doc-save', regex: /\bdoc\.save\s*\(/, label: 'doc.save(' },
  { id: 'xlsx-write-file', regex: /\bXLSX\.writeFile\s*\(/, label: 'XLSX.writeFile(' },
  { id: 'anchor-download', regex: /\blink\.download\s*=/, label: 'link.download =' },
  { id: 'jspdf-output-save', regex: /\.output\s*\(\s*['"]save/, label: "jspdf output('save" },
];

const SUSPICIOUS_PATTERNS = [
  { id: 'write-buffer', regex: /\.xlsx\.writeBuffer\s*\(/, label: 'workbook.xlsx.writeBuffer()' },
  { id: 'zip-generate', regex: /\.generateAsync\s*\(/, label: 'zip.generateAsync()' },
  { id: 'create-object-url', regex: /URL\.createObjectURL\s*\(/, label: 'URL.createObjectURL()' },
];

function toPosixRel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function listSourceFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function findMatches(source, regex) {
  const matches = [];
  const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  let match;
  while ((match = globalRegex.exec(source)) !== null) {
    matches.push({
      line: lineNumberAt(source, match.index),
      text: match[0],
    });
  }
  return matches;
}

function isPrintOnlyContext(source) {
  return (
    source.includes('printPdfInSameTab') ||
    source.includes('.print(') ||
    source.includes('contentWindow?.print') ||
    source.includes('iframe.contentWindow?.print')
  );
}

function main() {
  const errors = [];
  const warnings = [];

  const files = listSourceFiles(APP_DIR);
  for (const filePath of files) {
    const rel = toPosixRel(filePath);
    const source = fs.readFileSync(filePath, 'utf8');
    const isAllowlisted =
      BLOB_ONLY_ALLOWLIST.has(rel) ||
      TRACKED_SHIM_ALLOWLIST.has(rel) ||
      rel.startsWith('app/Audit/');

    if (!isAllowlisted) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        for (const hit of findMatches(source, pattern.regex)) {
          errors.push(`${rel}:${hit.line}  forbidden ${pattern.label}`);
        }
      }
    }

    const hasTrackedHelper = TRACKED_HELPERS.test(source);
    const printOnly = isPrintOnlyContext(source);

    for (const pattern of SUSPICIOUS_PATTERNS) {
      const hits = findMatches(source, pattern.regex);
      if (hits.length === 0) continue;

      if (BLOB_ONLY_ALLOWLIST.has(rel) || TRACKED_SHIM_ALLOWLIST.has(rel)) continue;

      if (pattern.id === 'create-object-url' && printOnly && !/\blink\.download\s*=/.test(source)) {
        continue;
      }

      if (!hasTrackedHelper) {
        for (const hit of hits) {
          errors.push(
            `${rel}:${hit.line}  ${pattern.label} without tracked download helper in the same file`,
          );
        }
        continue;
      }

      if (pattern.id === 'zip-generate' && !/saveTrackedAs|triggerTrackedDownload/.test(source)) {
        warnings.push(
          `${rel} uses generateAsync but only via re-export/caller — verify callers call saveTrackedAs`,
        );
      }
    }
  }

  console.log('=== Audit download coverage ===');
  console.log(`Scanned ${files.length} source files under app/`);

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    warnings.forEach((msg) => console.warn(`  - ${msg}`));
  }

  if (errors.length > 0) {
    console.error(`\nFAILED (${errors.length} issue(s)):`);
    errors.forEach((msg) => console.error(`  - ${msg}`));
    console.error('\nFix by routing downloads through app/Audit/Utils/TrackedDownload.ts helpers.');
    process.exit(1);
  }

  console.log('\nOK: no untracked Excel/PDF/ZIP download patterns detected.');
}

main();
