import { useState } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { hotel } from '../config/hotel';

export function ArchitecturalHero() {
  const [sceneReady, setSceneReady] = useState(false);

  return <section className="architecture-hero" data-header-tone="light" data-scene-ready={sceneReady} aria-labelledby="hero-title">
    <div className="hero-wordmark-anchor"><h1 id="hero-title" className="hero-wordmark"><span className="hero-lettering">{hotel.name}</span><span className="sr-only"> — A place to slow down</span></h1></div>
    <span className="hero-side-note">Stay. Slow.<br />Feel at home.</span>
    <div className="architecture-scene"><img className="architecture-cutout" src="/images/pramod-architecture-v3.png" alt="An imagined Pramod retreat: a sunlit modern villa framed by palms, overlooking a turquoise pool" fetchPriority="high" width="1672" height="941" onLoad={() => setSceneReady(true)} onError={() => setSceneReady(true)} /></div>
    <div className="architecture-shade" />
    <div className="hero-bottom"><a className="hero-scroll" href="#about"><span><ArrowDown size={22} strokeWidth={1.5} /></span><span>Step into<br />a slower day.</span></a><div className="hero-bottom-copy"><p>A place to pause.<br />A stay to remember.</p><Link to="/rooms">Find your stay <ArrowUpRight size={17} /></Link></div></div>
  </section>;
}
