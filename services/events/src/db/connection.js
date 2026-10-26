import { Sequelize } from 'sequelize';
import { env } from '../config/env.js';

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

export { sql };
