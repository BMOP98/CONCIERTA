-- CONCIERTA: datos de ejemplo de Eventos (complemento documental del seed JSON).
-- Fuente: infra/scenario.seed.json. No reemplaza la carga automatica ORM/Sequelize.
-- Ejecutar SOLO sobre la base concierta_events, con tablas ya creadas.
-- NO ejecutar sobre bases con informacion real; el bloque omite la carga si ya existe el escenario 1.
-- Ejemplo manual: psql -U concierta -d concierta_events -f infra/datos_ejemplo.sql
-- Las otras dos bases (auth y reservations) no reciben usuarios ni reservas ficticias.

DO $concierta_seed$
DECLARE
    v_section_id integer;
    v_row_id integer := 1;
    v_seat_id integer := 1;
    v_rows integer;
    v_per_row integer;
    v_row_index integer;
    v_seat_number integer;
    v_letter text;
BEGIN
    IF EXISTS (SELECT 1 FROM "Scenarios" WHERE "id" = 1) THEN
        RAISE NOTICE 'Escenario CONCIERTA ya existe; se omite la carga SQL para evitar duplicados.';
        RETURN;
    END IF;

    INSERT INTO "Scenarios" ("id", "name", "description", "location", "capacity")
    VALUES (1, 'Escenario CONCIERTA', 'Recinto principal de conciertos con localidades numeradas y cancha general', 'Quito, Ecuador', 330);

    INSERT INTO "Sections" ("id", "scenarioId", "name", "description", "type", "capacity", "price", "rows", "seatsPerRow")
    VALUES (1, 1, 'VIP', 'Frente al escenario', 'VIP', 48, 75, 4, 12);
    INSERT INTO "Sections" ("id", "scenarioId", "name", "description", "type", "capacity", "price", "rows", "seatsPerRow")
    VALUES (2, 1, 'PREFERENCIA', 'Vista preferencial', 'PREFERENCIA', 72, 55, 6, 12);
    INSERT INTO "Sections" ("id", "scenarioId", "name", "description", "type", "capacity", "price", "rows", "seatsPerRow")
    VALUES (3, 1, 'BUTACAS', 'Asientos centrales', 'BUTACAS', 60, 45, 5, 12);
    INSERT INTO "Sections" ("id", "scenarioId", "name", "description", "type", "capacity", "price", "rows", "seatsPerRow")
    VALUES (4, 1, 'GENERAL', 'Gradería general', 'GENERAL', 90, 30, 6, 15);
    INSERT INTO "Sections" ("id", "scenarioId", "name", "description", "type", "capacity", "price", "rows", "seatsPerRow")
    VALUES (5, 1, 'CANCHA', 'Zona de pie sin asientos numerados', 'CANCHA', 60, 25, NULL, NULL);

    -- Materializar filas y asientos de acuerdo con cada seccion numerada.
    -- CANCHA no tiene filas ni asientos, solo capacidad agregada.
    FOR v_section_id IN 1..4 LOOP
        SELECT "rows", "seatsPerRow" INTO v_rows, v_per_row
        FROM "Sections" WHERE "id" = v_section_id;
        FOR v_row_index IN 1..v_rows LOOP
            v_letter := chr(ascii('A') + v_row_index - 1);
            INSERT INTO "Rows" ("id", "sectionId", "label", "position")
            VALUES (v_row_id, v_section_id, v_letter, v_row_index);
            FOR v_seat_number IN 1..v_per_row LOOP
                INSERT INTO "Seats" ("id", "sectionId", "rowId", "rowLabel", "number", "label")
                VALUES (v_seat_id, v_section_id, v_row_id, v_letter, v_seat_number, v_letter || v_seat_number::text);
                v_seat_id := v_seat_id + 1;
            END LOOP;
            v_row_id := v_row_id + 1;
        END LOOP;
    END LOOP;

    -- Conciertos de demostracion: mismas fechas, artistas y generos del seed JSON.
    INSERT INTO "Events" ("id", "scenarioId", "name", "description", "artist", "genre", "date", "active", "createdAt", "updatedAt")
    VALUES (md5('concierta:demo:event:Noches de Neón')::uuid, 1, 'Noches de Neón', 'Festival electrónico con luces y experiencias inmersivas.', 'Neon Collective', 'Electrónica', '2026-11-14T20:00:00-05:00', TRUE, now(), now());
    INSERT INTO "Events" ("id", "scenarioId", "name", "description", "artist", "genre", "date", "active", "createdAt", "updatedAt")
    VALUES (md5('concierta:demo:event:Ecos del Rock')::uuid, 1, 'Ecos del Rock', 'Los himnos del rock en una noche inolvidable.', 'Ecos del Rock Band', 'Rock', '2026-11-21T19:30:00-05:00', TRUE, now(), now());
    INSERT INTO "Events" ("id", "scenarioId", "name", "description", "artist", "genre", "date", "active", "createdAt", "updatedAt")
    VALUES (md5('concierta:demo:event:Ritmo Latino')::uuid, 1, 'Ritmo Latino', 'Una noche de ritmos latinos para bailar.', 'Ritmo Latino Ensemble', 'Latino', '2026-12-05T20:30:00-05:00', TRUE, now(), now());
    INSERT INTO "Events" ("id", "scenarioId", "name", "description", "artist", "genre", "date", "active", "createdAt", "updatedAt")
    VALUES (md5('concierta:demo:event:Sinfonía Bajo las Estrellas')::uuid, 1, 'Sinfonía Bajo las Estrellas', 'Orquesta y magia en vivo.', 'Orquesta Concierta', 'Clásica', '2026-12-12T19:00:00-05:00', TRUE, now(), now());

    IF v_row_id - 1 <> 21 OR v_seat_id - 1 <> 270 THEN
        RAISE EXCEPTION 'Conteo inesperado de filas (%) o asientos (%)', v_row_id - 1, v_seat_id - 1;
    END IF;
    RAISE NOTICE 'Datos de ejemplo insertados: 1 escenario, 5 secciones, 21 filas, 270 asientos, 4 eventos.';
END;
$concierta_seed$;

-- Nota: las 60 localidades CANCHA son capacidad agregada; 270 asientos + 60 CANCHA = 330.
-- En uso habitual no ejecutar este archivo: el servicio de Eventos carga scenario.seed.json.
