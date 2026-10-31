import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Eye, EyeOff, UserRound } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { hotel } from '../config/hotel';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { BookingList } from '../components/BookingList';
import { frontendUrl } from '@hotel/api-client';

export function AccountPage() {
  const [params, setParams] = useSearchParams();
  const register = params.get('mode') === 'register';
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setNotice(null);
    try {
      await api(`/auth/${register ? 'register' : 'login'}`, {
        email: String(fields.get('email')).trim(), password: fields.get('password'),
        ...(register ? { fullName: fields.get('name') } : {}),
      });
      form.reset();
      await auth.refresh();
      const next = params.get('next');
      if (next && /^\/(stay(?:\?|$)|staff$)/.test(next)) navigate(next, { replace: true });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'We could not sign you in. Please try again.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setNotice(null);
    try { await auth.logout(); }
    catch { setNotice('Could not sign out. Please try again.'); }
    finally { setBusy(false); }
  }

  if (auth.loading) return <div className="container page-content"><p role="status">Checking your account…</p></div>;
  if (auth.user) return <div className="container page-content">
    <div className="workspace-heading"><div><p className="eyebrow">YOUR PRAMOD ACCOUNT</p><h1>Welcome, <em>{auth.user.fullName}.</em></h1><p>{auth.user.email}</p></div><button className="button secondary" disabled={busy} onClick={logout}>Sign out</button></div>
    {notice && <p className="form-error" role="alert">{notice}</p>}
    <div className="account-shortcuts"><Link className="button primary" to="/rooms">Find your next stay <ArrowUpRight size={17} /></Link><a className="text-link" href={frontendUrl(auth.memberships.some(item => item.role === 'owner') ? 'owner' : 'reception')}>{auth.memberships.some(item => item.role === 'owner') ? 'Open owner dashboard' : auth.memberships.length ? 'Open reception' : 'Hotel team access'} <ArrowUpRight size={17} /></a></div>
    <h2>Your <em>reservations.</em></h2><BookingList />
  </div>;

  return <div className="container account-page">
    <div className="account-story"><img src={hotel.heroImage} alt="Illustrative sunlit hotel pool" /><div><p className="eyebrow">YOUR PRAMOD EXPERIENCE</p><h1>A familiar face.<br />A warmer <em>welcome.</em></h1><p>One account for your stays.<br />A little more room to feel at home.</p><span><UserRound size={17} /> Every account starts as a guest.</span></div></div>
    <div className="account-form-panel"><p className="eyebrow">MAKE YOURSELF AT HOME</p><h2>{register ? 'Your next stay starts here.' : 'Lovely to see you again.'}</h2><p>{register ? 'Create a guest account to keep your stays in one place.' : 'Sign in to pick up where you left off.'}</p>
      <div className="form-tabs">{[false, true].map(mode => <button key={String(mode)} disabled={busy} className={register === mode ? 'active' : ''} aria-pressed={register === mode} onClick={() => { const next = new URLSearchParams(params); mode ? next.set('mode', 'register') : next.delete('mode'); setParams(next); setNotice(null); setShowPassword(false); }}>{mode ? 'Create account' : 'Sign in'}</button>)}</div>
      {auth.error && <p className="form-error" role="alert">{auth.error}</p>}
      <form key={register ? 'register' : 'login'} className="account-form" onSubmit={submit}>
        {register && <label>Full name<input name="name" autoComplete="name" placeholder="Your name" required minLength={2} maxLength={100} disabled={busy} /></label>}
        <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} disabled={busy} /></label>
        <label htmlFor="account-password">Password</label><div className="password-input"><input id="account-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 15 characters' : 'Your password'} required minLength={register ? 15 : 1} maxLength={128} disabled={busy} /><button type="button" className="icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        {register && <p className="fine-print">Use a passphrase of 15–128 characters. Staff access is granted separately by the hotel owner.</p>}
        <button type="submit" disabled={busy} className="button primary full-width">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <ArrowUpRight size={18} /></button>
        {notice && <p className="form-error" role="alert">{notice}</p>}
      </form><p className="account-footnote">Just looking around? <Link to="/rooms">Browse as a guest</Link></p><div className="staff-link-panel"><span>Part of the hotel team?</span><Link className="text-link" to="/staff">Staff & owner access <ArrowUpRight size={16} /></Link></div>
    </div>
  </div>;
}
