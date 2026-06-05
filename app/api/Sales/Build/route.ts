import { NextResponse } from 'next/server';
import { buildAndSaveCache } from '@/lib/SalesCache';

// Allow up to 60s for the build (Vercel Pro/Hobby limit)
export const maxDuration = 60;

/**
 * POST /api/Sales/Build
 * Builds the sales JSON cache from DB and saves it to Supabase Storage.
 * Called in the background after Refresh button or Mapping upload.
 */
export async function POST() {
  try {
    const { rows } = await buildAndSaveCache();
    return NextResponse.json({ success: true, rows });
  } catch (error: any) {
    console.error('❌ Build API error:', error);
    return NextResponse.json(
      { error: 'Build failed', details: error.message || String(error) },
      { status: 500 }
    );
  }
}
