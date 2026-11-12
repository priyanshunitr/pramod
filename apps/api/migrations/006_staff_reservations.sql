-- Staff reservations keep guest contact details without creating login accounts.
ALTER TABLE bookings ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE bookings
  ADD COLUMN booked_by uuid REFERENCES users(id),
  ADD COLUMN guest_name text,
  ADD COLUMN guest_email text,
  ADD COLUMN guest_phone text,
  ADD CONSTRAINT bookings_staff_request_unique UNIQUE (booked_by, idempotency_key),
  ADD CONSTRAINT bookings_guest_identity CHECK (
    (customer_id IS NOT NULL AND booked_by IS NULL AND guest_name IS NULL AND guest_email IS NULL AND guest_phone IS NULL)
    OR
    (customer_id IS NULL AND booked_by IS NOT NULL AND guest_name IS NOT NULL
      AND length(trim(guest_name)) BETWEEN 2 AND 120
      AND (nullif(trim(guest_email), '') IS NOT NULL OR nullif(trim(guest_phone), '') IS NOT NULL))
  );
