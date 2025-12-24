import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { initializeFirebase, getRealtimeDb } from './services/firebase.js';
import { DistributedRateLimitStore } from './services/rateLimitStore.js';
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';
import gameRoutes from './routes/game.js';
import leaderboardRoutes from './routes/leaderboard.js';
import transactionsRoutes from './routes/transactions.js';
import logger from './services/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy if behind Cloud Run or similar
app.set('trust proxy', true);

// Security Middleware
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(express.json());

// Initialize Firebase
initializeFirebase();

logger.info('[RESTART] Applying security and stability fixes...');

const rtdb = getRealtimeDb();

// Global Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // Limit each IP to 500 requests per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new DistributedRateLimitStore(getRealtimeDb, { prefix: 'rl_global' }),
    message: { error: 'Too many requests from this IP, please try again later.' },
    validate: { trustProxy: false }
});

app.use(globalLimiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/transactions', transactionsRoutes);

// Error handling
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    logger.info(`Quest War API running on port ${PORT}`);
});
