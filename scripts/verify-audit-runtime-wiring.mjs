#!/usr/bin/env node
/**
 * Finds modules where activity audit may not run at runtime:
 * - auth-gated pages missing useAuditAfterAuth
 * - tab audit only in a child component (delayed until after loading)
 * - page.tsx with no audit import at all (relies on layout/child only)
 *
 * Usage: node scripts/verify-audit-runtime-wiring.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'app');
const AUDIT_IMPORT =
  /from ['"]@\/app\/Audit\/Modules\/|from ['"]@\/app\/Audit\/Utils\/useModuleTabAudit|TrackModuleSubTab|trackSalesTab|useLposRouteAudit|useDataBaseRouteAudit/;

const AUTH_GATED_PATTERN =
  /isChecking|isAuthenticated|verifyUserCredentials|<Login/;

const AUDIT_TRACKING_EXCLUDED = new Set(['AdminControl']);

const MODULE_TAB_AUDIT_FILES = {
  CashReceipt: 'CashReceiptTabAudit.ts',
  CashHandover: 'CashHandoverTabAudit.ts',
  PettyCash: 'PettyCashTabAudit.ts',
  DocumentsTracking: 'DocumentsTrackingTabAudit.ts',
  CustomersSummaries: 'CustomersSummariesTabAudit.ts',
  DebitInsights: 'DebitInsightsTabAudit.ts',
  Debit: 'DebitTabAudit.ts',
  CustomersDocuments: 'CustomersDocumentsTabAudit.ts',
  InventoryAnalysis: 'InventoryTabAudit.ts',
  InventoryItemCode: 'InventoryItemCodeTabAudit.ts',
  InventoryCounting: 'InventoryCountingTabAudit.ts',
  InventoryScrap: 'InventoryScrapTabAudit.ts',
  PurchasePriceTracking: 'PurchasePriceTrackingTabAudit.ts',
  Sales: 'SalesTabAudit.ts',
  LPOs: 'LPOsTabAudit.ts',
  DataBase: 'DataBaseTabAudit.ts',
  CustomersDiscounts: 'CustomersDiscountsTabAudit.ts',
};

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listFiles(dir, matcher) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listFiles(fullPath, matcher));
    else if (matcher(fullPath)) results.push(fullPath);
  }
  return results;
}

function moduleHasAuditImportUnder(dir) {
  const files = listFiles(dir, (p) => /\.(tsx|ts)$/.test(p));
  return files.some((file) => AUDIT_IMPORT.test(readText(file)));
}

function main() {
  const warnings = [];
  const errors = [];

  for (const [moduleName, tabAuditFile] of Object.entries(MODULE_TAB_AUDIT_FILES)) {
    if (AUDIT_TRACKING_EXCLUDED.has(moduleName)) continue;
    const moduleDir = path.join(APP_DIR, moduleName);
    const pagePath = path.join(moduleDir, 'page.tsx');
    const layoutPath = path.join(moduleDir, 'layout.tsx');

    if (!fs.existsSync(pagePath)) {
      errors.push(`${moduleName}: missing app/${moduleName}/page.tsx`);
      continue;
    }

    const pageSource = readText(pagePath);
    const layoutSource = fs.existsSync(layoutPath) ? readText(layoutPath) : '';
    const pageHasAudit = AUDIT_IMPORT.test(pageSource);
    const layoutHasAudit = AUDIT_IMPORT.test(layoutSource);
    const moduleHasAudit = moduleHasAuditImportUnder(moduleDir);

    if (!moduleHasAudit) {
      errors.push(`${moduleName}: no runtime audit import anywhere under app/${moduleName}/`);
    }

    const authGated = AUTH_GATED_PATTERN.test(pageSource);
    const hasAuditAfterAuth = /useAuditAfterAuth/.test(pageSource);
    const auditOnlyInChild = moduleHasAudit && !pageHasAudit && !layoutHasAudit;

    if (authGated && !hasAuditAfterAuth && auditOnlyInChild) {
      warnings.push(
        `${moduleName}: auth-gated page with tab audit only in child component — add useAuditAfterAuth on page.tsx`,
      );
    }

    if (auditOnlyInChild) {
      warnings.push(`${moduleName}: page.tsx has no audit hook (child/layout only)`);
    }

    const tabAuditPath = path.join(APP_DIR, 'Audit', 'Modules', tabAuditFile);
    if (!fs.existsSync(tabAuditPath)) {
      errors.push(`${moduleName}: missing ${tabAuditFile}`);
    }
  }

  console.log('=== Audit runtime wiring ===');
  console.log(`Modules checked: ${Object.keys(MODULE_TAB_AUDIT_FILES).length}`);

  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach((msg) => console.warn(`  - ${msg}`));
  }

  if (errors.length) {
    console.error('\nFAILED:');
    errors.forEach((msg) => console.error(`  - ${msg}`));
    process.exit(1);
  }

  console.log('\nOK: every module has runtime audit wiring.');
}

main();
