import { z } from 'zod';

export function errorHandler(err, req, res, next) {
    if (err instanceof z.ZodError) {
        return res.status(422).json({ detail: err.issues });
    }
    console.error(err);
    res.status(500).json({ detail: 'Error interno del servicio de eventos' });
}
