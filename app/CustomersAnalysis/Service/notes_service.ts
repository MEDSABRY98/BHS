'use server';

import { getNotes, addNote, updateNote, deleteNoteRow } from '@/lib/supabase';

export async function getCustomerNotes(customerName?: string) {
  try {
    const notes = await getNotes(customerName || undefined);
    return notes;
  } catch (error) {
    console.error('Service Error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch notes');
  }
}

export async function createNote(body: { customerName: string; content: string; isSolved?: boolean }) {
  const { customerName, content, isSolved } = body;

  if (!customerName || !content) {
    throw new Error('Missing required fields');
  }

  try {
    await addNote(customerName, content, isSolved);
    return { success: true };
  } catch (error) {
    console.error('Service Error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to add note');
  }
}

export async function updateCustomerNote(body: { rowIndex: number; content: string; isSolved?: boolean }) {
  const { rowIndex, content, isSolved } = body;

  if (!rowIndex || !content) {
    throw new Error('Missing required fields');
  }

  try {
    await updateNote(String(rowIndex), content, isSolved);
    return { success: true };
  } catch (error) {
    console.error('Service Error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to update note');
  }
}

export async function deleteCustomerNote(rowIndex: number) {
  if (!rowIndex) {
    throw new Error('Missing required fields');
  }

  try {
    await deleteNoteRow(String(rowIndex));
    return { success: true };
  } catch (error) {
    console.error('Service Error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to delete note');
  }
}
