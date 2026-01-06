import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

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

    const getRankClass = (index) => {
        if (index === 0) return 'gold';
        if (index === 1) return 'silver';
        if (index === 2) return 'bronze';
        return '';
    };

    return (
        <div className="container leaderboard-page" style={{ paddingTop: 'var(--spacing-xl)' }}>
            <h1 className="title">🏆 Leaderboard</h1>

            {/* Category Tabs */}
            <div className="leaderboard-tabs" style={{
                display: 'flex',
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-lg)',
                justifyContent: 'center'
            }}>
                <button
                    className={`tab-button ${category === 'balance' ? 'active' : ''}`}
                    onClick={() => setCategory('balance')}
                    style={{
                        padding: 'var(--spacing-sm) var(--spacing-lg)',
                        borderRadius: 'var(--radius-md)',
                        border: category === 'balance' ? '2px solid var(--primary)' : '2px solid var(--border-primary)',
                        background: category === 'balance' ? 'var(--primary)' : 'var(--surface-elevated)',
                        color: category === 'balance' ? 'white' : 'var(--text-secondary)',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    💰 Token Balance
                </button>
                <button
                    className={`tab-button ${category === 'earnings' ? 'active' : ''}`}
                    onClick={() => setCategory('earnings')}
                    style={{
                        padding: 'var(--spacing-sm) var(--spacing-lg)',
                        borderRadius: 'var(--radius-md)',
                        border: category === 'earnings' ? '2px solid var(--success)' : '2px solid var(--border-primary)',
                        background: category === 'earnings' ? 'var(--success)' : 'var(--surface-elevated)',
                        color: category === 'earnings' ? 'white' : 'var(--text-secondary)',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    ⚔️ Quest Earnings
                </button>
            </div>

            <p className="subtitle" style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>
                {category === 'balance'
                    ? 'Top 100 by Current Token Holdings'
                    : 'Top 100 by Lifetime Quest Earnings'}
            </p>

            {loading ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <div className="animate-pulse" style={{ color: 'var(--text-secondary)' }}>
                        Loading...
                    </div>
                </div>
            ) : leaderboard.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                        No players on the leaderboard yet
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Win a game to get on the board!
                    </p>
                </div>
            ) : (
                <ul className="leaderboard-list">
                    {leaderboard.map((player, index) => (
                        <li
                            key={player.id}
                            className={`leaderboard-item animate-fade-in ${player.id === currentPlayer?.id ? 'me' : ''}`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className={`leaderboard-rank ${getRankClass(index)}`}>
                                {index + 1}
                            </div>
                            <div className="leaderboard-name">
                                {player.displayName || player.username}
                            </div>
                            <div className="leaderboard-tokens">
                                {category === 'balance' ? '🪙' : '⚔️'} {player.displayValue ?? player.tokens}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <button

                onClick={() => navigate('/lobby')}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    backgroundColor: '#b9b9b9ff',
                    border: '2px solid #333',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    padding: '12px 24px',
                    minWidth: '150px',
                    color: '#333',
                    fontWeight: '500',
                    fontSize: '16px',
                    cursor: 'pointer'
                }}
            >
                ← Back to Lobby
            </button>
        </div>
    );
}

export default Leaderboard;
