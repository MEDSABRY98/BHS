'use client';

import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import AttachmentsModal from './AttachmentsModal';
import { listIntercompanyAttachments } from '../Service/IntercompanyService';
import type { IntercompanyAttachment, IntercompanyEntry } from '../Utils/IntercompanyTypes';

interface AttachmentCellProps {
  entry: IntercompanyEntry;
  canEdit: boolean;
  canDelete: boolean;
  onCountChanged: (count: number) => void;
}

/** One button: loads the line's attachments (half-circle spinner), then opens the popup. */
export default function AttachmentCell({ entry, canEdit, canDelete, onCountChanged }: AttachmentCellProps) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<IntercompanyAttachment[] | null>(null);
  const count = entry.ATTACHMENTS_COUNT;

  const open = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const list = await listIntercompanyAttachments(entry.ID);
      if (list.length !== count) onCountChanged(list.length);
      setFiles(list);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load the attachments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => void open()}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-1.5 min-w-[52px] px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
          count ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
        }`}
        title="Attachments"
      >
        {loading ? (
          <span className="block w-4 h-4 rounded-full border-2 border-current border-b-transparent border-l-transparent animate-spin" />
        ) : (
          <>
            <Paperclip className="w-3.5 h-3.5" />
            {count}
          </>
        )}
      </button>

      {files && (
        <AttachmentsModal
          entry={entry}
          initialFiles={files}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setFiles(null)}
          onCountChanged={onCountChanged}
        />
      )}
    </>
  );
}
