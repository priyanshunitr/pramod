import { useEffect, useState } from 'react';
import { ArrowUpRight, Menu, MoveUpRight, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { hotel } from '../config/hotel';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const update = () => {
      const hero = pathname === '/' ? document.querySelector('.architecture-hero') : null;
      const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
      setScrolled(hero ? hero.getBoundingClientRect().bottom <= headerHeight : window.scrollY > 32);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pathname]);
  useEffect(() => {
    setMenuOpen(false);
    if (hash) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
    else { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); document.getElementById('main-content')?.focus({ preventScroll: true }); }
  }, [pathname, hash]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className={`site-header ${pathname === '/' ? 'over-hero' : 'inner-header'} ${scrolled || menuOpen ? 'is-solid' : ''}`}><div className="header-inner">
      <Link className="brand" to="/" aria-label={`${hotel.name} home`}><strong>{hotel.name}</strong></Link>
      <nav className="desktop-nav" aria-label="Main navigation"><NavLink to="/" end>The hotel</NavLink><NavLink to="/rooms">Rooms & suites</NavLink><NavLink to="/gallery">Gallery</NavLink></nav>
      <div className="header-actions"><Link className="signin-link" to="/account">{user ? 'My account' : 'Sign in'}</Link><Link className="button primary header-book" to="/rooms">Find your stay <ArrowUpRight size={17} /></Link><button className="icon-button menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
    </div>{menuOpen && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation"><NavLink to="/" end>The hotel</NavLink><NavLink to="/rooms">Rooms & suites</NavLink><NavLink to="/gallery">Gallery</NavLink><NavLink to="/stay">My stay plan</NavLink><NavLink to="/account">{user ? 'My account' : 'Sign in / create account'}</NavLink></nav>}</header>
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    <footer className="site-footer"><div className="footer-main container"><div className="footer-brand"><Link to="/" className="wordmark">{hotel.name}<span>·</span></Link><p>A place to pause.<br />A stay to remember.</p></div><div className="footer-links"><span className="eyebrow">MAKE YOURSELF AT HOME</span><Link to="/rooms">Rooms & suites</Link><Link to="/gallery">Around the hotel</Link><Link to="/stay">My stay plan</Link></div><div className="footer-links"><span className="eyebrow">YOUR CONNECTION</span><Link to="/account">Guest account <MoveUpRight size={14} /></Link><Link to="/staff">Hotel team access <MoveUpRight size={14} /></Link><Link to="/#about">About this stay</Link></div></div><div className="footer-bottom container"><span>© {new Date().getFullYear()} {hotel.name}. Local hotel demo.</span><p>Illustrative photos, amenities, and rates. Reservations are stored locally; no payments or emails are sent.</p></div></footer>
  </>;
}
