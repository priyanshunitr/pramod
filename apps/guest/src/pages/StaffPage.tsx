import { ArrowUpRight } from 'lucide-react';
import { frontendUrl } from '@hotel/api-client';

export function StaffPage() {
  return <div className="container page-content"><div className="page-heading"><p className="eyebrow">BEHIND EVERY LOVELY STAY</p><h1>One team.<br />A shared <em>welcome.</em></h1><p>Choose your hotel workspace. Sign in with your Pramod account; access is approved for this hotel.</p></div><div className="workspace-columns"><div className="staff-form-card"><h2>The reception <em>desk.</em></h2><p>Manage reservations, welcome arriving guests, and keep rooms ready for the next stay.</p><a className="button primary" href={frontendUrl('reception')}>Open reception <ArrowUpRight size={17} /></a></div><div className="staff-form-card"><h2>The owner's <em>view.</em></h2><p>See hotel metrics, room availability, and reservations. Manage access for your hotel team.</p><a className="button primary" href={frontendUrl('owner')}>Open owner dashboard <ArrowUpRight size={17} /></a></div></div><p className="fine-print">Receptionists can request access or accept an invitation. Owners join by invitation after the hotel's first owner is set up.</p></div>;
}
