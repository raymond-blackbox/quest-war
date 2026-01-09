import { z } from 'zod';

const safeString = z.string().trim().min(1).regex(/^[a-zA-Z0-9 _-]+$/, 'Input contains invalid characters');

export const createRoomSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1).max(15).regex(/^[a-zA-Z0-9 _'-(),.!#?]+$/, 'Room name contains invalid characters'),
        password: z.string().optional(),
        gameType: z.string().optional().refine(val => !val || /^[a-zA-Z0-9]+$/.test(val), 'Invalid game type'),
        questionDifficulty: z.string().optional().refine(val => !val || /^[a-zA-Z]+$/.test(val), 'Invalid difficulty'),
        questionsCount: z.number().int().min(1).max(50).optional(),
        isSolo: z.boolean().optional(),
        hostUsername: z.string().optional(),
        hostDisplayName: safeString.optional(),
        delaySeconds: z.number().int().min(1).max(60).optional(),
        roundSeconds: z.number().int().min(5).max(60).optional(),
    }),
});

export const joinRoomSchema = z.object({
    params: z.object({
        id: safeString,
    }),
    body: z.object({
        playerUsername: safeString,
        playerDisplayName: safeString.optional(),
        password: z.string().optional(),
    }),
});
