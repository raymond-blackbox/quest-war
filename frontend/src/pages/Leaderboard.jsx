import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function Leaderboard() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { player: currentPlayer } = useAuth();

    useEffect(() => {
        loadLeaderboard();
    }, []);

    const loadLeaderboard = async () => {
        try {
            const data = await api.getLeaderboard();
            setLeaderboard(data);
        } catch (err) {
            console.error('Failed to load leaderboard:', err);
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
        <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
            <h1 className="title">🏆 Leaderboard</h1>
            <p className="subtitle">Top 100 Token Collectors</p>

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
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className={`leaderboard-rank ${getRankClass(index)}`}>
                                {index + 1}
                            </div>
                            <div className="leaderboard-name">
                                {player.displayName || player.username}
                                {player.id === currentPlayer?.id && (
                                    <span className="you-badge" style={{ marginLeft: 'var(--spacing-sm)' }}>You</span>
                                )}
                            </div>
                            <div className="leaderboard-tokens">
                                🪙 {player.tokens}
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
