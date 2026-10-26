import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import scenarioRoutes from './routes/scenario.js';
import eventRoutes from './routes/events.js';
import reportRoutes from './routes/reports.js';
import { errorHandler } from './middleware/errors.js';

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

app.use(scenarioRoutes);
app.use(eventRoutes);
app.use(reportRoutes);
app.use(errorHandler);

export { app };
