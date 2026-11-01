import { featuredRooms } from '../config/hotel';

const alternateRooms = [featuredRooms[1], featuredRooms[2], featuredRooms[0]] as const;
// Landscape frames are shorter, so repeat the sequence to preserve the long scroll.
// The longer second roll travels downward faster, with a half-frame stagger.
const interiorRolls = [
  { rooms: Array.from({ length: 12 }, (_, index) => featuredRooms[index % featuredRooms.length]!), startFrame: 0, direction: 'up' },
  { rooms: Array.from({ length: 16 }, (_, index) => alternateRooms[index % alternateRooms.length]!), startFrame: 0.5, direction: 'down' },
] as const;

export function InteriorFilmstrip() {
  return <div className="interior-filmstrip" id="interior-filmstrip" role="group" aria-label="Two film rolls of Pramod interiors">
    <div className="filmstrip-columns">
      {interiorRolls.map(({ rooms, startFrame, direction }, roll) => <div className="filmstrip-viewport" key={roll}>
        <ul className="filmstrip-track" data-start-frame={startFrame} data-direction={direction} aria-label={`Interior roll ${roll + 1}`}>
          {rooms.map((room, index) => <li className="filmstrip-frame" key={`${room.slug}-${index}`} aria-hidden={index >= featuredRooms.length ? true : undefined}>
            <figure>
              <img src={room.image} alt={`Illustrative ${room.name.toLowerCase()} interior`} width="600" height="450" loading="lazy" />
              <figcaption><span>{room.name}</span><span aria-hidden="true">{String(index + 1).padStart(2, '0')}{roll === 0 ? 'A' : 'B'}</span></figcaption>
            </figure>
          </li>)}
        </ul>
      </div>)}
    </div>
  </div>;
}
