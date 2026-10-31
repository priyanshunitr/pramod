import { useEffect, useState } from 'react';
import { getProperty, type PropertyCatalog } from './lib/api';

const workspaces = [
  { number: '01', name: 'Customer', description: 'Find a room, plan a stay, and manage reservations.', detail: 'Browse · Book · Stay' },
  { number: '02', name: 'Reception', description: 'Welcome guests and keep the day running smoothly.', detail: 'Arrivals · Rooms · Departures' },
  { number: '03', name: 'Owner', description: 'Manage your property, your people, and the bigger picture.', detail: 'Rates · Team · Reports' },
];

export default function App() {
  const [property, setProperty] = useState<PropertyCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setProperty(null);
    getProperty('demo-hotel', controller.signal).then(setProperty).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'Unable to load the hotel.');
      }
    });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Hotel workspace home">
          <span className="brand-icon" aria-hidden="true">h.</span>
          <span>hotel<span className="brand-secondary"> / workspace</span></span>
        </a>
        <span className="version-label">FOUNDATION / 01</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="welcome-title">
          <div>
            <p className="eyebrow"><span aria-hidden="true" /> ONE PROPERTY. EVERY PERSPECTIVE.</p>
            <h1 id="welcome-title">A better stay<br />starts here.</h1>
            <p className="hero-description">One home for your guests, your reception team, and your hotel business.</p>
          </div>
          <aside className="property-note">
            <span className="small-label">YOUR PROPERTY</span>
            <p>{property?.name ?? 'Your hotel'}</p>
            <span className="note-description">A foundation for what comes next.</span>
            <div className="connection-status" role="status">
              <span className={`status-dot ${property ? 'connected' : error ? 'disconnected' : ''}`} />
              {property ? 'Hotel data connected' : error ? 'Connection needs attention' : 'Connecting to your hotel…'}
            </div>
          </aside>
        </section>

        <section aria-labelledby="workspace-title" className="workspace-section">
          <div className="section-heading"><h2 id="workspace-title">Three roles. One shared experience.</h2><span>PLANNED WORKSPACES</span></div>
          <div className="workspace-grid">
            {workspaces.map((workspace) => (
              <article className="workspace-card" key={workspace.name}>
                <div className="card-top"><span>{workspace.number}</span><span className="planned-label">Coming next</span></div>
                <h3>{workspace.name}</h3>
                <p>{workspace.description}</p>
                <div className="card-detail">{workspace.detail}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="rooms-section" aria-labelledby="rooms-title">
          <div className="section-heading"><h2 id="rooms-title">Room collection</h2><span>DEMO CATALOG</span></div>
          {error ? (
            <div className="error-panel" role="alert"><p>{error}</p><button onClick={() => setAttempt((value) => value + 1)}>Try again <span aria-hidden="true">↻</span></button></div>
          ) : !property ? (
            <p className="loading-message" role="status">Loading your room collection…</p>
          ) : property.roomTypes.length === 0 ? (
            <p className="loading-message">No room types have been added yet.</p>
          ) : (
            <div className="room-list">
              {property.roomTypes.map((room, index) => (
                <article className="room-row" key={room.id}>
                  <span className="room-number">0{index + 1}</span>
                  <div><h3>{room.name}</h3><p>{room.description}</p></div>
                  <span className="guest-count">Up to {room.maxGuests} guests</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer><span>Hotel workspace</span><span>Starter preview · Booking and sign-in are not enabled yet.</span></footer>
    </div>
  );
}
