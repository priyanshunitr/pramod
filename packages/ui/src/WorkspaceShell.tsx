import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { ArrowUpRight, BedDouble, CalendarDays, LayoutDashboard, LogOut, Sparkles, UsersRound, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { frontendUrl } from '@hotel/api-client';
import { useWorkspace } from './WorkspaceContext';

export function WorkspaceShell({ owner = false, children }: { owner?: boolean; children: ReactNode }) {
  const workspace = useWorkspace(); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); document.getElementById('workspace-main')?.focus({ preventScroll: true }); }, [pathname]);
  const links = owner ? [
    { path: '/', title: 'Overview', Icon: LayoutDashboard }, { path: '/availability', title: 'Room availability', Icon: BedDouble },
    { path: '/reservations', title: 'Reservations', Icon: CalendarDays }, { path: '/readiness', title: 'Room readiness', Icon: Sparkles }, { path: '/team', title: 'Hotel team', Icon: UsersRound },
  ] : [{ path: '/', title: 'Front desk', Icon: LayoutDashboard }, { path: '/reservations', title: 'Reservations', Icon: CalendarDays }, { path: '/availability', title: 'Room availability', Icon: BedDouble }, { path: '/readiness', title: 'Room readiness', Icon: Sparkles }];
  async function logout() { setBusy(true); try { await workspace.signOut(); } catch { setError('Could not sign out. Try again.'); } finally { setBusy(false); } }
  const activePage = links.find(link => link.path === pathname)?.title ?? 'Workspace';
  return <div className="portal-layout"><a className="skip-link" href="#workspace-main">Skip to content</a>
    <aside className={`portal-sidebar ${menuOpen ? 'menu-open' : ''}`}><NavLink to="/" className="portal-wordmark">Pramod<span>THE ART OF A GOOD STAY</span></NavLink>
      <button className="icon-button mobile-nav-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <PanelLeftClose size={21} /> : <PanelLeftOpen size={21} />}</button>
      <div className="property-chip"><span className="property-monogram">P</span><div><strong>{workspace.property.name}</strong><small>{owner ? 'Owner workspace' : 'Reception workspace'}</small></div></div>
      <p className="nav-caption">WORKSPACE</p><nav id="workspace-navigation" aria-label="Workspace navigation">{links.map(({ path, title, Icon }) => <NavLink key={path} to={path} end><Icon size={18} strokeWidth={1.6} /><span>{title}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="eyebrow">A LITTLE CARE. EVERY DAY.</span><p>{owner ? 'A thoughtful stay starts with a clear view.' : 'Small details. Memorable welcomes.'}</p></div><a href={frontendUrl('guest')}>Guest website <ArrowUpRight size={16} /></a><a href={`${frontendUrl(owner ? 'reception' : 'owner')}${workspace.preview ? '/preview/' : ''}`}>{owner ? 'Reception workspace' : 'Owner workspace'} <ArrowUpRight size={16} /></a><div className="sidebar-account"><span className="account-avatar">{workspace.user.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{workspace.user.fullName}</strong><small>{workspace.preview ? 'Sample workspace' : owner ? 'Hotel owner' : 'Hotel team'}</small></div><button className="icon-button" aria-label={workspace.preview ? 'Exit preview' : 'Sign out'} onClick={logout} disabled={busy}><LogOut size={17} /></button></div>{error && <p role="alert">{error}</p>}</div>
    </aside><div className="portal-body"><header className="portal-topbar"><span>{owner ? 'Owner' : 'Reception'} <span className="breadcrumb-slash">/</span><strong>{activePage}</strong></span><span className="access-label"><LockLabel />{workspace.preview ? 'Preview' : owner ? 'Owner access' : 'Team access'}</span></header>
      {workspace.preview && <div className="preview-banner"><span><strong>Sample workspace</strong> · Fictional data. Changes last until reload.</span><a href="/">Go to sign in <ArrowUpRight size={13} /></a></div>}
      <main id="workspace-main" tabIndex={-1}>{children}</main><footer className="portal-footer"><span>Thoughtful stays. Well-managed days.</span><span>Pramod · {owner ? 'Owner' : 'Reception'}</span></footer></div></div>;
}
function LockLabel() { return <span className="live-dot" aria-hidden="true" />; }
