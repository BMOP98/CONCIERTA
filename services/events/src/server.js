
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Sequelize, DataTypes, Op } from 'sequelize';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

dotenv.config({
    path: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../.env'
    )
});

const env = process.env;

if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error(
        "JWT_SECRET debe tener al menos 32 caracteres"
    );
}

if (!env.INTERNAL_SECRET || env.INTERNAL_SECRET.length < 32) {
    throw new Error(
        "INTERNAL_SECRET debe tener al menos 32 caracteres"
    );
}

const sql = new Sequelize(
    'concierta_events',
    env.DATABASE_USER || 'concierta',
    env.DATABASE_PASSWORD || 'concierta_local_change_me',
    {
        host: env.DATABASE_HOST || 'localhost',
        port: Number(env.DATABASE_PORT || 5434),
        dialect: 'postgres',
        logging: false
    }
);


// MODELOS


const Scenario = sql.define(
    'Scenario',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: DataTypes.TEXT,
        location: DataTypes.STRING,
        capacity: DataTypes.INTEGER
    },
    {
        timestamps: false
    }
);

const Section = sql.define('Section', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    scenarioId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    name: DataTypes.STRING,
    description: DataTypes.STRING,
    type: DataTypes.STRING,
    capacity: DataTypes.INTEGER,
    price: DataTypes.DECIMAL(10, 2),
    rows: DataTypes.INTEGER,
    seatsPerRow: DataTypes.INTEGER
}, {
    timestamps: false
});

const Row = sql.define('Row', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    sectionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    label: {
        type: DataTypes.STRING,
        allowNull: false
    },
    position: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    timestamps: false,
    indexes: [
        { unique: true, fields: ['sectionId', 'label'] },
        { unique: true, fields: ['sectionId', 'position'] }
    ]
});

const Seat = sql.define('Seat', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    sectionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    rowId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    rowLabel: DataTypes.STRING,
    number: DataTypes.INTEGER,
    label: DataTypes.STRING
}, {
    timestamps: false
});

const Event = sql.define(
    'Event',
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        scenarioId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        artist: {
            type: DataTypes.STRING,
            allowNull: false
        },
        genre: {
            type: DataTypes.STRING,
            allowNull: false
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        imageUrl: DataTypes.STRING,
        active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    },
    {
        timestamps: true
    }
);

const AuditLog = sql.define('AuditLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    action: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    resource: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    resourceId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    details: {
        type: DataTypes.STRING(1000),
        allowNull: true
    }
}, {
    timestamps: true,
    updatedAt: false
});

// RELACIONES ENTRE MODELOS


Scenario.hasMany(Section, { foreignKey: 'scenarioId' });
Section.belongsTo(Scenario, { foreignKey: 'scenarioId' });

Section.hasMany(Row, { foreignKey: 'sectionId' });
Row.belongsTo(Section, { foreignKey: 'sectionId' });

Row.hasMany(Seat, { foreignKey: 'rowId' });
Seat.belongsTo(Row, { foreignKey: 'rowId' });

// Relación adicional para compatibilidad con la API actual.
Section.hasMany(Seat, { foreignKey: 'sectionId' });
Seat.belongsTo(Section, { foreignKey: 'sectionId' });

Scenario.hasMany(Event, { foreignKey: 'scenarioId' });
Event.belongsTo(Scenario, { foreignKey: 'scenarioId' });


// CONFIGURACIÓN DE EXPRESS


const app = express();

app.use(helmet());

app.use(
    cors({
        origin: env.CORS_ORIGIN || 'http://localhost:5173'
    })
);

app.use(
    express.json({
        limit: '50kb'
    })
);


// MANEJO DE ERRORES ASÍNCRONOS


const wrap = (f) => (req, res, next) =>
    Promise.resolve(f(req, res, next)).catch(next);

async function writeAudit({
    action,
    userId,
    resource = 'EVENT',
    resourceId = null,
    status = 'SUCCESS',
    details = null
}) {
    try {
        await AuditLog.create({
            action,
            userId,
            resource,
            resourceId,
            status,
            details
        });
    } catch (error) {
        console.error(
            'No se pudo registrar auditoría:',
            action,
            error
        );
    }
}

// MIDDLEWARE DE AUTENTICACIÓN


async function auth(req, res, next) {
    try {
        // 1. Obtener el token del encabezado Authorization.
        const authorization = req.headers.authorization || '';
        const match = authorization.match(/^Bearer\s+(.+)$/i);

        if (!match) {
            return res.status(401).json({
                detail: 'Token de autenticación requerido'
            });
        }

        // 2. Validar firma y vencimiento del JWT.
        const claims = jwt.verify(
            match[1],
            env.JWT_SECRET,
            {
                algorithms: ['HS256']
            }
        );

        if (!claims.sub || typeof claims.sub !== 'string') {
            return res.status(401).json({
                detail: 'Token inválido'
            });
        }

        // 3. Consultar el estado real del usuario en Autenticación.
        const authUrl = (
            env.AUTH_URL || 'http://localhost:8001'
        ).replace(/\/$/, '');

        let response;

        try {
            response = await fetch(
                `${authUrl}/internal/users/${encodeURIComponent(claims.sub)}`,
                {
                    method: 'GET',
                    headers: {
                        'x-internal-key': env.INTERNAL_SECRET
                    },
                    signal: AbortSignal.timeout(5000)
                }
            );
        } catch (error) {
            console.error('No se pudo consultar Autenticación:', error);

            return res.status(503).json({
                detail: 'Servicio de Autenticación no disponible'
            });
        }

        if (!response.ok) {
            console.error(
                'Error verificando usuario:',
                response.status
            );

            return res.status(503).json({
                detail: 'No se pudo verificar la cuenta'
            });
        }

        const account = await response.json();

        // 4. Rechazar usuarios inexistentes o desactivados.
        if (!account.exists || !account.active) {
            return res.status(401).json({
                detail: 'Cuenta inexistente o desactivada'
            });
        }

        // 5. Exigir cambio de contraseña cuando corresponda.
        if (account.must_change_password) {
            return res.status(403).json({
                detail: 'Debes cambiar tu contraseña antes de continuar'
            });
        }

        // 6. Utilizar el rol actual del usuario.
        if (
            !Number.isInteger(claims.token_version) ||
            claims.token_version !== account.token_version
        ) {
            return res.status(401).json({
                detail: 'Sesión invalidada. Inicia sesión nuevamente'
            });
        }
        req.user = {
            ...claims,
            role: account.role
        };

        next();

    } catch (error) {
        if (
            error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError' ||
            error.name === 'NotBeforeError'
        ) {
            return res.status(401).json({
                detail: 'Token inválido o expirado'
            });
        }

        console.error('Error de autorización:', error);

        return res.status(503).json({
            detail: 'No se pudo verificar la autorización'
        });
    }
}


// MIDDLEWARE DE ADMINISTRADOR


function admin(req, res, next) {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({
            detail: 'Requiere ADMIN'
        });
    }

    next();
}


// VALIDACIÓN DE EVENTOS


const schema = z.object({
    name: z.string().min(3).max(150),
    description: z.string().min(5).max(3000),
    artist: z.string().min(2).max(120),
    genre: z.string().min(2).max(60),
    date: z.string().datetime({ offset: true }),
    imageUrl: z.string().url().optional().nullable(),
    active: z.boolean().optional()
});

function validate(req) {
    let p = schema.parse(req.body);

    return {
        ...p,
        scenarioId: 1
    };
}


// HEALTH CHECK


app.get('/health', (req, res) =>
    res.json({
        status: 'ok',
        service: 'events'
    })
);


// ESCENARIOS


app.get('/scenario', wrap(async (req, res) => {
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


app.get(
    '/sections',
    wrap(async (req, res) => {
        res.json(
            await Section.findAll({
                order: [['id', 'ASC']]
            })
        );
    })
);


// LISTAR Y FILTRAR EVENTOS


app.get(
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


app.get(
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


app.post(
    '/events',
    auth,
    admin,
    wrap(async (req, res) => {
        const event = await Event.create(validate(req));

        await writeAudit({
            action: 'EVENT_CREATED',
            userId: req.user.sub,
            resourceId: event.id,
            details: `Concierto creado: $DIL0`
        });

        res.status(201).json(event);
    })
);


// ACTUALIZAR EVENTO


app.put(
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

        await e.update(validate(req));

        await writeAudit({
            action: 'EVENT_UPDATED',
            userId: req.user.sub,
            resourceId: e.id,
            details: `Concierto modificado: $DIL1`
        });

        res.json(e);
    })
);


// DESPUBLICAR EVENTO


app.delete(
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
                details: `Concierto despublicado: $DIL2`
            });
        }

        res.json({
            message: 'Evento despublicado; histórico conservado'
        });
    })
);


// REPORTES GENERALES


app.get(
    '/reports/general',
    auth,
    admin,
    wrap(async (req, res) => {
        const params = new URLSearchParams();

        for (const k of ['from', 'to', 'event_id', 'status']) {
            if (req.query[k]) {
                params.set(k, req.query[k]);
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


// MANEJO GLOBAL DE ERRORES


app.use((err, req, res, next) => {
    if (err instanceof z.ZodError) {
        return res.status(422).json({
            detail: err.issues
        });
    }

    console.error(err);

    res.status(500).json({
        detail: 'Error interno del servicio de eventos'
    });
});


// CARGA INICIAL DE DATOS (SEED)


async function seed() {
    const count = await Scenario.count();

    // Evitar duplicar los datos del escenario.
    if (count > 0) return;

    const seedPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../infra/scenario.seed.json'
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

// INICIALIZACIÓN DEL SERVIDOR

await sql.authenticate();

await sql.sync();

await seed();

app.listen(8002, () => {
    console.log('Eventos http://localhost:8002');
});
