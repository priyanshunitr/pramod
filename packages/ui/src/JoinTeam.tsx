import { useEffect, useState, type FormEvent } from 'react';
import { api, frontendUrl, useAuth } from '@hotel/api-client';
import type { StaffAccess } from '@hotel/contracts';
import { Check, Clock3, LockKeyhole } from 'lucide-react';
import { pollStaff } from './pollStaff';

export function JoinTeam({ propertyId, owner, requestError }: { propertyId: string; owner: boolean; requestError: string | null }) {
  const auth = useAuth();
  const [mode, setMode] = useState<'invitation' | 'request'>(owner ? 'invitation' : 'request');
  const [access, setAccess] = useState<StaffAccess | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(requestError);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const base = `/properties/${propertyId}/staff`;
  useEffect(() => {
    if (busy) return;
    return pollStaff(async signal => {
      try {
        const data = await api<StaffAccess>(`${base}/access`, undefined, signal);
        if (signal.aborted) return;
        setAccess(data); setLoadError(null);
        if (data.role && (!owner || data.role === 'owner')) await auth.refresh();
      } catch (cause) { if (!signal.aborted) setLoadError(cause instanceof Error ? cause.message : 'Could not check access.'); }
    });
  }, [base, owner, auth.refresh, version, busy]);
  const pending = access?.request?.status === 'pending';
  const declined = access?.request?.status === 'rejected';
  const removed = !pending && (access?.accessRevoked || access?.request?.status === 'approved');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      if (mode === 'invitation') {
        await api(`${base}/invitations/accept`, { code: String(fields.get('code')).trim() });
        await auth.refresh();
      } else {
        const introduction = String(fields.get('introduction') ?? '').trim();
        const data = await api<StaffAccess>(`${base}/requests`, { ...(introduction ? { introduction } : {}), resubmit: Boolean(declined || removed) });
        setAccess(data);
        if (data.role) await auth.refresh();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not complete this request.'); }
    finally { setBusy(false); }
  }
  return <main className="access-page"><a className="portal-wordmark" href={frontendUrl('guest')}>Pramod<span>A BOUTIQUE STAY</span></a>
    <div className="access-card"><span className="gate-icon">{pending && !owner ? <Clock3 size={22} /> : <LockKeyhole size={22} />}</span><p className="eyebrow">{owner ? 'OWNER WORKSPACE' : 'JOIN THE RECEPTION TEAM'}</p>
      <h1>{owner ? 'Owner access required.' : pending ? 'Over to the owner.' : declined ? 'Your request was declined.' : removed ? 'Your access has ended.' : 'A welcome starts here.'}</h1>
      <p>You’re signed in as <strong>{auth.user?.email}</strong>.</p>
      {owner ? <p>Accept an owner invitation to open this dashboard. Reception access does not grant owner permissions.</p> : <>
        <ol className="approval-steps" aria-label="Reception access steps">
          <li className="complete"><span><Check size={14} /></span><div><strong>Sign in</strong><small>Your account is ready.</small></div></li>
          <li className={pending ? 'current' : ''}><span>2</span><div><strong>Owner approval</strong><small>{pending ? 'Request sent. Waiting for review.' : 'The owner reviews your request.'}</small></div></li>
          <li><span>3</span><div><strong>Open reception</strong><small>Manage stays and room readiness.</small></div></li>
        </ol>
        {pending ? <div className="approval-notice" role="status"><strong>Your request is with the owner.</strong><p>It’s in their reception requests. This page checks every few seconds and opens your workspace as soon as they approve.</p>{access?.request && <small>Requested {new Date(access.request.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small>}</div>
          : <p>{declined ? 'You still have your guest account. Speak with the owner, then send a new request if needed.' : removed ? 'Reception tools are no longer available. You can ask the owner to approve access again.' : 'Send a reception request. The owner must approve it before you can access hotel operations.'}</p>}
        <div className="form-tabs"><button aria-pressed={mode === 'request'} disabled={busy} className={mode === 'request' ? 'active' : ''} onClick={() => setMode('request')}>{pending ? 'Request status' : 'Request access'}</button><button aria-pressed={mode === 'invitation'} disabled={busy} className={mode === 'invitation' ? 'active' : ''} onClick={() => setMode('invitation')}>Have an invitation?</button></div>
      </>}
      {!access && !loadError && <p role="status">Checking your access…</p>}
      {(mode === 'invitation' || !pending) && <form className="account-form" onSubmit={submit} key={mode}>
        {mode === 'invitation' ? <label>Invitation code<input name="code" required minLength={64} maxLength={64} autoComplete="off" disabled={busy} /></label> : <label>A note for the owner <span className="fine-print">(optional)</span><textarea name="introduction" minLength={10} maxLength={500} rows={3} disabled={busy} placeholder="Let the owner know who you are and when you’re joining." /></label>}
        <button className="button primary full-width" disabled={busy || !access || !!loadError}>{busy ? 'Please wait…' : mode === 'invitation' ? 'Accept invitation' : declined || removed ? 'Send a new request' : 'Request reception access'}</button>
      </form>}
      {(error || loadError) && <p className="form-error" role="alert">{error || loadError}</p>}
      <div className="access-actions"><button className="text-link" disabled={busy} onClick={() => setVersion(value => value + 1)}>Check access now</button><button className="text-link" disabled={busy} onClick={async () => { try { await auth.logout(); } catch { setError('Could not sign out. Please try again.'); } }}>Sign out</button>{owner && <a className="text-link" href={frontendUrl('reception')}>Open reception</a>}</div>
      {owner && <div className="quiet-note"><strong>Setting up Pramod?</strong><p>The first owner is assigned by the person setting up the hotel. Further owners join by invitation.</p></div>}
    </div>
  </main>;
}
