import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Coins, Swords, ArrowLeft, Crown, Medal, User } from 'lucide-react';
import './Leaderboard.css';

function Leaderboard() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('balance'); // 'balance' or 'earnings'
    const navigate = useNavigate();
    const { player: currentPlayer, authReady } = useAuth();

    useEffect(() => {
        if (authReady) {
            loadLeaderboard();
        }
    }, [category, authReady]);

    const loadLeaderboard = async () => {
        setLoading(true);
        try {
            const data = await api.getLeaderboard(category);
            setLeaderboard(data);
        } catch (err) {
            logger.error('Failed to load leaderboard:', err);
        } finally {
            setLoading(false);
        }
    };

    const getRankIcon = (index) => {
        if (index === 0) return <Crown size={18} fill="#000" />; // Gold gets Crown
        if (index === 1) return <Medal size={18} />;
        if (index === 2) return <Medal size={18} />;
        return index + 1;
    };

    const getRankClass = (index) => {
        if (index === 0) return 'rank-1';
        if (index === 1) return 'rank-2';
        if (index === 2) return 'rank-3';
        return '';
    };

    return (
        <div className="container leaderboard-page">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="leaderboard-header"
            >
                <h1 className="leaderboard-title">
                    <Trophy size={42} className="text-accent" />
                    <span>Leaderboard</span>
                </h1>
                <p className="leaderboard-subtitle">
                    {category === 'balance' ? 'Top High Rollers' : 'Question Mastery'}
                </p>
            </motion.div>

            {/* Custom Toggle Switch */}
            <div className="category-toggle-container" data-active={category}>
                <div
                    className="toggle-bg"
                    style={{
                        width: '50%',
                        transform: category === 'balance' ? 'translateX(0)' : 'translateX(100%)'
                    }}
                />
                <button
                    className={`category-toggle ${category === 'balance' ? 'active' : ''}`}
                    onClick={() => setCategory('balance')}
                >
                    <Coins size={16} /> Wealth
                </button>
                <button
                    className={`category-toggle ${category === 'earnings' ? 'active' : ''}`}
                    onClick={() => setCategory('earnings')}
                >
                    <Swords size={16} /> Valor
                </button>
            </div>

            {loading ? (
                <div className="leaderboard-list">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="skeleton" style={{ opacity: 1 - i * 0.15 }} />
                    ))}
                </div>
            ) : leaderboard.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="empty-state"
                >
                    <div className="empty-icon">
                        <Trophy size={64} strokeWidth={1} />
                    </div>
                    <h3>No Legends Yet</h3>
                    <p>Be the first to claim your spot on the leaderboard!</p>
                </motion.div>
            ) : (
                <motion.div layout className="leaderboard-list">
                    <AnimatePresence mode='popLayout'>
                        {leaderboard.map((player, index) => (
                            <motion.div
                                key={player.id}
                                layoutId={player.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: index * 0.05 }}
                                className={`leaderboard-card ${player.id === currentPlayer?.id ? 'current-user' : ''}`}
                            >
                                <div className={`rank-badge ${getRankClass(index)}`}>
                                    {getRankIcon(index)}
                                </div>

                                <div className="player-info">
                                    <div className="player-name">
                                        {player.displayName || player.username || `Player ${player.id.substr(0, 4)}`}
                                    </div>
                                    <div className="player-sub">
                                        Rank #{index + 1}
                                    </div>
                                </div>

                                <div className={`score-badge ${category}`}>
                                    {category === 'balance' ? <Coins size={14} /> : <Swords size={14} />}
                                    {player.displayValue ?? player.tokens?.toLocaleString() ?? 0}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            <button
                className="back-fab"
                onClick={() => navigate('/lobby')}
            >
                <ArrowLeft size={20} />
                <span>Lobby</span>
            </button>
        </div>
    );
}

export default Leaderboard;
