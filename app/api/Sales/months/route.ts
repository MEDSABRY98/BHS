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

    // 2. Fetch and group from database
    const { count, error: countErr } = await bhs_supabas
      .from('web_Sales_DB')
      .select('*', { count: 'exact', head: true });

    if (countErr) throw countErr;

    const totalCount = count || 0;
    const batchSize = 1000;
    const numPages = Math.ceil(totalCount / batchSize);

    const promises = [];
    for (let i = 0; i < numPages; i++) {
      const start = i * batchSize;
      const end = start + batchSize - 1;
      promises.push(
        bhs_supabas
          .from('web_Sales_DB')
          .select('"INVOICE DATE"')
          .range(start, end)
      );
    }

    const results = await Promise.all(promises);
    const groups: Record<string, number> = {};

    for (const res of results) {
      if (res.error) throw res.error;
      for (const row of res.data || []) {
        const dateStr = row['INVOICE DATE'];
        if (!dateStr) continue;

        const parts = dateStr.split('-');
        if (parts.length < 2) continue;

        const year = parts[0];
        const month = parts[1];
        const key = `${year}-${month}`;

        groups[key] = (groups[key] || 0) + 1;
      }
    }

    const monthsList = Object.entries(groups).map(([key, count]) => {
      const [year, month] = key.split('-');
      return {
        year: parseInt(year),
        month: parseInt(month),
        count
      };
    }).sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });

    // Ensure parent directory exists
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Save to cache
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

    const monthStr = month.toString().padStart(2, '0');
    const pattern = `${year}-${monthStr}-%`;

    // Delete all records matching the year and month pattern
    const { error } = await bhs_supabas
      .from('web_Sales_DB')
      .delete()
      .like('INVOICE DATE', pattern);

    if (error) throw error;

    // Invalidate cache
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
