import express from 'express';
import cors from 'cors';
import { initializeFirebase } from './services/firebase.js';
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';
import gameRoutes from './routes/game.js';
import leaderboardRoutes from './routes/leaderboard.js';
import transactionsRoutes from './routes/transactions.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase
initializeFirebase();

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
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Quest War API running on port ${PORT}`);
});
