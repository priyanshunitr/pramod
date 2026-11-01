import { featuredRooms } from '../config/hotel';

const interiorRolls = [featuredRooms, [featuredRooms[1], featuredRooms[2], featuredRooms[0]]] as const;

export function InteriorFilmstrip() {
  return <div className="interior-filmstrip" id="interior-filmstrip" role="group" aria-label="Two film rolls of Pramod interiors">
    <div className="filmstrip-columns">
      {interiorRolls.map((rooms, roll) => <div className="filmstrip-viewport" key={roll}>
        <ul className="filmstrip-track" aria-label={`Interior roll ${roll + 1}`}>
          {rooms.map((room, index) => <li className="filmstrip-frame" key={room.slug}>
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
