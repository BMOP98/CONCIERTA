import { Router } from 'express';
import { Section } from '../models/index.js';
import { env } from '../config/env.js';
import { wrap } from '../middleware/async.js';
import { auth, admin } from '../middleware/auth.js';
const router = Router();

router.get(
    '/reports/general',
    auth,
    admin,
    wrap(async (req, res) => {
        const params = new URLSearchParams();

        const filterMapping = {
            from: 'from_date',
            to: 'to_date',
            event_id: 'event_id',
            status: 'status'
        };

        for (const [requestKey, reportKey] of Object.entries(filterMapping)) {
            if (req.query[requestKey]) {
                params.set(reportKey, req.query[requestKey]);
            }
        }

        const r = await fetch(
            `${env.RESERVATIONS_URL || 'http://localhost:8003'}/internal/report?${params}`,
            {
                headers: {
                    'x-internal-key':
                        env.INTERNAL_SECRET || 'dev-internal-secret'
                }
            }
        );

        if (!r.ok) {
            throw new Error(
                'No se pudo generar reporte de reservas'
            );
        }

        const report = await r.json();

        const sections = await Section.findAll();

        report.by_event = report.by_event.map((row) => ({
            ...row,
            sections: sections.map((sec) => ({
                section_id: sec.id,
                name: sec.name,
                capacity: sec.capacity,
                occupied: row.by_section[String(sec.id)] || 0,
                revenue:
                    row.by_section_revenue?.[String(sec.id)] || 0,
                available:
                    sec.capacity -
                    (row.by_section[String(sec.id)] || 0)
            })),
            capacity: sections.reduce(
                (a, sec) => a + sec.capacity,
                0
            ),
            available:
                sections.reduce(
                    (a, sec) => a + sec.capacity,
                    0
                ) - row.occupied
        }));

        res.json(report);
    })
);

export default router;
