-- A 30-night stay can exceed a 32-bit total even when the nightly rate fits.
ALTER TABLE bookings ALTER COLUMN total_minor TYPE bigint;
ALTER TABLE bookings ADD CONSTRAINT booking_room_total_matches_dates
  CHECK (total_minor = nightly_rate_minor::bigint * (check_out - check_in));
