import { DataTypes } from 'sequelize';
import { sql } from '../db/connection.js';

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

export { Scenario, Section, Row, Seat, Event, AuditLog };
