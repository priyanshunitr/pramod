import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Copy, RefreshCw, UsersRound } from 'lucide-react';
import { useStaffRequest } from './WorkspaceContext';
import { pollStaff, STAFF_ACCESS_CHANGED } from './pollStaff';

interface Team { members: { id: string; fullName: string; email: string; role: string }[]; requests: { id: string; fullName: string; email: string; introduction: string }[]; }
export function TeamPanel({ propertyId, onChange }: { propertyId: string; onChange: () => void }) {
  const request = useStaffRequest();
  const [team, setTeam] = useState<Team | null>(null); const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [version, setVersion] = useState(0);
  const [revoke, setRevoke] = useState<string | null>(null); const [message, setMessage] = useState(''); const [copied, setCopied] = useState(false);
  const base = `/properties/${propertyId}/staff`;
  useEffect(() => {
    if (busy) return;
    setLoading(true);
    return pollStaff(async signal => {
      try {
        const data = await request<Team>(`${base}/team`, undefined, signal);
        if (!signal.aborted) { setTeam(data); setLoadError(null); }
      } catch (cause) { if (!signal.aborted) setLoadError(cause instanceof Error ? cause.message : 'Could not load your team.'); }
      finally { if (!signal.aborted) setLoading(false); }
    });
  }, [base, version, request, busy]);
  async function act(path: string, body: unknown, success: string) {
    setBusy(true); setError(null); setMessage('');
    try { await request(`${base}${path}`, body); setVersion(value => value + 1); setRevoke(null); setMessage(success); window.dispatchEvent(new Event(STAFF_ACCESS_CHANGED)); if (path.endsWith('/revoke')) onChange(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update the team.'); }
    finally { setBusy(false); }
  }
  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    setBusy(true); setError(null); setInvite(null); setCopied(false);
    try { setInvite(await request(`${base}/invitations`, { email: String(fields.get('email')).trim(), role: fields.get('role') })); form.reset(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the invitation.'); }
    finally { setBusy(false); }
  }
  return <section className="workspace-section page-enter"><div className="portal-page-heading"><div><p className="eyebrow">THE PEOPLE BEHIND THE WELCOME</p><h1>A good stay takes <em>a team.</em></h1><p>Invite trusted colleagues and manage their access to Pramod.</p></div><button className="button secondary" disabled={busy || loading} onClick={() => setVersion(value => value + 1)}><RefreshCw size={14} />Refresh</button></div>
    {team && <div className="team-summary"><span><strong>{team.members.length}</strong> active members</span><span><strong>{team.requests.length}</strong> access requests</span></div>}
    {(error || loadError) && <p className="form-error" role="alert">{error || loadError}</p>}{message && <p className="notice" role="status">{message}</p>}
    {loading && !team && <p className="fine-print" role="status">Loading your hotel team…</p>}
    <div className="workspace-columns"><div><h3>Access requests</h3>{team?.requests.length === 0 && <div className="team-card"><UsersRound size={20} /><p>All caught up. No requests waiting for review.</p></div>}{team?.requests.map(item => <article className="team-card" key={item.id}><strong>{item.fullName}</strong><p>{item.email}</p><p>{item.introduction}</p><div className="reservation-actions"><button className="button primary" disabled={busy || loading} onClick={() => act(`/requests/${item.id}/review`, { decision: 'approved' }, `${item.fullName} now has reception access.`)}>Approve receptionist <Check size={14} /></button><button className="text-link" disabled={busy || loading} onClick={() => act(`/requests/${item.id}/review`, { decision: 'rejected' }, 'Access request declined.')}>Decline</button></div></article>)}
      <h3>Active members</h3>{team?.members.map(member => <article className="team-card" key={member.id}><div className="guest-cell"><span className="guest-initials" aria-hidden="true">{member.fullName.split(' ').map(word => word[0]).slice(0, 2).join('')}</span><div><strong>{member.fullName}</strong><small>{member.role === 'owner' ? 'Owner' : 'Receptionist'}</small></div></div><p>{member.email}</p>{revoke === member.id ? <div className="reservation-actions"><span>Remove hotel access?</span><button className="button secondary" disabled={busy || loading} onClick={() => act(`/members/${member.id}/revoke`, {}, `${member.fullName} no longer has hotel access.`)}>Confirm removal</button><button className="text-link" disabled={busy} onClick={() => setRevoke(null)}>Keep access</button></div> : <button className="text-link" disabled={busy || loading} onClick={() => setRevoke(member.id)}>Remove access</button>}</article>)}
    </div><div className="staff-form-card"><p className="eyebrow">GROW YOUR TEAM</p><h3>Send a warm welcome.</h3><form className="account-form" onSubmit={inviteMember}><label>Account email<input name="email" type="email" maxLength={254} placeholder="colleague@example.com" required disabled={busy} /></label><label>Hotel role<select name="role" disabled={busy}><option value="receptionist">Receptionist</option><option value="owner">Owner</option></select></label><p className="fine-print">Receptionists manage stays and room readiness. Owners also see hotel reports and manage team access.</p><button className="button primary" disabled={busy}>Create invitation <ArrowUpRight size={15} /></button></form>{invite && <div className="notice" role="status"><strong>Invitation created</strong><p>Share this code privately with the intended person. They must use the invited email. Expires {new Date(invite.expiresAt).toLocaleDateString('en-IN')}.</p><label className="invitation-code">Invitation code<input readOnly value={invite.token} onFocus={event => event.currentTarget.select()} /></label><button className="text-link" onClick={async () => { try { await navigator.clipboard.writeText(invite.token); setCopied(true); } catch { setError('Could not copy. Select and copy the code above.'); } }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy code'}</button><p className="fine-print">No email is sent automatically.</p></div>}</div></div>
  </section>;
}
