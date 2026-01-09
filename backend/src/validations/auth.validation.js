import { z } from 'zod';

export const loginSchema = z.object({
    body: z.object({
        idToken: z.string().min(1, 'Firebase ID token is required'),
    }),
});

export const updateProfileSchema = z.object({
    params: z.object({
        playerId: z.string().min(1),
    }),
    body: z.object({
        displayName: z.string().min(3).max(12).regex(/^[a-zA-Z0-9 _-]+$/, 'Display name can only contain letters, numbers, spaces, hyphens, and underscores'),
    }),
});

export const getProfileSchema = z.object({
    params: z.object({
        playerId: z.string().min(1),
    }),
});
