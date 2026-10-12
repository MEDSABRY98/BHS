'use client';

import { useRef, useState } from 'react';
import { Download, Eye, File as FileIcon, FileImage, FileSpreadsheet, FileText, Loader2, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import ConfirmDialog from './ConfirmDialog';
import FilePreview from './FilePreview';
import { downloadAttachment, uploadAttachmentFile } from '../Utils/AttachmentActions';
import { deleteIntercompanyAttachment, getIntercompanyAttachmentUrl } from '../Service/IntercompanyService';
import {
  ATTACHMENT_ACCEPT,
  entryRef,
  fileExtension,
  formatAmount,
  formatBytes,
  formatDate,
  previewKind,
  type IntercompanyAttachment,
  type IntercompanyEntry,
} from '../Utils/IntercompanyTypes';

interface AttachmentsModalProps {
  entry: IntercompanyEntry;
  initialFiles: IntercompanyAttachment[];
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onCountChanged: (count: number) => void;
}

function fileIcon(name: string) {
  const ext = fileExtension(name);
  if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return <FileImage className="w-5 h-5 text-blue-500" />;
  if (['xls', 'xlsx'].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
  return <FileIcon className="w-5 h-5 text-slate-500" />;
}

export default function AttachmentsModal({ entry, initialFiles, canEdit, canDelete, onClose, onCountChanged }: AttachmentsModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<IntercompanyAttachment[]>(initialFiles);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ file: IntercompanyAttachment; url: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IntercompanyAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = async (list: FileList | File[] | null | undefined) => {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    let ok = 0;
    for (const file of picked) {
      setUploading(file.name);
      try {
        const saved = await uploadAttachmentFile(entry.ID, file);
        setFiles((prev) => {
          const next = [...prev, saved];
          onCountChanged(next.length);
          return next;
        });
        ok++;
      } catch (err: any) {
        toast.error(`${file.name}: ${err?.message || 'upload failed'}`);
      }
    }
    setUploading(null);
    if (inputRef.current) inputRef.current.value = '';
    if (ok) toast.success(ok === 1 ? 'File uploaded' : `${ok} files uploaded`);
  };

  const openPreview = async (file: IntercompanyAttachment) => {
    setBusyId(file.ID);
    try {
      const url = await getIntercompanyAttachmentUrl(file.ID, 'preview');
      if (previewKind(file.MIME_TYPE)) setPreview({ file, url });
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err?.message || 'Could not open the file');
    } finally {
      setBusyId(null);
    }
  };

  const download = async (file: IntercompanyAttachment) => {
    setBusyId(file.ID);
    try {
      await downloadAttachment(file);
    } catch (err: any) {
      toast.error(err?.message || 'Could not download the file');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteIntercompanyAttachment(deleteTarget.ID);
      setFiles((prev) => {
        const next = prev.filter((f) => f.ID !== deleteTarget.ID);
        onCountChanged(next.length);
        return next;
      });
      if (preview?.file.ID === deleteTarget.ID) setPreview(null);
      toast.success('Attachment deleted');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete the attachment');
    } finally {
      setDeleting(false);
    }
  };

  const busyUpload = !!uploading;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={busyUpload ? undefined : onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
              <Paperclip className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900">Attachments</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {formatDate(entry.ENTRY_DATE)} · {entryRef(entry)} · {formatAmount(entry.DEBIT || entry.CREDIT)}
              </p>
              {entry.LABEL && (
                <p className="text-xs text-slate-400 mt-0.5 truncate" dir="auto">
                  {entry.LABEL}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} disabled={busyUpload} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {canEdit && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (!busyUpload) void uploadFiles(e.dataTransfer.files);
              }}
              onClick={() => !busyUpload && inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-1.5 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
              }`}
            >
              {busyUpload ? <Loader2 className="w-7 h-7 text-blue-600 animate-spin" /> : <Upload className="w-7 h-7 text-slate-400" />}
              <p className="text-sm font-black text-slate-700 text-center break-all">{busyUpload ? `Uploading ${uploading}...` : 'Add files'}</p>
              <p className="text-xs text-slate-400 font-medium">PDF, images, Excel or Word · up to 20 MB each</p>
              <input ref={inputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={(e) => void uploadFiles(e.target.files)} />
            </div>
          )}

          {files.length === 0 ? (
            <p className="text-center text-sm font-bold text-slate-400 py-8">No attachments for this line yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
              {files.map((f) => (
                <li key={f.ID} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">{fileIcon(f.FILE_NAME)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate" dir="auto" title={f.FILE_NAME}>
                      {f.FILE_NAME}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {formatBytes(f.FILE_SIZE)} · {new Date(f.UPLOADED_AT).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      {f.UPLOADED_BY_NAME ? ` · ${f.UPLOADED_BY_NAME}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {busyId === f.ID ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400 mx-2" />
                    ) : (
                      <>
                        <button onClick={() => void openPreview(f)} className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50" title={previewKind(f.MIME_TYPE) ? 'Preview' : 'Open'}>
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => void download(f)} className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button onClick={() => setDeleteTarget(f)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {preview && (
        <FilePreview file={preview.file} url={preview.url} onClose={() => setPreview(null)} onDownload={() => void download(preview.file)} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this attachment?"
        message={deleteTarget?.FILE_NAME}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
