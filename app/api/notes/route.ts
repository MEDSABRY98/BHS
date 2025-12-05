import { NextResponse } from 'next/server';
import { getNotes, addNote, updateNote } from '@/lib/googleSheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerName = searchParams.get('customerName');
    
    const notes = await getNotes(customerName || undefined);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notes';
    return NextResponse.json(
      { 
        error: 'Failed to fetch notes',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user, customerName, content } = body;

    if (!user || !customerName || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await addNote(user, customerName, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to add note';
    return NextResponse.json(
      { 
        error: 'Failed to add note',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { rowIndex, content } = body;

    if (!rowIndex || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await updateNote(rowIndex, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update note';
    return NextResponse.json(
      { 
        error: 'Failed to update note',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { rowIndex } = body;

    if (!rowIndex) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Dynamically import to avoid circular dependency issues if any, though here it's fine
    const { deleteNoteRow } = await import('@/lib/googleSheets');
    await deleteNoteRow(rowIndex);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete note';
    return NextResponse.json(
      { 
        error: 'Failed to delete note',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

