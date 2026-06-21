import { NextResponse } from 'next/server';
import { getNormalICTotal, migrateICFromGoogleSheets } from '@/lib/Sheets/GoogleSheets';

export async function GET() {
  try {
    const data = await getNormalICTotal();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch normal IC total' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await migrateICFromGoogleSheets();
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    console.error('IC migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to migrate IC data' },
      { status: 500 }
    );
  }
}
