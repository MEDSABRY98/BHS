import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

interface MoveMonthSummary {
  year: number;
  month: number;
  count: number;
}

export interface MoveDaySummary {
  date: string;
  day: number;
  count: number;
}

async function fetchAllMoveDates(options?: {
  dateStart?: string;
  dateEnd?: string;
}): Promise<{ DATE: string | null }[]> {
  const pageSize = 1000;
  let from = 0;
  const allRows: { DATE: string | null }[] = [];

  while (true) {
    let query = bhs_supabase
      .from('web_INVENTORY_MOVES')
      .select('DATE')
      .order('DATE', { ascending: true });

    if (options?.dateStart) {
      query = query.gte('DATE', options.dateStart);
    }
    if (options?.dateEnd) {
      query = query.lt('DATE', options.dateEnd);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function deleteMatchingMoves(options: {
  dateStart: string;
  dateEnd: string;
}): Promise<void> {
  const pageSize = 1000;

  while (true) {
    const { data, error } = await bhs_supabase
      .from('web_INVENTORY_MOVES')
      .select('ID')
      .gte('DATE', options.dateStart)
      .lt('DATE', options.dateEnd)
      .limit(pageSize);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const ids = data.map((row) => row.ID).filter(Boolean);
    if (ids.length === 0) break;

    const { error: deleteError } = await bhs_supabase
      .from('web_INVENTORY_MOVES')
      .delete()
      .in('ID', ids);
    if (deleteError) throw deleteError;

    if (data.length < pageSize) break;
  }
}

function aggregateMonthsFromDates(rows: { DATE: string | null }[]): MoveMonthSummary[] {
  const counts = new Map<string, MoveMonthSummary>();

  for (const row of rows) {
    if (!row.DATE) continue;
    const d = new Date(row.DATE);
    if (Number.isNaN(d.getTime())) continue;

    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { year, month, count: 1 });
    }
  }

  return Array.from(counts.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

function aggregateDaysFromDates(rows: { DATE: string | null }[]): MoveDaySummary[] {
  const counts = new Map<string, MoveDaySummary>();

  for (const row of rows) {
    if (!row.DATE) continue;
    const d = new Date(row.DATE);
    if (Number.isNaN(d.getTime())) continue;

    const date = d.toISOString().split('T')[0];
    const existing = counts.get(date);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(date, { date, day: d.getUTCDate(), count: 1 });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.date.localeCompare(a.date));
}

async function fetchMoveMonthsSummary(): Promise<MoveMonthSummary[]> {
  const { data, error } = await bhs_supabase.rpc('get_inventory_moves_months_summary');
  if (!error && Array.isArray(data)) {
    return data.map((row: { year: number; month: number; count: number }) => ({
      year: Number(row.year),
      month: Number(row.month),
      count: Number(row.count),
    }));
  }

  const rows = await fetchAllMoveDates();
  return aggregateMonthsFromDates(rows);
}

async function fetchMoveDaysSummary(year: number, month: number): Promise<MoveDaySummary[]> {
  const { data, error } = await bhs_supabase.rpc('get_inventory_moves_days_summary', {
    p_year: year,
    p_month: month,
  });

  if (!error && Array.isArray(data)) {
    return data.map((row: { date: string; day: number; count: number }) => ({
      date: String(row.date),
      day: Number(row.day),
      count: Number(row.count),
    }));
  }

  const { start, end } = monthDateRange(year, month);
  const rows = await fetchAllMoveDates({ dateStart: start, dateEnd: end });
  return aggregateDaysFromDates(rows);
}

function dayDateRange(dateKey: string) {
  const start = `${dateKey}T00:00:00.000Z`;
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const end = `${d.toISOString().split('T')[0]}T00:00:00.000Z`;
  return { start, end };
}

function monthDateRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = `${nextMonth.year}-${String(nextMonth.month).padStart(2, '0')}-01T00:00:00.000Z`;
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'months') {
      const data = await fetchMoveMonthsSummary();
      return NextResponse.json({ data });
    }

    if (action === 'days') {
      const year = Number(searchParams.get('year'));
      const month = Number(searchParams.get('month'));
      if (!year || !month || month < 1 || month > 12) {
        return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
      }
      const data = await fetchMoveDaysSummary(year, month);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Inventory moves months API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory move summary', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
      }
      const { start, end } = dayDateRange(date);
      await deleteMatchingMoves({ dateStart: start, dateEnd: end });
      return NextResponse.json({ success: true });
    }

    const year = Number(searchParams.get('year'));
    const month = Number(searchParams.get('month'));

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
    }

    const { start, end } = monthDateRange(year, month);
    await deleteMatchingMoves({ dateStart: start, dateEnd: end });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Inventory moves month delete API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete inventory moves for month', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
