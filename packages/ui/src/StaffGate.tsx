import { useState, type FormEvent, type ReactNode } from 'react';
import { api, frontendUrl, useAuth, useCatalog, type PropertyCatalog } from '@hotel/api-client';
import { ArrowUpRight, Hotel, LockKeyhole } from 'lucide-react';
import { JoinTeam } from './JoinTeam';

function SignIn({ owner, onRequestError }: { owner: boolean; onRequestError: (message: string | null) => void }) {
  const auth = useAuth();
  const catalog = useCatalog();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      await api(`/auth/${register ? 'register' : 'login'}`, { email: String(fields.get('email')).trim(), password: fields.get('password'), ...(register ? { fullName: fields.get('name') } : {}) });
      onRequestError(null);
      if (!owner && catalog.property) {
        try { await api(`/properties/${catalog.property.id}/staff/requests`, {}); }
        catch { onRequestError('You’re signed in, but we could not send your reception request. Please try again below.'); }
      }
      await auth.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  }
  return <div className="gate-page"><div className="gate-story"><a className="portal-wordmark" href={frontendUrl('guest')}>Pramod<span>A BOUTIQUE STAY</span></a><div><p className="eyebrow">{owner ? 'THE OWNER’S DESK' : 'A WARMER WELCOME'}</p><h1>{owner ? <>A clear view.<br />A considered <em>stay.</em></> : <>Every arrival.<br />A personal <em>welcome.</em></>}</h1><p>{owner ? 'Your hotel, at a glance. Keep an eye on your rooms, reservations, and the people who make it all happen.' : 'Everything your reception team needs to look after the next guest.'}</p></div><span><Hotel size={17} /> One hotel. One connected team.</span></div>
    <div className="gate-panel"><div className="gate-form"><span className="gate-icon"><LockKeyhole size={22} /></span><p className="eyebrow">{owner ? 'OWNER WORKSPACE' : 'RECEPTION WORKSPACE'}</p><h2>{register ? 'Create your account.' : 'Welcome back.'}</h2><p>{owner ? (register ? 'Create an account, then accept your hotel invitation.' : 'Sign in with the account connected to your hotel.') : 'Signing in sends your first reception access request to the owner. Already approved? Your workspace opens straight away.'}</p><div className="form-tabs"><button aria-pressed={!register} className={!register ? 'active' : ''} disabled={busy} onClick={() => { setRegister(false); setError(null); }}>Sign in</button><button aria-pressed={register} className={register ? 'active' : ''} disabled={busy} onClick={() => { setRegister(true); setError(null); }}>Create account</button></div>
      <form className="account-form" onSubmit={submit} key={String(register)}>{register && <label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={100} disabled={busy} /></label>}<label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 15 : 1} maxLength={128} disabled={busy} placeholder={register ? 'At least 15 characters' : 'Your password'} /></label>{register && <p className="fine-print">Every account starts as a guest. Hotel access is granted separately.</p>}<button className="button primary full-width" disabled={busy || (!owner && (!catalog.property || !!catalog.error))}>{busy ? 'Please wait…' : owner ? (register ? 'Create account' : 'Sign in') : (register ? 'Create account & request access' : 'Sign in to reception')}<ArrowUpRight size={17} /></button></form>
      {!owner && catalog.error && <p className="form-error" role="alert">{catalog.error} <button className="text-link" onClick={catalog.retry}>Retry hotel</button></p>}{!owner && catalog.loading && <p role="status">Loading the hotel…</p>}{(error || auth.error) && <p className="form-error" role="alert">{error || auth.error}</p>}<div className="preview-entry"><a className="text-link" href="/preview/">Explore the {owner ? 'owner' : 'reception'} preview <ArrowUpRight size={15} /></a><p>Take a look around with sample data. No account needed.</p></div><a className="text-link gate-back" href={frontendUrl('guest')}>Back to the guest website <ArrowUpRight size={15} /></a>
    </div></div></div>;
}

export function StaffGate({ owner = false, children }: { owner?: boolean; children: (property: PropertyCatalog) => ReactNode }) {
  const auth = useAuth(); const catalog = useCatalog();
  const [requestError, setRequestError] = useState<string | null>(null);
  if (auth.loading) return <main className="access-page"><p role="status">Checking your account…</p></main>;
  if (!auth.user) return <SignIn owner={owner} onRequestError={setRequestError} />;
  if (catalog.loading || !catalog.property || catalog.error) return <main className="access-page">{catalog.error ? <><p className="form-error" role="alert">{catalog.error}</p><button className="button secondary" onClick={catalog.retry}>Retry</button></> : <p role="status">Loading the hotel…</p>}</main>;
  const membership = auth.memberships.find(item => item.propertyId === catalog.property!.id);
  if (!membership || (owner && membership.role !== 'owner')) return <JoinTeam key={auth.user.id} propertyId={catalog.property.id} owner={owner} requestError={requestError} />;
  return <>{children(catalog.property)}</>;
}
