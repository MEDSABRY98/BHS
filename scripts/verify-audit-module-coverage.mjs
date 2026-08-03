#!/usr/bin/env node
/**
 * Verifies that every user-facing Next.js module route is registered in
 * app/Audit/Utils/ModulePathMap.ts and that ActivityTracker is mounted globally.
 *
 * Usage: node scripts/verify-audit-module-coverage.mjs
 * Exit code 0 = OK, 1 = coverage gaps found.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'app');
const MODULE_MAP_FILE = path.join(ROOT, 'app', 'Audit', 'Utils', 'ModulePathMap.ts');
const LAYOUT_FILE = path.join(ROOT, 'app', 'layout.tsx');

/** Folders under app/ that are not end-user modules. */
const EXCLUDED_MODULE_DIRS = new Set([
  'Audit',
  'Components',
  'Emails',
  'api',
]);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listFiles(dir, matcher) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(fullPath, matcher));
    } else if (matcher(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function discoverModuleRoots() {
  if (!fs.existsSync(APP_DIR)) {
    throw new Error(`Missing app directory: ${APP_DIR}`);
  }

  return fs
    .readdirSync(APP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !EXCLUDED_MODULE_DIRS.has(entry.name))
    .filter((entry) => fs.existsSync(path.join(APP_DIR, entry.name, 'page.tsx')))
    .map((entry) => entry.name)
    .sort();
}

function parseModulePathMap(source) {
  const routes = [];
  const routePattern =
    /\{\s*prefix:\s*['"]([^'"]+)['"],\s*name:\s*(?:'([^']*)'|"([^"]*)")\s*\}/g;
  let match;
  while ((match = routePattern.exec(source)) !== null) {
    routes.push({ prefix: match[1], name: match[2] ?? match[3] });
  }
  return routes.sort((a, b) => b.prefix.length - a.prefix.length);
}

function pageFileToRoute(pageFile) {
  const rel = path.relative(APP_DIR, pageFile).replace(/\\/g, '/');
  if (rel === 'page.tsx') return '/';
  const segments = rel.split('/');
  segments.pop(); // remove page.tsx
  return `/${segments.join('/')}`;
}

function resolveModuleName(pathname, sortedRoutes) {
  if (!pathname || pathname === '/') return null;
  const hit = sortedRoutes.find(
    (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  );
  return hit?.name ?? null;
}

function main() {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(MODULE_MAP_FILE)) {
    console.error(`Missing ModulePathMap: ${MODULE_MAP_FILE}`);
    process.exit(1);
  }

  const mapSource = readText(MODULE_MAP_FILE);
  const registeredRoutes = parseModulePathMap(mapSource);
  const registeredPrefixes = new Set(registeredRoutes.map((route) => route.prefix.replace(/^\//, '')));

  const moduleRoots = discoverModuleRoots();
  const missingInMap = moduleRoots.filter((name) => !registeredPrefixes.has(name));
  if (missingInMap.length > 0) {
    errors.push(
      `Module folders with page.tsx but missing from ModulePathMap.ts: ${missingInMap.join(', ')}`,
    );
  }

  const orphanRoutes = [...registeredPrefixes].filter((prefix) => !moduleRoots.includes(prefix));
  if (orphanRoutes.length > 0) {
    warnings.push(
      `ModulePathMap entries without a top-level app/${'{name}'}/page.tsx: ${orphanRoutes.join(', ')}`,
    );
  }

  const pageFiles = listFiles(APP_DIR, (filePath) => filePath.endsWith(`${path.sep}page.tsx`));
  const unresolvedRoutes = [];
  for (const pageFile of pageFiles) {
    const route = pageFileToRoute(pageFile);
    if (route === '/') continue;
    if (!resolveModuleName(route, registeredRoutes)) {
      unresolvedRoutes.push(route);
    }
  }

  if (unresolvedRoutes.length > 0) {
    errors.push(
      `Routes not covered by ModulePathMap (${unresolvedRoutes.length}):\n  ${unresolvedRoutes.sort().join('\n  ')}`,
    );
  }

  if (!fs.existsSync(LAYOUT_FILE)) {
    errors.push('Missing app/layout.tsx');
  } else {
    const layoutSource = readText(LAYOUT_FILE);
    if (!layoutSource.includes('ActivityTracker')) {
      errors.push('ActivityTracker is not mounted in app/layout.tsx');
    }
    if (!layoutSource.includes('@/app/Audit/Components/ActivityTracker')) {
      warnings.push('ActivityTracker import path may have changed in app/layout.tsx');
    }
  }

  console.log('=== Audit module coverage ===');
  console.log(`Module roots found: ${moduleRoots.length}`);
  console.log(`ModulePathMap entries: ${registeredRoutes.length}`);
  console.log(`App routes checked: ${pageFiles.length - 1}`); // minus home

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    warnings.forEach((msg) => console.warn(`  - ${msg}`));
  }

  if (errors.length > 0) {
    console.error('\nFAILED:');
    errors.forEach((msg) => console.error(`  - ${msg}`));
    process.exit(1);
  }

  console.log('\nOK: all modules and routes are registered for activity tracking.');
}

main();
