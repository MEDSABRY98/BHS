'use client';

// Company Letter: write the letter like in Word, then print it on a plain white A4 page
// that fits the company letterhead paper (top / bottom space left empty on every page).
// Nothing is saved in the database: the draft and the margins stay in this browser only.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  ChevronDown,
  Eraser,
  Italic,
  Languages,
  List,
  ListOrdered,
  Minus,
  PenLine,
  Printer,
  Redo2,
  Ruler,
  Trash2,
  Type,
  Underline,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';
import { getAllowedForms } from '../Shared/FormsAccess';
import {
  DEFAULT_MARGINS,
  LETTER_CONTENT_CSS,
  printLetter,
  signaturesHtml,
  type LetterMargins,
  type LetterSignature,
  type SignatureAlign,
} from './LetterPrint';

const LETTERHEAD_FORM_ID = 'letterhead';

const DRAFT_KEY = 'companyLetterDraft';
const MARGINS_KEY = 'companyLetterMargins';
const PAGE_H = 297; // mm (A4)
const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];
const FONTS = ['Arial', 'Tahoma', 'Times New Roman', 'Calibri', 'Segoe UI'];

type Draft = { html: string; dir: 'rtl' | 'ltr'; signatures: LetterSignature[]; align: SignatureAlign };

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage not available
  }
};
const clampMm = (v: number, max: number) => (Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 0), max) : 0);
const newId = () => Math.random().toString(36).slice(2, 10);

export default function CompanyLetterPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  useModuleTabAudit('Company Letter');
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const loadAccess = useCallback(async () => {
    try {
      setAllowed((await getAllowedForms()).includes(LETTERHEAD_FORM_ID));
    } catch {
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          await loadAccess();
        }
      } finally {
        setIsChecking(false);
      }
    })();
  }, [loadAccess]);

  if (isChecking) return <MainLoader message="Loading Company Letter..." />;
  if (!isAuthenticated)
    return (
      <Login
        onLogin={async (user: any) => {
          setIsAuthenticated(true);
          setCurrentUser(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
          await loadAccess();
        }}
      />
    );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-black">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {allowed !== true && <PageHeader />}
        {allowed === null ? (
          <TabLoader className="!min-h-[60vh]" />
        ) : !allowed ? (
          <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use this form.</div>
        ) : (
          <LetterEditor />
        )}
      </div>
    </div>
  );
}

function PageHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => (window.location.href = '/Forms')}
        className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center transition-colors"
        title="All Forms"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <h1 className="text-2xl sm:text-3xl font-normal text-black tracking-tighter">Company Letter</h1>
      {children && <div className="flex items-center gap-2 ml-2">{children}</div>}
    </div>
  );
}

function LetterEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl');
  const [margins, setMargins] = useState<LetterMargins>(DEFAULT_MARGINS);
  const [signatures, setSignatures] = useState<LetterSignature[]>([]);
  const [align, setAlign] = useState<SignatureAlign>('end');
  const [showMargins, setShowMargins] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [ready, setReady] = useState(false);
  const [font, setFont] = useState('');
  const [size, setSize] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // restore the draft + margins of this browser
  useEffect(() => {
    const m = readJson<LetterMargins>(MARGINS_KEY);
    if (m) setMargins({ ...DEFAULT_MARGINS, ...m });
    const d = readJson<Draft>(DRAFT_KEY);
    if (d) {
      if (editorRef.current) editorRef.current.innerHTML = d.html || '';
      setDir(d.dir === 'ltr' ? 'ltr' : 'rtl');
      setSignatures(Array.isArray(d.signatures) ? d.signatures : []);
      setAlign(d.align || 'end');
    }
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      // older browsers
    }
    setReady(true);
  }, []);

  const saveDraft = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      writeJson(DRAFT_KEY, { html: editorRef.current?.innerHTML ?? '', dir, signatures, align } satisfies Draft);
    }, 400);
  }, [dir, signatures, align]);

  useEffect(() => {
    if (ready) saveDraft();
  }, [ready, saveDraft]);

  useEffect(() => {
    if (ready) writeJson(MARGINS_KEY, margins);
  }, [ready, margins]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    saveDraft();
  };

  // execCommand only knows sizes 1-7: mark with 7, then turn it into a real pt size
  const setFontSize = (pt: number) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7');
    el.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = `${pt}pt`;
      span.innerHTML = (f as HTMLElement).innerHTML;
      f.replaceWith(span);
    });
    el.querySelectorAll<HTMLElement>('[style*="xxx-large"]').forEach((s) => (s.style.fontSize = `${pt}pt`));
    document.execCommand('styleWithCSS', false, 'true');
    saveDraft();
  };

  const updateSignature = (id: string, patch: Partial<LetterSignature>) =>
    setSignatures((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const clearAll = () => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setSignatures([]);
    setConfirmClear(false);
    saveDraft();
  };

  const print = () =>
    printLetter({
      html: editorRef.current?.innerHTML ?? '',
      dir,
      margins,
      signatures,
      signatureAlign: align,
      title: 'Company Letter',
    });

  const contentH = Math.max(PAGE_H - margins.top - margins.bottom, 20);
  const tool = 'w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors';
  const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the text selection

  const iconBtn = 'w-10 h-10 rounded-xl flex items-center justify-center transition-colors';

  return (
    <div className="space-y-5">
      <PageHeader>
        <button
          type="button"
          onClick={() => setDir((d) => (d === 'rtl' ? 'ltr' : 'rtl'))}
          className={`${iconBtn} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
          title={dir === 'rtl' ? 'Arabic (RTL) - switch to English' : 'English (LTR) - switch to Arabic'}
        >
          <Languages className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setShowMargins((v) => !v)}
          className={`${iconBtn} ${showMargins ? 'bg-[#0f0f0f] text-[#D4AF37]' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          title="Paper margins"
        >
          <Ruler className="w-5 h-5" />
        </button>
        <button type="button" onClick={print} className={`${iconBtn} bg-[#0f0f0f] text-[#D4AF37] hover:bg-black shadow`} title="Print / Save PDF">
          <Printer className="w-5 h-5" />
        </button>
      </PageHeader>
      <style>{`${LETTER_CONTENT_CSS}
.lh-editor:empty:before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; }
.lh-editor:focus { outline: none; }`}</style>

      {/* toolbar */}
      <div className="sticky top-2 z-20 bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] p-2 flex flex-wrap items-center gap-1">
        <Dropdown
          title="Font"
          icon={Type}
          width="w-44"
          value={font}
          placeholder="Font"
          options={FONTS.map((f) => ({ value: f, label: f, style: { fontFamily: f } }))}
          onChange={(f) => {
            setFont(f);
            exec('fontName', f);
          }}
        />
        <Dropdown
          title="Font size"
          width="w-24"
          value={size}
          placeholder="Size"
          options={FONT_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
          onChange={(v) => {
            setSize(v);
            setFontSize(Number(v));
          }}
        />
        <span className="w-px h-6 bg-slate-200 mx-1" />
        <button type="button" onMouseDown={keep} onClick={() => exec('bold')} className={tool} title="Bold"><Bold className="w-4 h-4" /></button>
        <button type="button" onMouseDown={keep} onClick={() => exec('italic')} className={tool} title="Italic"><Italic className="w-4 h-4" /></button>
        <button type="button" onMouseDown={keep} onClick={() => exec('underline')} className={tool} title="Underline"><Underline className="w-4 h-4" /></button>
        <label className={`${tool} relative cursor-pointer`} title="Text color">
          <span className="text-sm font-black underline decoration-2 decoration-[#D4AF37]">A</span>
          <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => exec('foreColor', e.target.value)} />
        </label>
        <span className="w-px h-6 bg-slate-200 mx-1" />
        <button type="button" onMouseDown={keep} onClick={() => exec('justifyRight')} className={tool} title="Align right"><AlignRight className="w-4 h-4" /></button>
        <button type="button" onMouseDown={keep} onClick={() => exec('justifyCenter')} className={tool} title="Center"><AlignCenter className="w-4 h-4" /></button>
        <button type="button" onMouseDown={keep} onClick={() => exec('justifyLeft')} className={tool} title="Align left"><AlignLeft className="w-4 h-4" /></button>
        <button type="button" onMouseDown={keep} onClick={() => exec('justifyFull')} className={tool} title="Justify"><AlignJustify className="w-4 h-4" /></button>
        <span className="w-px h-6 bg-slate-200 mx-1" />
        <button type="button" onMouseDown={keep} onClick={() => exec('insertUnorderedList')} className={tool} title="Bullets"><List className="w-4 h-4" /></button>
        <button type="button" onMouseDown={keep} onClick={() => exec('insertOrderedList')} className={tool} title="Numbering"><ListOrdered className="w-4 h-4" /></button>
        <button type="button" onMouseDown={keep} onClick={() => exec('insertHorizontalRule')} className={tool} title="Line"><Minus className="w-4 h-4" /></button>
        <button type="button" onMouseDown={keep} onClick={() => exec('removeFormat')} className={tool} title="Clear formatting"><Eraser className="w-4 h-4" /></button>
        <span className="w-px h-6 bg-slate-200 mx-1" />
        <button type="button" onMouseDown={keep} onClick={() => exec('undo')} className={tool} title="Undo"><Undo2 className="w-4 h-4" /></button>
        <button type="button" onMouseDown={keep} onClick={() => exec('redo')} className={tool} title="Redo"><Redo2 className="w-4 h-4" /></button>
        <span className="w-px h-6 bg-slate-200 mx-1" />
        <div className="flex-1" />
        <button type="button" onClick={() => setConfirmClear(true)} className="h-9 px-3 rounded-lg text-xs font-black uppercase tracking-wider text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5" title="Clear the letter">
          <Trash2 className="w-4 h-4" /> Clear
        </button>
      </div>

      {showMargins && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 flex flex-wrap items-end gap-4">
          {([
            ['top', 'Top (letterhead)', 150],
            ['bottom', 'Bottom (footer)', 150],
            ['right', 'Right', 60],
            ['left', 'Left', 60],
          ] as const).map(([key, label, max]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label} · mm</span>
              <input
                type="number"
                min={0}
                max={max}
                value={margins[key]}
                onChange={(e) => setMargins((m) => ({ ...m, [key]: clampMm(Number(e.target.value), max) }))}
                className="w-32 h-10 px-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => setMargins(DEFAULT_MARGINS)}
            className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Reset
          </button>
          <p className="text-xs font-semibold text-slate-400 basis-full">
            Measure the printed logo and footer on the company paper once. The empty space is kept on every page, and it is saved in this browser.
          </p>
        </div>
      )}

      {/* the A4 paper */}
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.25)] border border-slate-200" style={{ width: '210mm', minHeight: `${PAGE_H}mm` }}>
          <div
            className="flex items-center justify-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 border-b border-dashed border-slate-200"
            style={{ height: `${margins.top}mm`, background: 'repeating-linear-gradient(135deg,#f8fafc 0 8px,#f1f5f9 8px 16px)' }}
          >
            Letterhead space
          </div>
          <div
            dir={dir}
            style={{
              padding: `0 ${margins.right}mm 0 ${margins.left}mm`,
              minHeight: `${contentH}mm`,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${contentH}mm - 1px), #fca5a5 calc(${contentH}mm - 1px), #fca5a5 ${contentH}mm)`,
            }}
          >
            <div
              ref={editorRef}
              className="lh-content lh-editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder={dir === 'rtl' ? 'اكتب الخطاب هنا...' : 'Write the letter here...'}
              onInput={saveDraft}
              style={{ minHeight: `${contentH}mm` }}
            />
            <div className="lh-content" dangerouslySetInnerHTML={{ __html: signaturesHtml(signatures, align) }} />
          </div>
          <div
            className="flex items-center justify-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 border-t border-dashed border-slate-200"
            style={{ height: `${margins.bottom}mm`, background: 'repeating-linear-gradient(135deg,#f8fafc 0 8px,#f1f5f9 8px 16px)' }}
          >
            Footer space
          </div>
        </div>
        <p className="text-center text-[11px] font-semibold text-slate-400 mt-2">
          The red line marks where a new page starts. Every page keeps the same empty top and bottom space.
        </p>
      </div>

      {/* signatures */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex-1">Signatures</h3>
          {signatures.length > 0 && (
            <Dropdown
              title="Signature position"
              icon={AlignCenter}
              width="w-40"
              value={align}
              options={[
                { value: 'start', label: dir === 'rtl' ? 'Right side' : 'Left side' },
                { value: 'center', label: 'Center' },
                { value: 'end', label: dir === 'rtl' ? 'Left side' : 'Right side' },
              ]}
              onChange={(v) => setAlign(v as SignatureAlign)}
            />
          )}
          <button
            type="button"
            onClick={() => setSignatures((list) => [...list, { id: newId(), name: '', title: '' }])}
            disabled={signatures.length >= 3}
            className="h-9 px-4 rounded-lg text-xs font-black uppercase tracking-wider bg-[#0f0f0f] text-[#D4AF37] hover:bg-black inline-flex items-center gap-2 disabled:opacity-50"
          >
            <PenLine className="w-4 h-4" /> Add signature
          </button>
        </div>
        {signatures.length === 0 ? (
          <p className="text-xs font-semibold text-slate-400">No signature. Add one to print a signature line with the name and the title at the end of the letter.</p>
        ) : (
          signatures.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3">
              <input
                value={s.name}
                onChange={(e) => updateSignature(s.id, { name: e.target.value })}
                placeholder="Name"
                dir="auto"
                className="flex-1 min-w-[180px] h-10 px-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15"
              />
              <input
                value={s.title}
                onChange={(e) => updateSignature(s.id, { title: e.target.value })}
                placeholder="Title / position"
                dir="auto"
                className="flex-1 min-w-[180px] h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15"
              />
              <button type="button" onClick={() => setSignatures((list) => list.filter((x) => x.id !== s.id))} className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-red-500 hover:bg-red-50" title="Remove">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {confirmClear && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Clear the letter?</h3>
            <p className="text-sm font-semibold text-slate-500">The text and the signatures will be removed. The margins are kept.</p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setConfirmClear(false)} className="flex-1 h-11 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 hover:bg-slate-200">Cancel</button>
              <button type="button" onClick={clearAll} className="flex-1 h-11 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 text-white hover:bg-red-700">Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type DropdownOption = { value: string; label: string; style?: React.CSSProperties };

/** Modern dropdown. Uses mousedown + preventDefault so the text selection in the letter is kept. */
function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Select',
  title,
  icon: Icon,
  width = 'w-40',
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  icon?: LucideIcon;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${width}`}>
      <button
        type="button"
        title={title}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={`w-full h-9 flex items-center gap-2 px-3 rounded-lg border bg-white text-sm font-semibold text-left transition-all duration-200 ${
          open ? 'border-[#D4AF37] ring-4 ring-[#D4AF37]/15 text-slate-900' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        {Icon && <Icon className={`w-4 h-4 shrink-0 ${open ? 'text-[#D4AF37]' : 'text-slate-400'}`} />}
        <span className={`flex-1 min-w-0 truncate ${selected ? '' : 'text-slate-400'}`} style={selected?.style}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-[#D4AF37]' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 min-w-full z-50 bg-white rounded-2xl border border-slate-200/80 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="max-h-72 overflow-y-auto p-1.5">
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm whitespace-nowrap transition-colors ${
                    isSel ? 'bg-amber-50 text-amber-800 font-bold' : 'text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex-1" style={o.style}>{o.label}</span>
                  {isSel && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
