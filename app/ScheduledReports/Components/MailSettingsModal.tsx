'use client';

// Scheduled Reports → ✉ Email: connect the company Zoho Mail (Zoho Mail API).

import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Mail, Unplug, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { connectZohoMail, disconnectZohoMail, getMailSettings, type MailSettings } from '../Service/ScheduledReportsService';

export default function MailSettingsModal({ canEdit, onClose, onChanged }: { canEdit: boolean; onClose: () => void; onChanged: (from: string | null) => void }) {
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMailSettings()
      .then(setSettings)
      .catch((err: any) => toast.error(err?.message || 'Could not load the email settings'));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const connect = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      const s = await connectZohoMail(code);
      setSettings(s);
      setCode('');
      onChanged(s.from);
      toast.success(`Zoho Mail connected — reports will be sent from ${s.from}`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not connect');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const s = await disconnectZohoMail();
      setSettings(s);
      onChanged(s.from);
      toast.success('Zoho Mail disconnected');
    } catch (err: any) {
      toast.error(err?.message || 'Could not disconnect');
    } finally {
      setBusy(false);
    }
  };

  const consoleUrl = settings ? `https://api-console.zoho.${settings.zohoDc}` : 'https://api-console.zoho.com';
  const step = 'w-6 h-6 rounded-full bg-[#0a0f1d] text-[#D4AF37] text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5';

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/50 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center shadow-lg shadow-[#D4AF37]/30">
              <Mail className="w-5 h-5" />
            </span>
            <div>
              <p className="text-lg font-black text-slate-900">Email</p>
              <p className="text-[11px] font-bold text-slate-400">The mailbox the reports are sent from</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {!settings ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${settings.provider ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                {settings.provider ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <Mail className="w-5 h-5 text-slate-400 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900 truncate">{settings.from || 'Not connected'}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    {settings.provider === 'zoho'
                      ? `Zoho Mail${settings.zohoConnectedBy ? ` · connected by ${settings.zohoConnectedBy}` : ''}`
                      : settings.provider === 'smtp'
                        ? 'SMTP (Vercel settings)'
                        : 'Connect Zoho Mail below'}
                  </p>
                </div>
                {settings.zohoConnected && canEdit && (
                  <button
                    type="button"
                    onClick={disconnect}
                    disabled={busy}
                    title="Disconnect Zoho Mail"
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center disabled:opacity-50"
                  >
                    <Unplug className="w-4 h-4" />
                  </button>
                )}
              </div>

              {canEdit && (
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">{settings.zohoConnected ? 'Connect again' : 'Connect Zoho Mail'}</p>

                  <div className="flex gap-3">
                    <span className={step}>1</span>
                    <p className="text-sm font-semibold text-slate-600">
                      {settings.zohoClientReady ? (
                        <>
                          <span className="font-black text-emerald-600">Done:</span> ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET are set in Vercel.
                        </>
                      ) : (
                        <>
                          In{' '}
                          <a href={consoleUrl} target="_blank" rel="noreferrer" className="font-bold text-amber-700 underline inline-flex items-center gap-0.5">
                            Zoho API Console <ExternalLink className="w-3 h-3" />
                          </a>{' '}
                          create a <b>Self Client</b>, put its Client ID / Secret in Vercel as <b>ZOHO_CLIENT_ID</b> and <b>ZOHO_CLIENT_SECRET</b>, then redeploy.
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <span className={step}>2</span>
                    <div className="text-sm font-semibold text-slate-600 min-w-0">
                      In the Self Client → <b>Generate Code</b>, paste this scope, pick 10 minutes, and create:
                      <code
                        className="mt-1.5 block px-3 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-800 break-all cursor-pointer select-all"
                        onClick={() => {
                          void navigator.clipboard?.writeText(settings.zohoScopes);
                          toast.success('Scope copied');
                        }}
                        title="Click to copy"
                      >
                        {settings.zohoScopes}
                      </code>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className={step}>3</span>
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-sm font-semibold text-slate-600">Paste the code here and connect (within 10 minutes):</p>
                      <div className="flex gap-2">
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && void connect()}
                          placeholder="1000.xxxxxxxx.xxxxxxxx"
                          disabled={!settings.zohoClientReady || busy}
                          className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15 disabled:bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={connect}
                          disabled={!settings.zohoClientReady || !code.trim() || busy}
                          className="h-11 px-4 rounded-xl bg-[#0a0f1d] text-[#D4AF37] text-sm font-black inline-flex items-center gap-2 disabled:opacity-40 shrink-0"
                        >
                          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Connect
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
