import { Link, Route, Routes } from 'react-router';
import { api, useAuth, type PropertyCatalog } from '@hotel/api-client';
import { HousekeepingPanel, StaffGate, WorkspaceShell, WorkspaceProvider, WorkspacePreview } from '@hotel/ui';
import { ReceptionPage } from './ReceptionPage';
import { AvailabilityPage } from './AvailabilityPage';

export default function App({ preview = false }: { preview?: boolean }) {
  return preview ? <WorkspacePreview>{property => <ReceptionRoutes property={property} />}</WorkspacePreview> : <LiveWorkspace />;
}
function LiveWorkspace() {
  const auth = useAuth();
  return <StaffGate>{property => <WorkspaceProvider value={{ property, user: auth.user!, request: api, signOut: auth.logout, refreshAccess: () => { void auth.refresh(); } }}><ReceptionRoutes property={property} /></WorkspaceProvider>}</StaffGate>;
}
function ReceptionRoutes({ property }: { property: PropertyCatalog }) {
  return <WorkspaceShell><Routes>
    <Route index element={<ReceptionPage dashboard />} />
    <Route path="reservations" element={<ReceptionPage key="reservations" />} />
    <Route path="availability" element={<AvailabilityPage />} />
    <Route path="readiness" element={<HousekeepingPanel propertyId={property.id} />} />
    <Route path="*" element={<div className="empty-state"><h1>Page not found.</h1><Link to="/" className="text-link">Back to reservations</Link></div>} />
  </Routes></WorkspaceShell>;
}
