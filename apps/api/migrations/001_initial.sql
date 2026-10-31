CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  currency char(3) NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- Customer access will be tied to their own bookings; staff roles are property-specific.
CREATE TABLE staff_memberships (
  property_id uuid NOT NULL REFERENCES properties(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('owner', 'receptionist')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, user_id)
);

CREATE INDEX staff_memberships_user_idx ON staff_memberships(user_id);

CREATE TABLE room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  max_guests integer NOT NULL CHECK (max_guests > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, name),
  UNIQUE (property_id, id)
);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  room_type_id uuid NOT NULL,
  number text NOT NULL,
  housekeeping_status text NOT NULL DEFAULT 'clean'
    CHECK (housekeeping_status IN ('clean', 'dirty', 'cleaning')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, number),
  FOREIGN KEY (property_id, room_type_id) REFERENCES room_types(property_id, id)
);

CREATE INDEX rooms_type_idx ON rooms(property_id, room_type_id);
