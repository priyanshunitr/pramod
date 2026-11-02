import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bell, ArrowUpRight } from 'lucide-react';
import type { StaffNotifications } from '@hotel/contracts';
import { useWorkspace } from './WorkspaceContext';
import { pollStaff } from './pollStaff';

export function OwnerNotifications() {
  const { property, request } = useWorkspace();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => pollStaff(async signal => {
    try {
      const data = await request<StaffNotifications>(`/properties/${property.id}/staff/notifications`, undefined, signal);
      if (!signal.aborted) { setCount(data.pendingCount); setError(false); }
    } catch { if (!signal.aborted) setError(true); }
  }), [property.id, request]);
  const label = error ? 'Access requests unavailable. Open hotel team to retry.' : count === null ? 'Checking reception requests' : `${count} reception access ${count === 1 ? 'request' : 'requests'} awaiting approval`;
  return <Link className={`owner-notifications ${count ? 'has-requests' : ''}`} to="/team" aria-label={label} title={label}>
    <Bell size={17} aria-hidden="true" /><span className="notification-label">{error ? 'Check requests' : count ? 'Reception requests' : 'Requests'}</span>
    <span className="notification-count" aria-live="polite" aria-atomic="true">{error ? '!' : count ?? '…'}</span>{!!count && <ArrowUpRight size={14} aria-hidden="true" />}
  </Link>;
}
