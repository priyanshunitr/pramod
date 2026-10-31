import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@hotel/api-client';

interface Team { members: { id: string; fullName: string; email: string; role: string }[]; requests: { id: string; fullName: string; email: string; introduction: string }[]; }
export function TeamPanel({ propertyId, onChange }: { propertyId: string; onChange: () => void }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [revoke, setRevoke] = useState<string | null>(null);
  const base = `/properties/${propertyId}/staff`;
  useEffect(() => {
    const controller = new AbortController();
    api<Team>(`${base}/team`, undefined, controller.signal).then(data => { if (!controller.signal.aborted) setTeam(data); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load your team.'); });
    return () => controller.abort();
  }, [base, version]);
  async function act(path: string, body: unknown) {
    setBusy(true); setError(null);
    try { await api(`${base}${path}`, body); setVersion(value => value + 1); setRevoke(null); onChange(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not update the team.'); }
    finally { setBusy(false); }
  }
  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    setBusy(true); setError(null); setInvite(null);
    try { setInvite(await api(`${base}/invitations`, { email: String(fields.get('email')).trim(), role: fields.get('role') })); form.reset(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not create the invitation.'); }
    finally { setBusy(false); }
  }
  return <section className="workspace-section"><div className="workspace-heading"><h2>Your hotel <em>team.</em></h2><button className="text-link" disabled={busy} onClick={() => setVersion(value => value + 1)}>Refresh team</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="workspace-columns"><div><h3>Access requests</h3>{team?.requests.length === 0 && <p>No requests waiting for review.</p>}{team?.requests.map(request => <article className="team-card" key={request.id}><strong>{request.fullName}</strong><p>{request.email}</p><p>{request.introduction}</p><div className="reservation-actions"><button className="button primary" disabled={busy} onClick={() => act(`/requests/${request.id}/review`, { decision: 'approved' })}>Approve receptionist</button><button className="text-link" disabled={busy} onClick={() => act(`/requests/${request.id}/review`, { decision: 'rejected' })}>Reject</button></div></article>)}
      <h3>Active members</h3>{team?.members.map(member => <article className="team-card" key={member.id}><strong>{member.fullName}</strong><p>{member.email} · {member.role}</p>{revoke === member.id ? <div className="reservation-actions"><span>Remove hotel access?</span><button className="button secondary" disabled={busy} onClick={() => act(`/members/${member.id}/revoke`, {})}>Confirm removal</button><button className="text-link" onClick={() => setRevoke(null)}>Keep access</button></div> : <button className="text-link" disabled={busy} onClick={() => setRevoke(member.id)}>Remove access</button>}</article>)}
    </div><div className="staff-form-card"><h3>Invite a team member</h3><form className="account-form" onSubmit={inviteMember}><label>Account email<input name="email" type="email" maxLength={254} required disabled={busy} /></label><label>Hotel role<select name="role" disabled={busy}><option value="receptionist">Receptionist</option><option value="owner">Owner</option></select></label><p className="fine-print">Owners can invite and remove staff. Only invite people you trust to manage this hotel.</p><button className="button primary" disabled={busy}>Create invitation</button></form>{invite && <div className="notice" role="status"><strong>Invitation created</strong><p>Share this code privately with the intended person. They must sign in with the invited email. Valid until {new Date(invite.expiresAt).toLocaleDateString()}.</p><label className="invitation-code">Invitation code<input readOnly value={invite.token} onFocus={event => event.currentTarget.select()} /></label><p className="fine-print">No email was sent. This code is shown only here.</p></div>}</div></div>
  </section>;
}
