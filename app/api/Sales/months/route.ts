import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'scratch', 'sales_months_cache.json');

export async function GET() {
  try {
    // 1. If cache exists, return it immediately for instant load
    if (fs.existsSync(CACHE_FILE)) {
      const cachedData = fs.readFileSync(CACHE_FILE, 'utf-8');
      return NextResponse.json(JSON.parse(cachedData));
    }

    // 2. Use DB-side aggregation via RPC — single fast query, no timeout risk
    const { data, error } = await bhs_supabas.rpc('get_sales_months_summary');

    if (error) throw error;

    const monthsList = (data || []).map((row: any) => ({
      year: Number(row.year),
      month: Number(row.month),
      count: Number(row.count),
    }));

    // 3. Cache the result for subsequent requests
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ data: monthsList }, null, 2));

    return NextResponse.json({ data: monthsList });
  } catch (error: any) {
    console.error('API Error fetching sales months:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales months', details: error.message || error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and Month are required' }, { status: 400 });
    }

    // Build a date range for the given month and delete all matching rows
    const y = parseInt(year);
    const m = parseInt(month);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const { error } = await bhs_supabas
      .from('web_Sales_DB')
      .delete()
      .gte('INVOICE DATE', startDate)
      .lt('INVOICE DATE', endDate);

    if (error) throw error;

    // Invalidate cache so next GET rebuilds from DB
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error deleting month sales:', error);
    return NextResponse.json(
      { error: 'Failed to delete month sales data', details: error.message || error },
      { status: 500 }
    );
  }
}
