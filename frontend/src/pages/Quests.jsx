import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

function Quests() {
    const [quests, setQuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(null);
    const [error, setError] = useState('');
    const { player, refreshPlayer } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        loadQuests();
    }, [player]);

    const loadQuests = async () => {
        if (!player?.id) return;

        try {
            setLoading(true);
            const questData = await api.getQuests(player.id);
            setQuests(questData);
        } catch (err) {
            setError('Failed to load quests');
            console.error('Load quests error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClaimReward = async (questId) => {
        try {
            setClaiming(questId);
            await api.claimQuestReward(player.id, questId);
            const latestProfile = await api.getProfile(player.id);
            refreshPlayer(latestProfile);
            await loadQuests(); // Refresh quests
        } catch (err) {
            setError('Failed to claim reward');
            console.error('Claim reward error:', err);
        } finally {
            setClaiming(null);
        }
    };

    const getQuestIcon = (questId) => {
        const iconBase = (children) => (
            <svg
                className="quest-icon-svg"
                viewBox="0 0 64 64"
                width="64"
                height="64"
                aria-hidden="true"
            >
                {children}
            </svg>
        );

        const palette = {
            violet: '#8b5cf6',
            blue: '#38bdf8',
            teal: '#22d3ee',
            green: '#34d399',
            yellow: '#fde047',
            orange: '#fb923c',
            red: '#fb7185',
            white: '#ffffff'
        };

        const icons = {
            daily_math_warrior: iconBase([
                <rect key="cal" x="10" y="14" width="44" height="36" rx="6" fill={palette.blue} />,
                <rect key="cal-top" x="10" y="14" width="44" height="10" rx="6" fill={palette.violet} />,
                <path
                    key="cal-check"
                    d="M22 36 L28 42 L42 28 L46 32 L28 50 L18 40 Z"
                    fill={palette.green}
                />
            ]),
            streak_master: iconBase([
                <path
                    key="flame"
                    d="M32 12 C26 18 26 24 28 28 C20 30 18 42 26 48 C30 52 38 52 42 48 C48 44 46 32 38 26 C40 20 36 16 32 12 Z"
                    fill={palette.orange}
                />,
                <path
                    key="flame-core"
                    d="M32 24 C30 28 30 32 32 34 C28 36 28 40 32 42 C34 44 38 42 38 38 C38 34 36 30 32 24 Z"
                    fill={palette.yellow}
                />
            ]),
            speed_demon: iconBase([
                <path key="bolt" d="M36 10 L20 36 H30 L26 54 L46 28 H34 Z" fill={palette.yellow} />,
                <rect key="line-1" x="8" y="22" width="10" height="4" rx="2" fill={palette.blue} />,
                <rect key="line-2" x="8" y="32" width="12" height="4" rx="2" fill={palette.blue} />,
                <rect key="line-3" x="8" y="42" width="8" height="4" rx="2" fill={palette.blue} />
            ]),
            social_butterfly: iconBase([
                <circle key="head-1" cx="24" cy="26" r="8" fill={palette.violet} />,
                <circle key="head-2" cx="40" cy="26" r="8" fill={palette.teal} />,
                <rect key="body-1" x="16" y="36" width="16" height="12" rx="6" fill={palette.violet} />,
                <rect key="body-2" x="32" y="36" width="16" height="12" rx="6" fill={palette.teal} />,
                <rect key="link" x="28" y="30" width="8" height="6" rx="3" fill={palette.white} />
            ]),
            collector_explorer: iconBase([
                <polygon key="gem-1" points="18,32 24,24 30,32 24,40" fill={palette.violet} />,
                <polygon key="gem-2" points="30,24 36,16 42,24 36,32" fill={palette.blue} />,
                <polygon key="gem-3" points="34,38 40,30 46,38 40,46" fill={palette.green} />
            ]),
            mastery_seeker: iconBase([
                <rect key="cup" x="20" y="18" width="24" height="16" rx="4" fill={palette.yellow} />,
                <rect key="handle-1" x="16" y="20" width="6" height="10" rx="3" fill={palette.yellow} />,
                <rect key="handle-2" x="42" y="20" width="6" height="10" rx="3" fill={palette.yellow} />,
                <rect key="stem" x="28" y="34" width="8" height="10" rx="2" fill={palette.orange} />,
                <rect key="base" x="22" y="44" width="20" height="6" rx="3" fill={palette.orange} />
            ]),
            weekly_champion: iconBase([
                <path key="crown" d="M14 40 L18 20 L28 30 L32 18 L36 30 L46 20 L50 40 Z" fill={palette.yellow} />,
                <rect key="crown-base" x="14" y="40" width="36" height="8" rx="4" fill={palette.orange} />
            ]),
            perfectionist: iconBase([
                <circle key="ring" cx="32" cy="32" r="18" fill={palette.red} />,
                <circle key="ring-inner" cx="32" cy="32" r="12" fill={palette.white} />,
                <circle key="bull" cx="32" cy="32" r="6" fill={palette.red} />,
                <circle key="dot" cx="32" cy="32" r="3" fill={palette.white} />
            ])
        };

        return icons[questId] || iconBase([
            <circle key="fallback" cx="32" cy="32" r="12" fill={palette.white} />
        ]);
    };

    const getProgressPercentage = (quest) => {
        if (quest.completed) return 100;
        return Math.min((quest.progress / quest.target) * 100, 100);
    };

    const questStats = useMemo(() => {
        const total = quests.length;
        const completed = quests.filter((quest) => quest.completed).length;
        const claimed = quests.filter((quest) => quest.claimed).length;
        return { total, completed, claimed };
    }, [quests]);

    const getStatusClass = (quest) => {
        if (quest.claimed) return 'claimed';
        if (quest.completed) return 'completed';
        return 'active';
    };

    const getResetLabel = (quest) => {
        const resetType = quest.resetType?.toLowerCase?.();
        if (resetType === 'daily') return 'Daily';
        if (resetType === 'weekly') return 'Weekly';
        return '';
    };

    if (loading) {
        return (
            <div className="container" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                <p>Loading quests...</p>
            </div>
        );
    }

    return (
        <div className="container quests-page" style={{ paddingTop: 'var(--spacing-lg)' }}>
            <div className="quests-header">
                <div className="quests-summary">
                    <div className="quest-summary-pill">
                        {questStats.completed}/{questStats.total} completed
                    </div>
                    <div className="quest-summary-pill">
                        {questStats.claimed} claimed
                    </div>
                </div>
            </div>

            <h1 className="title">Challenges</h1>
            <p className="subtitle">Complete quests to earn tokens!</p>

            {error && <div className="error-message">{error}</div>}

            <div className="quest-list">
                {quests.map((quest) => (
                    <div
                        key={quest.id}
                        className={`card quest-card quest-card--${getStatusClass(quest)}`}
                    >
                        <div className="quest-header">
                            <div className="quest-icon">
                                {getQuestIcon(quest.id)}
                            </div>
                            <div className="quest-info">
                                <h3>{quest.title}</h3>
                                <p className="quest-description">{quest.description}</p>
                            </div>
                        </div>
                        <div className="quest-meta">
                            <div className="quest-tags">
                                {getResetLabel(quest) && (
                                    <span className="quest-tag quest-tag-reset">
                                        {getResetLabel(quest)}
                                    </span>
                                )}
                            </div>
                            <div className="quest-reward">
                                <span className="token-amount">+{quest.reward} 🪙</span>
                            </div>
                        </div>

                        <div className="quest-progress">
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${getProgressPercentage(quest)}%` }}
                                />
                            </div>
                            <div className="progress-text">
                                {quest.progress}/{quest.target} • {Math.round(getProgressPercentage(quest))}%
                            </div>
                        </div>

                        {quest.completed && !quest.claimed && (
                            <button
                                className="btn btn-primary quest-claim-btn"
                                onClick={() => handleClaimReward(quest.id)}
                                disabled={claiming === quest.id}
                            >
                                {claiming === quest.id ? 'Claiming...' : 'Claim Reward'}
                            </button>
                        )}

                        {quest.claimed && (
                            <div className="quest-claimed">
                                Claimed
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {quests.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        No quests available at the moment. Check back later!
                    </p>
                </div>
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
                Back to Lobby
            </button>
        </div>
    );
}

export default Quests;
