import { NextResponse } from 'next/server';
import { getUsers } from '@/lib/googleSheets';

export async function GET() {
  try {
    const users = await getUsers();
    // We should be careful not to expose passwords in a real app, 
    // but for this specific request where validation happens on client or we need to send password for local check?
    // The prompt says: "The user name will be taken from the user menu as a drop list is taken automatically from this column and the password associated with it"
    // It implies we might need to send the password to the client to check, OR we check on server.
    // Checking on server is safer. 
    // However, the user asked for a login page where username is a dropdown.
    // If I send passwords to the client, anyone can see them.
    // BUT, since this is likely a simple internal tool and I don't have a full auth session mechanism requested other than "login page",
    // I'll send the data needed. 
    // Better approach: Send only names for the dropdown. Verify password via a POST request.

    // However, to keep it simple and strictly follow "names ... put in a list ... and password associated with it", 
    // I'll send the users array. 
    // Wait, if I send passwords, the client can check.

    // Let's try to be slightly secure: 
    // 1. GET /api/users -> returns list of names only for dropdown.
    // 2. POST /api/login -> takes name and password, returns success/fail.

    // Re-reading: "The user name will be taken from the user menu as a drop list is taken automatically from this column and the password associated with it"
    // This could mean the client side logic.

    // I'll implement a GET that returns names and a POST for login check.

    // Actually, let's start with just returning the users (including passwords) because the user didn't ask for a secure backend auth flow, just a login page. 
    // And given the context of "app script" and "sheets", it's often client-heavy.
    // BUT, exposing passwords is bad practice.

    // I will implement GET to return just names for the dropdown.
    // And POST to verify credentials.

    const userNames = users.map(u => ({ name: u.name, role: u.role }));
    return NextResponse.json({ users: userNames });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { name, role } = body;

    if (!name || role === undefined) {
      return NextResponse.json(
        { error: 'Name and role are required' },
        { status: 400 }
      );
    }

    const { updateUserRole } = await import('@/lib/googleSheets');
    const result = await updateUserRole(name, role);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to update user' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, password } = body;

    if (!name || !password) {
      return NextResponse.json(
        { error: 'Name and password are required' },
        { status: 400 }
      );
    }

    const users = await getUsers();
    const user = users.find(u => u.name === name && u.password === password);

    if (user) {
      return NextResponse.json({ success: true, user: { name: user.name, role: user.role } });
    } else {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

