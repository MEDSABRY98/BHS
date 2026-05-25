import { NextResponse } from 'next/server';
import { getLuluEmails } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const luluEmails = await getLuluEmails();
    return NextResponse.json({ customers: luluEmails });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lulu emails list' },
      { status: 500 }
    );
  }
}
