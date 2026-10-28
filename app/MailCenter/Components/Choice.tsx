'use client';

/** small segmented buttons, all the same width (full = stretch across the whole row) */
export default function Choice<T extends string>({
  value,
  options,
  onChange,
  width = 'w-36',
  full = false,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  width?: string;
  full?: boolean;
}) {
  return (
    <div className={`${full ? 'flex w-full' : 'inline-flex flex-wrap'} gap-1 p-1 rounded-xl bg-slate-100`}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`h-8 ${full ? 'flex-1 min-w-0' : width} px-2 rounded-lg text-xs font-black whitespace-nowrap transition-all ${value === o.id ? 'bg-black text-[#C4A052] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
