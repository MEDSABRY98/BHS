'use client';

// Vehicle Expenses: download the Excel template (vehicle, driver, fuel, maintenance), upload the filled file,
// download the analysis PDF and save it to the archive (DATA = { FILE_NAME, LINES }).

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Car, FileDown, FileSpreadsheet, FileText, Loader2, Upload, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import FormShell from '../Shared/FormShell';
import { uaeToday } from '../Shared/FormsUtils';
import type { FormEditorContext } from '../Shared/FormsArchiveTypes';
import { GroupByVehicle, Totals, formatAmount, type VehicleExpenseLine } from './VehicleExpensesTypes';

const FORM_ID = 'vehicle-expenses';

type VehicleExpensesData = { FILE_NAME: string; LINES: VehicleExpenseLine[] };

export default function VehicleExpensesFormPage() {
  return (
    <FormShell<VehicleExpensesData>
      formId={FORM_ID}
      title="Vehicle Expenses"
      icon={Car}
      renderNew={(ctx) => <VehicleExpensesTool ctx={ctx} />}
      onDownload={async (r) => {
        const { exportVehicleExpensesPdf } = await import('./VehicleExpensesPdf');
        await exportVehicleExpensesPdf(r.DATA.LINES || []);
      }}
    />
  );
}

const CARD = 'bg-white rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]';

function VehicleExpensesTool({ ctx }: { ctx: FormEditorContext<VehicleExpensesData> }) {
  const init = ctx.editing?.DATA;
  const [lines, setLines] = useState<VehicleExpenseLine[] | null>(init?.LINES?.length ? init.LINES : null);
  const [fileName, setFileName] = useState(init?.FILE_NAME || '');
  const [busy, setBusy] = useState<'template' | 'upload' | 'pdf' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      const { downloadVehicleExpensesTemplate } = await import('./VehicleExpensesExcel');
      await downloadVehicleExpensesTemplate();
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the template');
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    try {
      const { readVehicleExpensesFile } = await import('./VehicleExpensesExcel');
      const parsed = await readVehicleExpensesFile(file);
      const list = parsed.lines.map(({ ROW: _row, ...l }) => l);
      setLines(list);
      setFileName(file.name);
      if (!list.length) toast.warning('No valid lines in this file');
      else toast.success(`${list.length} line${list.length === 1 ? '' : 's'} loaded`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not read the file');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadPdf = async () => {
    if (!lines?.length) return;
    setBusy('pdf');
    try {
      const { exportVehicleExpensesPdf } = await import('./VehicleExpensesPdf');
      await exportVehicleExpensesPdf(lines);
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the PDF');
    } finally {
      setBusy(null);
    }
  };

  const clear = () => {
    setLines(null);
    setFileName('');
  };

  // Save (shell header button)
  useEffect(() => {
    ctx.registerSave(() => {
      if (!lines?.length) {
        toast.error('Upload the Excel file first');
        return null;
      }
      const t = Totals(lines);
      return {
        TITLE: `${fileName.replace(/\.xlsx$/i, '') || 'Vehicle Expenses'} · ${GroupByVehicle(lines).length} vehicles`,
        DOC_DATE: ctx.editing?.DOC_DATE || uaeToday(),
        AMOUNT: t.total,
        DATA: { FILE_NAME: fileName, LINES: lines },
      };
    });
  });

  const totals = Totals(lines || []);
  const vehicleCount = GroupByVehicle(lines || []).length;
  const noDriver = (lines || []).filter((l) => !l.DRIVER).length;
  const hasLines = !!lines?.length;

  const step = (n: number, title: string, icon: React.ReactNode, button: React.ReactNode, disabled = false) => (
    <div className={`${CARD} p-6 flex flex-col gap-4 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-[#0a0f1d] text-[#D4AF37] flex items-center justify-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Step {n}</p>
          <p className="text-base font-black text-slate-900">{title}</p>
        </div>
      </div>
      <div className="flex-1" />
      {button}
    </div>
  );

  const btn =
    'h-11 w-full rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {step(
          1,
          'Excel Template',
          <FileSpreadsheet className="w-5 h-5" />,
          <button type="button" onClick={downloadTemplate} disabled={!!busy} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            {busy === 'template' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download Template
          </button>,
        )}
        {step(
          2,
          'Upload Excel',
          <Upload className="w-5 h-5" />,
          <>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className={`${btn} bg-[#0a0f1d] text-[#D4AF37] hover:shadow-lg`}>
              {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {hasLines ? 'Upload Another File' : 'Upload Excel'}
            </button>
          </>,
        )}
        {step(
          3,
          'Analysis PDF',
          <FileText className="w-5 h-5" />,
          <button
            type="button"
            onClick={downloadPdf}
            disabled={!hasLines || !!busy}
            className={`${btn} bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-lg shadow-[#D4AF37]/25 hover:shadow-xl`}
          >
            {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
          </button>,
          !hasLines,
        )}
      </div>

      {lines && (
        <div className={`${CARD} p-6 space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-sm font-black text-slate-900 truncate">{fileName}</p>
            </div>
            <button type="button" onClick={clear} className="w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center" title="Clear">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Vehicles', value: String(vehicleCount) },
              { label: 'Fuel', value: formatAmount(totals.fuel), cls: 'text-amber-700' },
              { label: 'Maintenance', value: formatAmount(totals.maintenance), cls: 'text-[#182E56]' },
              { label: 'Total', value: formatAmount(totals.total) },
            ].map((c) => (
              <div key={c.label} className="p-3 rounded-2xl bg-slate-50 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{c.label}</p>
                <p className={`text-sm font-black mt-1 ${c.cls || 'text-slate-900'}`}>{c.value}</p>
              </div>
            ))}
          </div>
          {noDriver > 0 && (
            <p className="text-xs font-bold text-amber-700">
              {noDriver} line{noDriver === 1 ? '' : 's'} without a driver name.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
