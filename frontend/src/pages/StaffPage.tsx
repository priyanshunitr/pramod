import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { CatalogFeedback } from '../components/CatalogFeedback';
import { BookingList } from '../components/BookingList';
import { TeamPanel } from '../components/TeamPanel';
import { HousekeepingPanel } from '../components/HousekeepingPanel';
import { api } from '../lib/api';

interface Access { role: 'owner' | 'receptionist' | null; request: { id: string; status: string } | null; }

function StaffAccess({ propertyId }: { propertyId: string }) {
  const auth = useAuth();
  const [access, setAccess] = useState<Access | null>(null);
  const [mode, setMode] = useState<'request' | 'invitation'>('request');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const base = `/properties/${propertyId}/staff`;
  useEffect(() => {
    const controller = new AbortController();
    api<Access>(`${base}/access`, undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setAccess(data); setError(null); } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not check your access.'); });
    return () => controller.abort();
  }, [base, version]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    setBusy(true); setError(null); setMessage(null);
    try {
      await api(`${base}/${mode === 'request' ? 'requests' : 'invitations/accept'}`, mode === 'request' ? { introduction: fields.get('introduction') } : { code: String(fields.get('invitation')).trim() });
      form.reset(); setMessage(mode === 'request' ? 'Your request is with the owner. Staff access becomes available after approval.' : 'Invitation accepted. Your hotel access is ready.');
      setVersion(value => value + 1); await auth.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not complete your request.'); }
    finally { setBusy(false); }
  }
  if (!access) return <>{error ? <p className="form-error" role="alert">{error}</p> : <p role="status">Checking hotel access…</p>}<button className="text-link" onClick={() => setVersion(value => value + 1)}>Retry</button></>;
  if (access.role) return <div className="hotel-workspace"><div className="workspace-toolbar"><span className="status-badge confirmed">{access.role === 'owner' ? 'Owner workspace' : 'Reception workspace'}</span><button className="text-link" onClick={() => { setVersion(value => value + 1); void auth.refresh(); }}>Refresh access</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <h2>Guest <em>reservations.</em></h2><BookingList propertyId={propertyId} />
    <HousekeepingPanel propertyId={propertyId} />
    {access.role === 'owner' && <TeamPanel propertyId={propertyId} onChange={() => { setVersion(value => value + 1); void auth.refresh(); }} />}
  </div>;
  return <div className="staff-layout"><div className="access-steps">
    <article><div><p className="eyebrow">01 · YOUR ACCOUNT</p><h3>One account for every stay.</h3><p>You’re signed in as {auth.user?.email}. Hotel permissions are added to this account.</p></div></article>
    <article><div><p className="eyebrow">02 · OWNER APPROVAL</p><h3>A trusted hotel team.</h3><p>Receptionists request access or accept an invitation. Owners join by invitation from an existing owner.</p></div></article>
    <article><div><p className="eyebrow">03 · YOUR WORKSPACE</p><h3>Ready for your next guest.</h3><p>Approved staff can manage this hotel’s reservations, check-ins, check-outs, and room readiness.</p></div></article>
  </div><div className="staff-form-card"><h2>Join the <em>team.</em></h2>
    <div className="form-tabs"><button disabled={busy} className={mode === 'request' ? 'active' : ''} onClick={() => { setMode('request'); setError(null); }}>Receptionist request</button><button disabled={busy} className={mode === 'invitation' ? 'active' : ''} onClick={() => { setMode('invitation'); setError(null); }}>Have an invitation?</button></div>
    {access.request && <p className="notice" role="status">Latest request: {access.request.status}. <button className="text-link" onClick={() => setVersion(value => value + 1)}>Refresh status</button></p>}
    <form key={mode} className="account-form" onSubmit={submit}>{mode === 'request' ? <label>A short introduction<textarea name="introduction" rows={4} placeholder="Tell the owner how you’re connected to the hotel." required minLength={10} maxLength={500} disabled={busy || access.request?.status === 'pending'} /></label> : <label>Invitation code<input name="invitation" placeholder="Code from the hotel owner" required minLength={64} maxLength={64} autoComplete="off" disabled={busy} /></label>}
      <button className="button primary full-width" disabled={busy || (mode === 'request' && access.request?.status === 'pending')}>{busy ? 'Please wait…' : mode === 'request' ? 'Request receptionist access' : 'Accept invitation'}</button>
    </form>{message && <p className="notice" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <div className="quiet-note"><strong>Setting up the hotel?</strong><p>The first owner is assigned by the person setting up the hotel. Further owners need an invitation.</p></div>
  </div></div>;
}

export function StaffPage() {
  const auth = useAuth(); const catalog = useCatalog();
  return <div className="container page-content"><div className="page-heading"><p className="eyebrow">BEHIND EVERY LOVELY STAY</p><h1>One team.<br />A shared <em>welcome.</em></h1><p>Manage the guest experience with access approved for this hotel.</p></div>
    {auth.loading ? <p role="status">Checking your account…</p> : !auth.user ? <div className="empty-state"><h2>Start with your account.</h2><p>Sign in to request hotel access or accept an invitation.</p><Link className="button primary" to="/account?next=%2Fstaff">Sign in to continue</Link></div> : catalog.loading || catalog.error ? <CatalogFeedback /> : catalog.property && <StaffAccess key={auth.user.id} propertyId={catalog.property.id} />}
  </div>;
}
