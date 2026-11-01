import { Link, Route, Routes } from 'react-router';
import { api, useAuth, type PropertyCatalog } from '@hotel/api-client';
import { HousekeepingPanel, StaffGate, TeamPanel, WorkspaceShell, WorkspaceProvider, WorkspacePreview, useWorkspace } from '@hotel/ui';
import { ReportPage } from './ReportPage';

export default function App({ preview = false }: { preview?: boolean }) {
  return preview ? <WorkspacePreview owner>{property => <OwnerRoutes property={property} />}</WorkspacePreview> : <LiveWorkspace />;
}
function LiveWorkspace() {
  const auth = useAuth();
  return <StaffGate owner>{property => <WorkspaceProvider value={{ property, user: auth.user!, request: api, signOut: auth.logout, refreshAccess: () => { void auth.refresh(); } }}><OwnerRoutes property={property} /></WorkspaceProvider>}</StaffGate>;
}
function OwnerRoutes({ property }: { property: PropertyCatalog }) {
  const workspace = useWorkspace();
  return <WorkspaceShell owner><Routes>
    <Route index element={<ReportPage property={property} view="overview" />} />
    <Route path="availability" element={<ReportPage property={property} view="availability" />} />
    <Route path="reservations" element={<ReportPage property={property} view="reservations" />} />
    <Route path="readiness" element={<HousekeepingPanel propertyId={property.id} />} />
    <Route path="team" element={<TeamPanel propertyId={property.id} onChange={workspace.refreshAccess} />} />
    <Route path="*" element={<div className="empty-state"><h1>Page not found.</h1><Link to="/" className="text-link">Back to overview</Link></div>} />
  </Routes></WorkspaceShell>;
}
