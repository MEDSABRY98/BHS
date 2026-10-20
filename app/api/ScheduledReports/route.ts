// Scheduled Reports timer: Supabase pg_cron calls this every 5 minutes
// (Authorization: Bearer <CRON_SECRET>). Sends the reports whose time has come.
import { NextResponse } from 'next/server';
import { runDueReports } from '@/app/ScheduledReports/Server/Runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDueReports(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: unknown) {
    console.error('[ScheduledReports] run failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Run failed' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
