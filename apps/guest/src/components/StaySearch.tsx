import { useId, useState, type FormEvent } from 'react';
import { ArrowUpRight, CalendarDays, UsersRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { hotel } from '../config/hotel';
import { useCatalog } from '../context/CatalogContext';
import { addDays, stayFromParams, stayQuery, todayAtHotel, validateStay } from '../lib/stay';

export function StaySearch({ compact = false, roomId }: { compact?: boolean; roomId?: string }) {
  const { property } = useCatalog();
  const today = todayAtHotel(property?.timezone ?? hotel.timezone);
  const [params] = useSearchParams();
  const [stay, setStay] = useState(() => stayFromParams(params, today));
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const navigate = useNavigate();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateStay(stay, today);
    setError(problem);
    if (!problem) navigate(`${roomId ? `/rooms/${roomId}` : '/rooms'}?${stayQuery(stay)}`);
  }

  return <form className={`stay-search ${compact ? 'compact' : ''}`} onSubmit={submit}>
    <div className="search-fields">
      <label htmlFor={`${id}-in`}><span className="field-caption"><CalendarDays size={16} /> CHECK-IN</span>
        <input id={`${id}-in`} type="date" min={today} max="2099-12-31" required value={stay.checkIn} onChange={(event) => {
          const checkIn = event.target.value;
          setStay((value) => ({ ...value, checkIn, checkOut: value.checkOut <= checkIn ? addDays(checkIn, 1) : value.checkOut }));
        }} />
      </label>
      <label htmlFor={`${id}-out`}><span className="field-caption"><CalendarDays size={16} /> CHECK-OUT</span>
        <input id={`${id}-out`} type="date" min={addDays(stay.checkIn || today, 1)} max="2099-12-31" required value={stay.checkOut} onChange={(event) => setStay({ ...stay, checkOut: event.target.value })} />
      </label>
      <label htmlFor={`${id}-guests`}><span className="field-caption"><UsersRound size={16} /> GUESTS</span>
        <select id={`${id}-guests`} value={stay.guests} onChange={(event) => setStay({ ...stay, guests: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map((count) => <option value={count} key={count}>{count} {count === 1 ? 'guest' : 'guests'} · 1 room</option>)}</select>
      </label>
      <button className="button primary" type="submit">{roomId ? 'Update stay' : 'Explore rooms'} <ArrowUpRight size={19} /></button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}
