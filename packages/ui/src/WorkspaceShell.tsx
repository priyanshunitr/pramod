import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { ArrowUpRight, BedDouble, CalendarDays, LayoutDashboard, LogOut, Sparkles, UsersRound } from 'lucide-react';
import { frontendUrl, useAuth } from '@hotel/api-client';

export function WorkspaceShell({ owner = false, children }: { owner?: boolean; children: ReactNode }) {
  const auth = useAuth(); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); document.getElementById('workspace-main')?.focus({ preventScroll: true }); }, [pathname]);
  const links = owner ? [
    { path: '/', title: 'Overview', Icon: LayoutDashboard }, { path: '/availability', title: 'Room availability', Icon: BedDouble },
    { path: '/reservations', title: 'Reservations', Icon: CalendarDays }, { path: '/readiness', title: 'Room readiness', Icon: Sparkles }, { path: '/team', title: 'Hotel team', Icon: UsersRound },
  ] : [{ path: '/', title: 'Reservations', Icon: CalendarDays }, { path: '/readiness', title: 'Room readiness', Icon: Sparkles }];
  async function logout() { setBusy(true); try { await auth.logout(); } catch { setError('Could not sign out. Try again.'); } finally { setBusy(false); } }
  return <div className="portal-layout"><a className="skip-link" href="#workspace-main">Skip to content</a><aside className="portal-sidebar"><NavLink to="/" className="portal-wordmark">Pramod<span>A BOUTIQUE STAY</span></NavLink><div className="property-chip"><span className="property-monogram">P</span><div><strong>Pramod</strong><small>{owner ? 'Owner workspace' : 'Reception workspace'}</small></div><span className="live-dot" /></div><p className="nav-caption">YOUR HOTEL</p><nav aria-label="Workspace navigation">{links.map(({ path, title, Icon }) => <NavLink key={path} to={path} end><Icon size={18} /><span>{title}</span></NavLink>)}</nav><div className="sidebar-bottom"><a href={frontendUrl('guest')}>Guest website <ArrowUpRight size={16} /></a><a href={frontendUrl(owner ? 'reception' : 'owner')}>{owner ? 'Reception workspace' : 'Owner workspace'} <ArrowUpRight size={16} /></a><div className="sidebar-account"><span className="account-avatar">{auth.user?.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{auth.user?.fullName}</strong><small>{owner ? 'Hotel owner' : 'Hotel team'}</small></div><button className="icon-button" aria-label="Sign out" onClick={logout} disabled={busy}><LogOut size={17} /></button></div>{error && <p role="alert">{error}</p>}</div></aside><div className="portal-body"><header className="portal-topbar"><span>Pramod <span className="breadcrumb-slash">/</span> {owner ? 'Owner workspace' : 'Reception workspace'}</span><span className="access-label"><LockLabel />{owner ? 'Owner access' : 'Team access'}</span></header><main id="workspace-main" tabIndex={-1}>{children}</main><footer className="portal-footer"><span>Thoughtful stays. Well-managed days.</span><span>Pramod · {owner ? 'Owner' : 'Reception'}</span></footer></div></div>;
}
function LockLabel() { return <span className="live-dot" aria-hidden="true" />; }
