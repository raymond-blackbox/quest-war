import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config/index.js';
import { initializeFirebase, getRealtimeDb } from './services/firebase.js';
import { DistributedRateLimitStore } from './services/rateLimitStore.js';
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';
import gameRoutes from './routes/game.js';
import leaderboardRoutes from './routes/leaderboard.js';
import transactionsRoutes from './routes/transactions.js';
import questRoutes from './routes/quests.js';
import logger from './services/logger.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();
const PORT = config.PORT;

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
if (process.env.NODE_ENV !== 'test') {
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
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        version: config.NODE_ENV
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/quests', questRoutes);

// Error handling - MUST be after all routes
app.use(errorHandler);

// Start server
let server;
if (process.env.NODE_ENV !== 'test') {
    server = app.listen(PORT, () => {
        logger.info(`Quest War API running on port ${PORT} in ${config.NODE_ENV} mode`);
    });
}

// Forceful shutdown helper: Track and destroy connections
const connections = new Set();
if (server) {
    server.on('connection', (socket) => {
        connections.add(socket);
        socket.on('close', () => connections.delete(socket));
    });
}

const shutdown = (signal) => {
    logger.info(`[${signal}] Shutting down server...`);

    // Immediately stop accepting new connections
    if (server) {
        server.close(() => {
            logger.info('Server closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }

    // Forcefully destroy existing connections
    if (connections.size > 0) {
        logger.info(`Destroying ${connections.size} active connections...`);
        for (const socket of connections) {
            socket.destroy();
        }
        connections.clear();
    }

    // Backup force shutdown
    setTimeout(() => {
        logger.error('Forceful shutdown timeout');
        process.exit(1);
    }, 2000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle nodemon restart
process.once('SIGUSR2', () => {
    logger.info('[SIGUSR2] Nodemon restart...');
    // In dev, we want to be very fast
    for (const socket of connections) {
        socket.destroy();
    }
    if (server) {
        server.close(() => {
            process.kill(process.pid, 'SIGUSR2');
        });
    } else {
        process.kill(process.pid, 'SIGUSR2');
    }
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions 
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception thrown:', err.message);
    if (err.code === 'EADDRINUSE') {
        logger.error('Port 3001 is busy. Please ensure no other instances are running.');
        process.exit(1);
    }
    shutdown('UNCAUGHT_EXCEPTION');
});

export { app };
