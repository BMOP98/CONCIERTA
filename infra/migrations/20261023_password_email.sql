-- Optional manual fallback. Automatic additive migrations run at service startup.
\connect concierta_auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;
\connect concierta_reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS email_status VARCHAR NOT NULL DEFAULT 'PENDING';
