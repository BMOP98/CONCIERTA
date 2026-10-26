import { Router } from 'express';
import { Scenario, Section, Row, Seat } from '../models/index.js';
import { wrap } from '../middleware/async.js';
const router = Router();

router.get('/health', (req, res) =>
    res.json({
        status: 'ok',
        service: 'events'
    })
);


// ESCENARIOS


router.get('/scenario', wrap(async (req, res) => {
    const scenarios = await Scenario.findAll({
        include: [{
            model: Section,
            include: [
                {
                    model: Row,
                    include: [{ model: Seat }]
                },
                { model: Seat }
            ]
        }],
        order: [
            [Section, 'id', 'ASC'],
            [Section, Row, 'position', 'ASC'],
            [Section, Row, Seat, 'number', 'ASC'],
            [Section, Seat, 'id', 'ASC']
        ]
    });

    res.json(scenarios);
}));


// SECCIONES


router.get(
    '/sections',
    wrap(async (req, res) => {
        res.json(
            await Section.findAll({
                order: [['id', 'ASC']]
            })
        );
    })
);

export default router;
