import { z } from 'zod';

export const eventSchema = z.object({
    name: z.string().min(3).max(150),
    description: z.string().min(5).max(3000),
    artist: z.string().min(2).max(120),
    genre: z.string().min(2).max(60),
    date: z.string().datetime({ offset: true }),
    imageUrl: z.string().url().optional().nullable(),
    active: z.boolean().optional()
});

export function validateEvent(payload) {
    return {
        ...eventSchema.parse(payload),
        scenarioId: 1
    };
}