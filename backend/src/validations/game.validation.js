import { z } from 'zod';

const safeString = z.string().trim().min(1).regex(/^[a-zA-Z0-9 _-]+$/, 'Input contains invalid characters');

export const submitAnswerSchema = z.object({
    params: z.object({
        roomId: safeString,
    }),
    body: z.object({
        answerIndex: z.number().int().min(0),
        playerUsername: safeString,
    }),
});

export const startGameSchema = z.object({
    params: z.object({
        roomId: safeString,
    }),
});
