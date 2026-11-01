import { Link, Route, Routes } from 'react-router';
import { api, useAuth, type PropertyCatalog } from '@hotel/api-client';
import { BookingList, HousekeepingPanel, StaffGate, WorkspaceShell, WorkspaceProvider, WorkspacePreview } from '@hotel/ui';

export default function App({ preview = false }: { preview?: boolean }) {
  return preview ? <WorkspacePreview>{property => <ReceptionRoutes property={property} />}</WorkspacePreview> : <LiveWorkspace />;
}
function LiveWorkspace() {
  const auth = useAuth();
  return <StaffGate>{property => <WorkspaceProvider value={{ property, user: auth.user!, request: api, signOut: auth.logout, refreshAccess: () => { void auth.refresh(); } }}><ReceptionRoutes property={property} /></WorkspaceProvider>}</StaffGate>;
}
function ReceptionRoutes({ property }: { property: PropertyCatalog }) {
  return <WorkspaceShell><Routes>
    <Route index element={<><div className="portal-page-heading"><div><p className="eyebrow">THE RECEPTION DESK</p><h1>Every guest, <em>looked after.</em></h1><p>Manage arrivals, departures, and reservations for Pramod.</p></div></div><BookingList propertyId={property.id} /></>} />
    <Route path="readiness" element={<HousekeepingPanel propertyId={property.id} />} />
    <Route path="*" element={<div className="empty-state"><h1>Page not found.</h1><Link to="/" className="text-link">Back to reservations</Link></div>} />
  </Routes></WorkspaceShell>;
}
