import { Link, Route, Routes } from 'react-router';
import { BookingList, HousekeepingPanel, StaffGate, WorkspaceShell } from '@hotel/ui';

export default function App() {
  return <StaffGate>{property => <WorkspaceShell><Routes>
    <Route index element={<><div className="portal-page-heading"><div><p className="eyebrow">THE RECEPTION DESK</p><h1>Every guest, <em>looked after.</em></h1><p>Manage arrivals, departures, and reservations for Pramod.</p></div></div><BookingList propertyId={property.id} /></>} />
    <Route path="readiness" element={<HousekeepingPanel propertyId={property.id} />} />
    <Route path="*" element={<div className="empty-state"><h1>Page not found.</h1><Link to="/" className="text-link">Back to reservations</Link></div>} />
  </Routes></WorkspaceShell>}</StaffGate>;
}
