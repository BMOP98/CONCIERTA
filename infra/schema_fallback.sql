-- SQL de respaldo para PostgreSQL. Cada bloque se ejecuta CONECTADO a la BD indicada.
-- NOTA: en funcionamiento normal SQLAlchemy/Sequelize crean el esquema automáticamente.
\connect concierta_auth
CREATE TABLE IF NOT EXISTS roles (id VARCHAR PRIMARY KEY, description VARCHAR NOT NULL);
CREATE TABLE IF NOT EXISTS users (
 id VARCHAR PRIMARY KEY, first_name VARCHAR NOT NULL, second_name VARCHAR NOT NULL DEFAULT '',
 last_name VARCHAR NOT NULL, dni VARCHAR NOT NULL UNIQUE, nationality VARCHAR NOT NULL,
 address VARCHAR NOT NULL, phone VARCHAR NOT NULL, email VARCHAR NOT NULL UNIQUE,
 username VARCHAR NOT NULL UNIQUE, password_hash VARCHAR NOT NULL,
 role_id VARCHAR NOT NULL REFERENCES roles(id), active BOOLEAN NOT NULL DEFAULT TRUE,
 last_login TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 must_change_password BOOLEAN NOT NULL DEFAULT TRUE
);
-- Conectarse a concierta_events para el siguiente bloque:
\connect concierta_events
CREATE TABLE IF NOT EXISTS "Scenarios" ("id" INTEGER PRIMARY KEY,"name" VARCHAR(255) NOT NULL,"description" TEXT,"location" VARCHAR(255),"capacity" INTEGER);
CREATE TABLE IF NOT EXISTS "Sections" ("id" INTEGER PRIMARY KEY,"scenarioId" INTEGER NOT NULL REFERENCES "Scenarios"("id"),"name" VARCHAR(255),"description" VARCHAR(255),"type" VARCHAR(255),"capacity" INTEGER,"price" NUMERIC(10,2),"rows" INTEGER,"seatsPerRow" INTEGER);
CREATE TABLE IF NOT EXISTS "Rows" (
    "id" INTEGER PRIMARY KEY,
    "sectionId" INTEGER NOT NULL
        REFERENCES "Sections"("id"),
    "label" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL CHECK ("position" > 0),
    UNIQUE ("sectionId", "label"),
    UNIQUE ("sectionId", "position")
);

CREATE TABLE IF NOT EXISTS "Seats" (
    "id" INTEGER PRIMARY KEY,
    "sectionId" INTEGER NOT NULL
        REFERENCES "Sections"("id"),
    "rowId" INTEGER NOT NULL
        REFERENCES "Rows"("id"),
    "rowLabel" VARCHAR(255),
    "number" INTEGER NOT NULL,
    "label" VARCHAR(255),
    UNIQUE ("rowId", "number")
);

CREATE INDEX IF NOT EXISTS "idx_rows_section"
ON "Rows" ("sectionId");

CREATE INDEX IF NOT EXISTS "idx_seats_row"
ON "Seats" ("rowId");
CREATE TABLE IF NOT EXISTS "Events" ("id" UUID PRIMARY KEY,"scenarioId" INTEGER NOT NULL REFERENCES "Scenarios"("id"),"name" VARCHAR(255) NOT NULL,"description" TEXT NOT NULL,"artist" VARCHAR(255) NOT NULL,"genre" VARCHAR(255) NOT NULL,"date" TIMESTAMPTZ NOT NULL,"imageUrl" VARCHAR(255),"active" BOOLEAN DEFAULT TRUE,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());
-- Conectarse a concierta_reservations para el siguiente bloque:
\connect concierta_reservations
CREATE TABLE IF NOT EXISTS reservations (
 id VARCHAR PRIMARY KEY, code VARCHAR NOT NULL UNIQUE, client_id VARCHAR NOT NULL,
 event_id VARCHAR NOT NULL, status VARCHAR NOT NULL DEFAULT 'PENDING',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),expires_at TIMESTAMPTZ NOT NULL,
 confirmed_at TIMESTAMPTZ,
 total NUMERIC(12,2) NOT NULL DEFAULT 0,
 email_status VARCHAR NOT NULL DEFAULT 'PENDING'
);
CREATE INDEX IF NOT EXISTS ix_reservations_client_id ON reservations(client_id);
CREATE INDEX IF NOT EXISTS ix_reservations_event_id ON reservations(event_id);
CREATE TABLE IF NOT EXISTS tickets (
 id VARCHAR PRIMARY KEY, reservation_id VARCHAR NOT NULL REFERENCES reservations(id),
 event_id VARCHAR NOT NULL, section_id INTEGER NOT NULL,seat_id INTEGER,
 seat_label VARCHAR NOT NULL,qr_secret VARCHAR NOT NULL UNIQUE,
 unit_price NUMERIC(12,2) NOT NULL,validated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS ix_tickets_reservation_id ON tickets(reservation_id);
CREATE INDEX IF NOT EXISTS idx_ticket_event_seat ON tickets(event_id,seat_id);
