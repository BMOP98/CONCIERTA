import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { sql } from '../db/connection.js';
import { Scenario, Section, Row, Seat, Event } from '../models/index.js';

async function seed() {
    const count = await Scenario.count();

    // Evitar duplicar los datos del escenario.
    if (count > 0) return;

    const seedPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../../infra/scenario.seed.json'
    );

    const data = JSON.parse(
        fs.readFileSync(seedPath, 'utf8')
    );

    await sql.transaction(async (transaction) => {
        await Scenario.create(data.scenario, { transaction });

        let sectionId = 1;
        let rowId = 1;
        let seatId = 1;

        for (const section of data.sections) {
            await Section.create({
                id: sectionId,
                scenarioId: data.scenario.id,
                ...section
            }, { transaction });

            const numberOfRows = section.rows || 0;
            const seatsPerRow = section.seatsPerRow || 0;

            for (let r = 0; r < numberOfRows; r++) {
                const letter = String.fromCharCode(65 + r);

                await Row.create({
                    id: rowId,
                    sectionId,
                    label: letter,
                    position: r + 1
                }, { transaction });

                for (let n = 1; n <= seatsPerRow; n++) {
                    await Seat.create({
                        id: seatId++,
                        sectionId,
                        rowId,
                        rowLabel: letter,
                        number: n,
                        label: `${letter}${n}`
                    }, { transaction });
                }

                rowId++;
            }

            sectionId++;
        }

        for (const event of data.events) {
            await Event.create({
                ...event,
                scenarioId: data.scenario.id
            }, { transaction });
        }
    });
}

export { seed };
