'use client';

// Asks who signs a PDF, in which order, right before it is made:
//   const signers = await pickSignatures('debit-note', { title: 'Debit Note' });
//   if (!signers) return;            // cancelled → no PDF
//   drawSignatures(doc, signers, …)  // [] → no signature part
// The list comes from Data Base → Signatories DB; a report can also offer its own people
// (e.g. the employee of a petty cash, the person who prepared a transfer).
// The last choice of each report is remembered in this browser.

import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowUp, Check, ExternalLink, Loader2, PenLine, Plus, Search, X } from 'lucide-react';
import { listSignatories } from './SignatureService';
import type { Signatory, Signer } from './SignatureTypes';

type Option = { key: string; title: string; name: string; image?: string | null; from: 'report' | 'list' };

interface PickOptions {
  /** shown in the window title */
  title: string;
  /** people this report offers itself (title + name filled from the document) */
  suggested?: Signer[];
}

const storeKey = (reportId: string) => `signatures:${reportId}`;
const readLast = (reportId: string): string[] | null => {
  try {
    const raw = localStorage.getItem(storeKey(reportId));
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.map(String) : null;
  } catch {
    return null;
  }
};
const writeLast = (reportId: string, keys: string[]) => {
  try {
    localStorage.setItem(storeKey(reportId), JSON.stringify(keys));
  } catch {
    // storage not available
  }
};

let cache: { at: number; list: Signatory[] } | null = null;
async function loadSignatories(): Promise<Signatory[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.list;
  const list = await listSignatories();
  cache = { at: Date.now(), list };
  return list;
}

/** Opens the window; resolves with the chosen signers (in order), [] for none, or null when cancelled. */
export function pickSignatures(reportId: string, opts: PickOptions): Promise<Signer[] | null> {
  if (typeof document === 'undefined') return Promise.resolve([]);
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: Signer[] | null) => {
      root.unmount();
      host.remove();
      resolve(v);
    };
    root.render(<Picker reportId={reportId} opts={opts} onDone={done} />);
  });
}

function Picker({ reportId, opts, onDone }: { reportId: string; opts: PickOptions; onDone: (v: Signer[] | null) => void }) {
  const [people, setPeople] = useState<Signatory[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // the report's own people + the active people of the list
  const options = useMemo<Option[]>(() => {
    const own = (opts.suggested || [])
      .filter((s) => s.title)
      .map((s) => ({ key: `report:${s.title}`, title: s.title, name: s.name, image: s.image, from: 'report' as const }));
    const list = (people || []).filter((p) => p.IS_ACTIVE).map((p) => ({ key: `list:${p.ID}`, title: p.TITLE, name: p.NAME, from: 'list' as const }));
    return [...own, ...list];
  }, [opts.suggested, people]);
  const byKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);

  useEffect(() => {
    loadSignatories()
      .then(setPeople)
      .catch((e: any) => {
        setPeople([]);
        setError(e?.message || 'Could not load the signatories');
      });
  }, []);

  // start from the last choice of this report; first time: the report's own people
  useEffect(() => {
    if (!people || ready) return;
    const last = readLast(reportId);
    const keys = new Set(options.map((o) => o.key));
    setChosen(last ? last.filter((k) => keys.has(k)) : options.filter((o) => o.from === 'report').map((o) => o.key));
    setReady(true);
  }, [people, ready, reportId, options]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDone]);

  const q = search.trim().toLowerCase();
  const available = options.filter((o) => !chosen.includes(o.key) && (!q || o.title.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)));
  const move = (i: number, d: -1 | 1) =>
    setChosen((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const confirm = () => {
    writeLast(reportId, chosen);
    onDone(chosen.map((k) => byKey.get(k)).filter(Boolean).map((o) => ({ title: o!.title, name: o!.name, image: o!.image || null })));
  };

  return (
    // always above the page's own windows (e.g. the notes window that starts the download)
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ zIndex: 2147483000 }} onClick={() => onDone(null)}>
      <div className="w-full max-w-4xl max-h-[88vh] bg-white rounded-3xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-black text-[#C4A052] flex items-center justify-center shrink-0">
              <PenLine className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 truncate">Signatures · {opts.title}</h3>
              <p className="text-xs font-semibold text-slate-400">Choose who signs and the order. Nobody chosen = no signatures on the PDF.</p>
            </div>
          </div>
          <button onClick={() => onDone(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Cancel">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-slate-100">
          {/* available */}
          <div className="p-5 flex flex-col min-h-0">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search position or name…" dir="auto" className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[200px]">
              {!people ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : (
                <>
                  {available.map((o) => (
                    <button key={o.key} type="button" onClick={() => setChosen((p) => [...p, o.key])} className="w-full px-3 py-2.5 rounded-xl border border-slate-100 hover:border-[#C4A052] hover:bg-[#C4A052]/5 flex items-center gap-3 text-left">
                      <Plus className="w-4 h-4 text-[#C4A052] shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-800 truncate" dir="auto">{o.title}</span>
                        <span className="block text-xs font-semibold text-slate-400 truncate" dir="auto">{o.name || '—'}</span>
                      </span>
                      {o.from === 'report' && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">This document</span>}
                    </button>
                  ))}
                  {!available.length && <p className="py-10 text-center text-xs font-semibold text-slate-400">{options.length ? 'Everyone is chosen' : 'No signatories yet'}</p>}
                  {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
                </>
              )}
            </div>
            <a href="/DataBase/Signatories" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-black">
              <ExternalLink className="w-3.5 h-3.5" /> Manage the list (Data Base → Signatories DB)
            </a>
          </div>

          {/* chosen, in order */}
          <div className="p-5 flex flex-col min-h-0 bg-slate-50/60">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">Signing order ({chosen.length})</p>
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[200px]">
              {chosen.map((k, i) => {
                const o = byKey.get(k);
                if (!o) return null;
                return (
                  <div key={k} className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-black text-[#C4A052] text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-slate-800 truncate" dir="auto">{o.title}</span>
                      <span className="block text-xs font-semibold text-slate-400 truncate" dir="auto">{o.name || '—'}</span>
                    </span>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 disabled:opacity-30" title="Up">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === chosen.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 disabled:opacity-30" title="Down">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setChosen((p) => p.filter((x) => x !== k))} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Remove">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {!chosen.length && <p className="py-10 text-center text-xs font-semibold text-slate-400">No signatures — the PDF will have no signature part.</p>}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
          {chosen.length > 0 && (
            <button type="button" onClick={() => setChosen([])} className="mr-auto h-11 px-4 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-700">
              Clear
            </button>
          )}
          <button type="button" onClick={() => onDone(null)} className="h-11 w-40 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={!ready} className="h-11 w-40 rounded-xl bg-black text-[#C4A052] text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40">
            <Check className="w-4 h-4" /> Make the PDF
          </button>
        </div>
      </div>
    </div>
  );
}
