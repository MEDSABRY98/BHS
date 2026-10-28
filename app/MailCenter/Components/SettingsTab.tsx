'use client';

// Admin: connect the finance mailbox (Zoho Mail API, Self Client code).

import { useState } from 'react';
import { CheckCircle2, Link2, Loader2, Unlink } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import Modal from './Modal';
import { connectMail, disconnectMail } from '../Service/MailService';
import { unwrap, type MailStatus } from '../Utils/MailTypes';

export default function SettingsTab({ status, onChange }: { status: MailStatus | null; onChange: (s: MailStatus) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const s = unwrap(await connectMail(code));
      onChange(s);
      setCode('');
      toast.success(`Connected as ${s.from}`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not connect');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      onChange(unwrap(await disconnectMail()));
      setConfirmOff(false);
      toast.success('Disconnected');
    } catch (e: any) {
      toast.error(e?.message || 'Could not disconnect');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sending Mailbox</p>
            <p className="text-lg font-black text-slate-900 mt-1">{status?.connected ? status.from : 'Not connected'}</p>
          </div>
          {status?.connected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black">
              <CheckCircle2 className="w-4 h-4" /> Connected
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-black">Not connected</span>
          )}
        </div>
        {status?.problem && <p className="rounded-xl bg-red-50 text-red-700 text-sm font-semibold px-4 py-3">{status.problem}</p>}
        {status?.connected && (
          <button onClick={() => setConfirmOff(true)} disabled={busy} className="h-10 px-4 rounded-xl border border-red-200 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5">
            <Unlink className="w-4 h-4" /> Disconnect
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="font-black text-slate-900">{status?.connected ? 'Connect another mailbox' : 'Connect the finance mailbox'}</p>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-600">
          <li>
            Sign in to <b>api-console.zoho.com</b> with the finance account (finance@swiftline.ae).
          </li>
          <li>
            Open <b>Self Client</b> → <b>Generate Code</b>.
          </li>
          <li>
            Scope: <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-bold">{status?.scopes || 'ZohoMail.messages.CREATE,ZohoMail.accounts.READ'}</code> · Time: 10 minutes.
          </li>
          <li>Copy the code, paste it here and press Connect.</li>
        </ol>
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="1000.xxxxxxxx.xxxxxxxx  (or paste the whole downloaded JSON)" className="flex-1 h-11 px-4 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
          <button onClick={() => void connect()} disabled={busy || !code.trim() || !status?.clientReady} className="h-11 px-6 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Connect
          </button>
        </div>
        <p className="text-xs font-semibold text-slate-400">The Self Client must belong to the same Zoho account as the mailbox — its Client ID / Secret go in MAIL_ZOHO_CLIENT_ID / MAIL_ZOHO_CLIENT_SECRET.</p>
      </div>

      <Modal
        open={confirmOff}
        title="Disconnect the mailbox?"
        width="max-w-md"
        onClose={() => !busy && setConfirmOff(false)}
        footer={
          <>
            <button onClick={() => setConfirmOff(false)} disabled={busy} className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => void disconnect()} disabled={busy} className="h-11 px-6 rounded-xl bg-red-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Disconnect
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-500">Nobody can send from Mail Center until it is connected again.</p>
      </Modal>
    </div>
  );
}
