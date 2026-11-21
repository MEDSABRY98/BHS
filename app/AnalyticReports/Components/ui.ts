// Shared look (same tokens as Petty Cash)
export const TITLE = 'text-3xl sm:text-4xl font-normal text-black tracking-tighter';
export const CARD = 'bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden';
export const THEAD = 'bg-[#0a0f1d] text-[11px] font-black uppercase tracking-[0.15em] text-[#D4AF37] text-center';
export const TH = 'py-4 px-3 whitespace-nowrap';
export const TD = 'py-3 px-3 text-center text-sm tabular-nums border-b border-slate-50';
export const INPUT = 'h-11 px-3 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400/40 bg-white';
export const BTN = 'h-11 px-5 rounded-xl bg-[#0a0f1d] text-[#D4AF37] text-sm font-black tracking-wide hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2';
export const tone = (n: number) => (n < -0.5 ? 'text-red-600' : n > 0.5 ? 'text-emerald-700' : 'text-slate-400');
