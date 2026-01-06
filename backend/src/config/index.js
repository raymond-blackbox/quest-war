import { z } from 'zod';

const configSchema = z.object({
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    FIREBASE_DB_URL: z.string().optional(),
    // Add other environment variables here as needed
});

const envVars = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    FIREBASE_DB_URL: process.env.FIREBASE_DB_URL,
};

const parsedEnv = configSchema.safeParse(envVars);

if (!parsedEnv.success) {
    console.error('❌ Invalid environment variables:', parsedEnv.error.format());
    process.exit(1);
}

export const config = parsedEnv.data;
export default config;
