CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE users ADD COLUMN password_hash text;
ALTER TABLE users ADD COLUMN phone text;

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  resets_at timestamptz NOT NULL
);

CREATE TABLE staff_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  user_id uuid NOT NULL REFERENCES users(id),
  introduction text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX staff_requests_pending_unique ON staff_requests(property_id, user_id) WHERE status = 'pending';

CREATE TABLE staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'receptionist')),
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  accepted_by uuid REFERENCES users(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  subject_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE room_types ADD COLUMN nightly_rate_minor integer CHECK (nightly_rate_minor >= 0 AND nightly_rate_minor <= 100000000);
-- These are the existing local demo rates, not production hotel pricing.
UPDATE room_types SET nightly_rate_minor = CASE id
  WHEN '00000000-0000-4000-8000-000000000101' THEN 450000
  WHEN '00000000-0000-4000-8000-000000000102' THEN 650000
  WHEN '00000000-0000-4000-8000-000000000103' THEN 950000 END
WHERE property_id IN (SELECT id FROM properties WHERE slug = 'demo-hotel')
  AND id IN ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103');

ALTER TABLE rooms ADD COLUMN operational_status text NOT NULL DEFAULT 'active' CHECK (operational_status IN ('active', 'out_of_service'));
ALTER TABLE rooms ADD CONSTRAINT rooms_property_id_id_unique UNIQUE (property_id, id);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  customer_id uuid NOT NULL REFERENCES users(id),
  room_type_id uuid NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests integer NOT NULL CHECK (guests BETWEEN 1 AND 6),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
  nightly_rate_minor integer NOT NULL CHECK (nightly_rate_minor >= 0),
  total_minor integer NOT NULL CHECK (total_minor >= 0),
  currency char(3) NOT NULL,
  idempotency_key uuid NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in AND check_out - check_in <= 30),
  FOREIGN KEY (property_id, room_type_id) REFERENCES room_types(property_id, id),
  UNIQUE (customer_id, idempotency_key),
  UNIQUE (property_id, id, check_in, check_out)
);
CREATE INDEX bookings_property_dates_idx ON bookings(property_id, check_in, check_out);

CREATE TABLE booking_rooms (
  booking_id uuid NOT NULL,
  property_id uuid NOT NULL,
  room_id uuid NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (booking_id, room_id),
  FOREIGN KEY (property_id, room_id) REFERENCES rooms(property_id, id),
  FOREIGN KEY (property_id, booking_id, check_in, check_out) REFERENCES bookings(property_id, id, check_in, check_out),
  CHECK (check_out > check_in),
  EXCLUDE USING gist (room_id WITH =, daterange(check_in, check_out, '[)') WITH &&) WHERE (active)
);

-- Durable booking events. Delivery is deliberately separate from booking success.
CREATE TABLE notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  event text NOT NULL CHECK (event IN ('booking.confirmed', 'booking.cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  UNIQUE (booking_id, event)
);
