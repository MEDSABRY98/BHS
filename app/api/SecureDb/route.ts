// Gateway used by browser screens (lib/secureDb.ts) to read/write the database.
// Every call needs a valid login session; rules live in lib/secureDbGateway.ts.
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { runSecureRequest, type SecureResult } from '@/lib/secureDbGateway';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function reply(result: SecureResult) {
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return reply({
      data: null,
      error: { message: 'Your session has expired. Please log in again.', code: 'PGRST301' },
      count: null,
      status: 401,
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return reply({ data: null, error: { message: 'Invalid request.' }, count: null, status: 400 });
  }

  try {
    return reply(await runSecureRequest(user, body));
  } catch (e: unknown) {
    return reply({
      data: null,
      error: { message: e instanceof Error ? e.message : 'Query failed' },
      count: null,
      status: 500,
    });
  }
}
