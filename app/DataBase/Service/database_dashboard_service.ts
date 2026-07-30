'use server';

import { bhs_supabas } from '@/lib/supabase';
import { getDebitMetadata } from '@/app/Debit/Service/debit_service';
import {
  DATABASE_NAV_ITEMS,
  type DatabaseCategoryId,
  type DatabaseNavItem,
  type DatabaseSourceConfig,
} from '../Utils/DatabaseHubConfig';

export type DatabaseSourceStatus = {
  id: string;
  label: string;
  href: string;
  category: DatabaseCategoryId;
  rowCount: number;
  lastDataDate: string | null;
  error?: string;
};

function normalizeToDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

function applyFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  filter?: DatabaseSourceConfig['filter'],
): T {
  if (!filter) return query;
  return query.eq(filter.column, filter.value);
}

async function fetchReferenceSourceStatus(item: DatabaseNavItem): Promise<DatabaseSourceStatus> {
  const { source } = item;
  try {
    let query = bhs_supabas.from(source.table).select('*', { count: 'exact', head: true });
    query = applyFilter(query, source.filter);
    const { count, error } = await query;
    if (error) throw error;

    return {
      id: item.id,
      label: item.label,
      href: item.href,
      category: item.category,
      rowCount: count ?? 0,
      lastDataDate: null,
    };
  } catch (err) {
    return {
      id: item.id,
      label: item.label,
      href: item.href,
      category: item.category,
      rowCount: 0,
      lastDataDate: null,
      error: err instanceof Error ? err.message : 'Failed to load',
    };
  }
}

async function fetchTransactionalSourceStatus(item: DatabaseNavItem): Promise<DatabaseSourceStatus> {
  const { source } = item;

  if (source.useDebitMetadata) {
    try {
      const meta = await getDebitMetadata();
      return {
        id: item.id,
        label: item.label,
        href: item.href,
        category: item.category,
        rowCount: meta.rowCount,
        lastDataDate: normalizeToDateString(meta.lastUpdated),
      };
    } catch (err) {
      return {
        id: item.id,
        label: item.label,
        href: item.href,
        category: item.category,
        rowCount: 0,
        lastDataDate: null,
        error: err instanceof Error ? err.message : 'Failed to load',
      };
    }
  }

  const dateColumn = source.dateColumn;
  if (!dateColumn) {
    return fetchReferenceSourceStatus(item);
  }

  try {
    let countQuery = bhs_supabas.from(source.table).select('*', { count: 'exact', head: true });
    countQuery = applyFilter(countQuery, source.filter);
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    const selectCol = dateColumn.includes(' ') ? `"${dateColumn}"` : dateColumn;

    let dateQuery = bhs_supabas
      .from(source.table)
      .select(selectCol)
      .order(dateColumn, { ascending: false })
      .limit(1);
    dateQuery = applyFilter(dateQuery, source.filter);
    const { data: dateRows, error: dateError } = await dateQuery;
    if (dateError) throw dateError;

    const rawDate = dateRows?.[0]?.[dateColumn as keyof (typeof dateRows)[0]];

    return {
      id: item.id,
      label: item.label,
      href: item.href,
      category: item.category,
      rowCount: count ?? 0,
      lastDataDate: normalizeToDateString(rawDate),
    };
  } catch (err) {
    return {
      id: item.id,
      label: item.label,
      href: item.href,
      category: item.category,
      rowCount: 0,
      lastDataDate: null,
      error: err instanceof Error ? err.message : 'Failed to load',
    };
  }
}

async function fetchSourceStatus(item: DatabaseNavItem): Promise<DatabaseSourceStatus> {
  if (item.source.kind === 'reference') {
    return fetchReferenceSourceStatus(item);
  }
  return fetchTransactionalSourceStatus(item);
}

export async function fetchDatabaseSourcesStatus(): Promise<DatabaseSourceStatus[]> {
  return Promise.all(DATABASE_NAV_ITEMS.map(fetchSourceStatus));
}
