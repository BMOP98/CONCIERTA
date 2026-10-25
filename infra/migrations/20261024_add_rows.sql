BEGIN;

-- Crear entidad FILA.
CREATE TABLE IF NOT EXISTS "Rows" (
    "id" INTEGER PRIMARY KEY,
    "sectionId" INTEGER NOT NULL
        REFERENCES "Sections"("id"),
    "label" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "uq_row_section_label"
        UNIQUE ("sectionId", "label"),
    CONSTRAINT "uq_row_section_position"
        UNIQUE ("sectionId", "position"),
    CONSTRAINT "ck_row_position"
        CHECK ("position" > 0)
);

-- Asociar cada asiento con su fila.
ALTER TABLE "Seats"
ADD COLUMN IF NOT EXISTS "rowId" INTEGER;

-- Convertir las filas antiguas en registros independientes.
INSERT INTO "Rows" ("id", "sectionId", "label", "position")
SELECT
    ROW_NUMBER() OVER (
        ORDER BY s."sectionId", s."rowLabel"
    )::INTEGER,
    s."sectionId",
    s."rowLabel",
    ASCII(s."rowLabel") - ASCII('A') + 1
FROM (
    SELECT DISTINCT "sectionId", "rowLabel"
    FROM "Seats"
) AS s
ON CONFLICT ("id") DO NOTHING;

-- Relacionar los asientos existentes con sus filas.
UPDATE "Seats" AS seat
SET "rowId" = fila."id"
FROM "Rows" AS fila
WHERE seat."sectionId" = fila."sectionId"
  AND seat."rowLabel" = fila."label"
  AND seat."rowId" IS NULL;

-- No permitir asientos sin fila.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Seats" WHERE "rowId" IS NULL
    ) THEN
        RAISE EXCEPTION
          'Existen asientos sin fila. Revisar la migración.';
    END IF;
END $$;

ALTER TABLE "Seats"
ALTER COLUMN "rowId" SET NOT NULL;

-- Garantizar la integridad referencial.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_seat_row'
    ) THEN
        ALTER TABLE "Seats"
        ADD CONSTRAINT "fk_seat_row"
        FOREIGN KEY ("rowId") REFERENCES "Rows"("id");
    END IF;
END $$;

-- Índices y restricciones.
CREATE INDEX IF NOT EXISTS "idx_rows_section"
ON "Rows" ("sectionId");

CREATE INDEX IF NOT EXISTS "idx_seats_row"
ON "Seats" ("rowId");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_seat_row_number"
ON "Seats" ("rowId", "number");

COMMIT;