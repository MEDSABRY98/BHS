'use client';

import { Download, X } from 'lucide-react';
import { previewKind, type IntercompanyAttachment } from '../Utils/IntercompanyTypes';

interface FilePreviewProps {
  file: IntercompanyAttachment;
  url: string;
  onClose: () => void;
  onDownload: () => void;
}

/** Full-screen viewer for PDF and image attachments. */
export default function FilePreview({ file, url, onClose, onDownload }: FilePreviewProps) {
  return (
    <div
      className="fixed inset-0 z-[115] flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3 bg-[#0a0f1d] text-white shrink-0" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold truncate" dir="auto">
          {file.FILE_NAME}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onDownload} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold">
            <Download className="w-4 h-4" /> Download
          </button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {previewKind(file.MIME_TYPE) === 'pdf' ? (
          <iframe src={url} title={file.FILE_NAME} className="w-full h-full max-w-5xl rounded-xl bg-white" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.FILE_NAME} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
        )}
      </div>
    </div>
  );
}
