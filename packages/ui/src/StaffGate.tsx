import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, frontendUrl, useAuth, useCatalog, type PropertyCatalog } from '@hotel/api-client';
import { ArrowUpRight, Hotel, LockKeyhole } from 'lucide-react';

function SignIn({ owner }: { owner: boolean }) {
  const auth = useAuth();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      await api(`/auth/${register ? 'register' : 'login'}`, { email: String(fields.get('email')).trim(), password: fields.get('password'), ...(register ? { fullName: fields.get('name') } : {}) });
      await auth.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  }
  return <div className="gate-page"><div className="gate-story"><a className="portal-wordmark" href={frontendUrl('guest')}>Pramod<span>A BOUTIQUE STAY</span></a><div><p className="eyebrow">{owner ? 'THE OWNER’S DESK' : 'A WARMER WELCOME'}</p><h1>{owner ? <>A clear view.<br />A considered <em>stay.</em></> : <>Every arrival.<br />A personal <em>welcome.</em></>}</h1><p>{owner ? 'Your hotel, at a glance. Keep an eye on your rooms, reservations, and the people who make it all happen.' : 'Everything your reception team needs to look after the next guest.'}</p></div><span><Hotel size={17} /> One hotel. One connected team.</span></div>
    <div className="gate-panel"><div className="gate-form"><span className="gate-icon"><LockKeyhole size={22} /></span><p className="eyebrow">{owner ? 'OWNER WORKSPACE' : 'RECEPTION WORKSPACE'}</p><h2>{register ? 'Create your account.' : 'Welcome back.'}</h2><p>{register ? 'Create an account, then accept your hotel invitation.' : 'Sign in with the account connected to your hotel.'}</p><div className="form-tabs"><button aria-pressed={!register} className={!register ? 'active' : ''} disabled={busy} onClick={() => { setRegister(false); setError(null); }}>Sign in</button><button aria-pressed={register} className={register ? 'active' : ''} disabled={busy} onClick={() => { setRegister(true); setError(null); }}>Create account</button></div>
      <form className="account-form" onSubmit={submit} key={String(register)}>{register && <label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={100} disabled={busy} /></label>}<label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 15 : 1} maxLength={128} disabled={busy} placeholder={register ? 'At least 15 characters' : 'Your password'} /></label>{register && <p className="fine-print">Every account starts as a guest. Hotel access is granted separately.</p>}<button className="button primary full-width" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}<ArrowUpRight size={17} /></button></form>
      {(error || auth.error) && <p className="form-error" role="alert">{error || auth.error}</p>}<div className="preview-entry"><a className="text-link" href="/preview/">Explore the {owner ? 'owner' : 'reception'} preview <ArrowUpRight size={15} /></a><p>Take a look around with sample data. No account needed.</p></div><a className="text-link gate-back" href={frontendUrl('guest')}>Back to the guest website <ArrowUpRight size={15} /></a>
    </div></div></div>;
}

function JoinTeam({ propertyId, owner }: { propertyId: string; owner: boolean }) {
  const auth = useAuth();
  const [mode, setMode] = useState<'invitation' | 'request'>('invitation');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<{ request: { status: string } | null }>(`/properties/${propertyId}/staff/access`, undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) { setStatus(data.request?.status ?? null); setError(null); } })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [propertyId, version]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    setBusy(true); setError(null); setMessage(null);
    try {
      await api(`/properties/${propertyId}/staff/${mode === 'invitation' ? 'invitations/accept' : 'requests'}`, mode === 'invitation' ? { code: String(fields.get('code')).trim() } : { introduction: fields.get('introduction') });
      form.reset(); setMessage(mode === 'invitation' ? 'Invitation accepted. Access follows the role on your invitation.' : 'Your request is waiting for owner approval.');
      setVersion(value => value + 1); await auth.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not complete this request.'); }
    finally { setBusy(false); }
  }
  return <main className="access-page"><a className="portal-wordmark" href={frontendUrl('guest')}>Pramod<span>A BOUTIQUE STAY</span></a><div className="access-card"><span className="gate-icon"><LockKeyhole size={22} /></span><p className="eyebrow">HOTEL ACCESS</p><h1>{owner ? 'Owner access required.' : 'Join the hotel team.'}</h1><p>You’re signed in as <strong>{auth.user?.email}</strong>.</p><p>{owner ? 'Accept an owner invitation to open this dashboard. Reception access does not grant owner permissions.' : 'Accept an invitation or ask the owner to approve your reception access.'}</p>
    {!owner && <div className="form-tabs"><button className={mode === 'invitation' ? 'active' : ''} onClick={() => setMode('invitation')}>Have an invitation?</button><button className={mode === 'request' ? 'active' : ''} onClick={() => setMode('request')}>Request reception access</button></div>}
    {!owner && status && <p className="notice">Latest request: {status}.</p>}
    <form className="account-form" onSubmit={submit} key={mode}>{mode === 'invitation' ? <label>Invitation code<input name="code" required minLength={64} maxLength={64} autoComplete="off" disabled={busy} /></label> : <label>A short introduction<textarea name="introduction" required minLength={10} maxLength={500} rows={4} disabled={busy || status === 'pending'} /></label>}<button className="button primary" disabled={busy || (mode === 'request' && status === 'pending')}>{busy ? 'Please wait…' : mode === 'invitation' ? 'Accept invitation' : 'Request access'}</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <div className="access-actions"><button className="text-link" disabled={busy} onClick={() => { setVersion(value => value + 1); void auth.refresh(); }}>Refresh access</button><button className="text-link" disabled={busy} onClick={async () => { try { await auth.logout(); } catch { setError('Could not sign out. Please try again.'); } }}>Sign out</button>{owner && <a className="text-link" href={frontendUrl('reception')}>Open reception</a>}</div><div className="quiet-note"><strong>Setting up Pramod?</strong><p>The first owner is assigned by the person setting up the hotel. Further owners join by invitation.</p></div>
  </div></main>;
}

export function StaffGate({ owner = false, children }: { owner?: boolean; children: (property: PropertyCatalog) => ReactNode }) {
  const auth = useAuth(); const catalog = useCatalog();
  if (auth.loading) return <main className="access-page"><p role="status">Checking your account…</p></main>;
  if (!auth.user) return <SignIn owner={owner} />;
  if (catalog.loading || !catalog.property || catalog.error) return <main className="access-page">{catalog.error ? <><p className="form-error" role="alert">{catalog.error}</p><button className="button secondary" onClick={catalog.retry}>Retry</button></> : <p role="status">Loading the hotel…</p>}</main>;
  const membership = auth.memberships.find(item => item.propertyId === catalog.property!.id);
  if (!membership || (owner && membership.role !== 'owner')) return <JoinTeam key={auth.user.id} propertyId={catalog.property.id} owner={owner} />;
  return <>{children(catalog.property)}</>;
}
