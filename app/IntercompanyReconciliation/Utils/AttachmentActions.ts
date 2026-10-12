'use client';

// Browser-side attachment helpers shared by the table cell and the attachments popup.

import { bhs_supabas } from '@/lib/supabase';
import { createIntercompanyUpload, getIntercompanyAttachmentUrl, saveIntercompanyAttachment } from '../Service/IntercompanyService';
import { INTERCOMPANY_BUCKET, MAX_ATTACHMENT_BYTES, mimeFromName, type IntercompanyAttachment } from './IntercompanyTypes';

/** Checks the file, uploads it straight to Supabase, then saves the attachment row. */
export async function uploadAttachmentFile(entryId: string, file: File): Promise<IntercompanyAttachment> {
  if (!mimeFromName(file.name, file.type)) throw new Error('only PDF, images, Excel and Word files are allowed');
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('the file is larger than 20 MB');
  const { path, token, mime } = await createIntercompanyUpload(entryId, { name: file.name, size: file.size, type: file.type });
  const { error } = await bhs_supabas.storage.from(INTERCOMPANY_BUCKET).uploadToSignedUrl(path, token, file, { contentType: mime });
  if (error) throw new Error(error.message);
  return saveIntercompanyAttachment(entryId, { path, name: file.name, size: file.size, mime });
}

export async function downloadAttachment(file: IntercompanyAttachment): Promise<void> {
  const url = await getIntercompanyAttachmentUrl(file.ID, 'download');
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
