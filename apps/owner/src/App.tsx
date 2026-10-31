import { Link, Route, Routes } from 'react-router';
import { useAuth } from '@hotel/api-client';
import { HousekeepingPanel, StaffGate, TeamPanel, WorkspaceShell } from '@hotel/ui';
import { ReportPage } from './ReportPage';

export default function App() {
  const auth = useAuth();
  return <StaffGate owner>{property => <WorkspaceShell owner><Routes>
    <Route index element={<ReportPage property={property} view="overview" />} />
    <Route path="availability" element={<ReportPage property={property} view="availability" />} />
    <Route path="reservations" element={<ReportPage property={property} view="reservations" />} />
    <Route path="readiness" element={<HousekeepingPanel propertyId={property.id} />} />
    <Route path="team" element={<TeamPanel propertyId={property.id} onChange={() => { void auth.refresh(); }} />} />
    <Route path="*" element={<div className="empty-state"><h1>Page not found.</h1><Link to="/" className="text-link">Back to overview</Link></div>} />
  </Routes></WorkspaceShell>}</StaffGate>;
}
