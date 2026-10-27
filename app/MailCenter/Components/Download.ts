'use client';

import { saveTrackedAs } from '@/app/AdminControl/Code/Audit/TrackedDownload';

/** saves files that came from the server as base64 */
export function downloadFiles(files: { filename: string; base64: string; contentType: string }[]) {
  files.forEach((f) => {
    const bin = atob(f.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    saveTrackedAs(new Blob([bytes], { type: f.contentType }), f.filename);
  });
}
