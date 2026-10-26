import { Router } from 'express';
import { Op } from 'sequelize';
import { Event } from '../models/index.js';
import { wrap } from '../middleware/async.js';
import { auth, admin } from '../middleware/auth.js';
import { writeAudit } from '../services/audit.js';
import { validateEvent } from '../validation.js';
const router = Router();

router.get(
    '/events',
    wrap(async (req, res) => {
        const where = {};

        if (req.query.include_inactive !== 'true') {
            where.active = true;
        }

        if (req.query.q) {
            where[Op.or] = [
                {
                    name: {
                        [Op.iLike]: `%${req.query.q}%`
                    }
                },
                {
                    artist: {
                        [Op.iLike]: `%${req.query.q}%`
                    }
                }
            ];
        }

        if (req.query.from || req.query.to) {
            where.date = {};

            if (req.query.from) {
                where.date[Op.gte] = new Date(req.query.from);
            }

            if (req.query.to) {
                where.date[Op.lte] = new Date(req.query.to);
            }
        }

        res.json(
            await Event.findAll({
                where,
                order: [['date', 'ASC']]
            })
        );
    })
);


// OBTENER EVENTO POR ID


router.get(
    '/events/:id',
    wrap(async (req, res) => {
        const e = await Event.findByPk(req.params.id);

        if (!e) {
            return res.status(404).json({
                detail: 'Evento no encontrado'
            });
        }

        res.json(e);
    })
);


// CREAR EVENTO


router.post(
    '/events',
    auth,
    admin,
    wrap(async (req, res) => {
        const event = await Event.create(validateEvent(req.body));

        await writeAudit({
            action: 'EVENT_CREATED',
            userId: req.user.sub,
            resourceId: event.id,
            details: `Concierto creado: ${event.name}`
        });

        res.status(201).json(event);
    })
);


// ACTUALIZAR EVENTO


router.put(
    '/events/:id',
    auth,
    admin,
    wrap(async (req, res) => {
        const e = await Event.findByPk(req.params.id);

        if (!e) {
            return res.status(404).json({
                detail: 'Evento no encontrado'
            });
        }

        await e.update(validateEvent(req.body));

        await writeAudit({
            action: 'EVENT_UPDATED',
            userId: req.user.sub,
            resourceId: e.id,
            details: `Concierto modificado: ${e.name}`
        });

        res.json(e);
    })
);


// DESPUBLICAR EVENTO


router.delete(
    '/events/:id',
    auth,
    admin,
    wrap(async (req, res) => {
        const e = await Event.findByPk(req.params.id);

        if (!e) {
            return res.status(404).json({
                detail: 'Evento no encontrado'
            });
        }

        const wasActive = e.active;

        await e.update({
            active: false
        });

        if (wasActive) {
            await writeAudit({
                action: 'EVENT_UNPUBLISHED',
                userId: req.user.sub,
                resourceId: e.id,
                details: `Concierto despublicado: ${e.name}`
            });
        }

        res.json({
            message: 'Evento despublicado; histórico conservado'
        });
    })
);

export default router;
