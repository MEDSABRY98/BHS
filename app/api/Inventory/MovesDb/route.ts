import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';

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

async function fetchMoveMonthsSummary(): Promise<MoveMonthSummary[]> {
  const counts = new Map<string, MoveMonthSummary>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await bhs_supabas
      .from('web_INVENTORY_MOVES')
      .select('DATE')
      .order('DATE', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (!row.DATE) continue;
      const d = new Date(row.DATE);
      if (Number.isNaN(d.getTime())) continue;

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { year, month, count: 1 });
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return Array.from(counts.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

async function fetchMoveDaysSummary(year: number, month: number): Promise<MoveDaySummary[]> {
  const { start, end } = monthDateRange(year, month);
  const counts = new Map<string, MoveDaySummary>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await bhs_supabas
      .from('web_INVENTORY_MOVES')
      .select('DATE')
      .gte('DATE', start)
      .lt('DATE', end)
      .order('DATE', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
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

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return Array.from(counts.values()).sort((a, b) => b.date.localeCompare(a.date));
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
      const { error } = await bhs_supabas
        .from('web_INVENTORY_MOVES')
        .delete()
        .gte('DATE', start)
        .lt('DATE', end);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const year = Number(searchParams.get('year'));
    const month = Number(searchParams.get('month'));

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
    }

    const { start, end } = monthDateRange(year, month);
    const { error } = await bhs_supabas
      .from('web_INVENTORY_MOVES')
      .delete()
      .gte('DATE', start)
      .lt('DATE', end);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Inventory moves month delete API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete inventory moves for month', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
