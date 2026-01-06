import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { subscribeToLobbyRooms, unsubscribeFromRoom } from '../services/firebase';
import logger from '../utils/logger';

function Lobby() {
    const [rooms, setRooms] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [joinPassword, setJoinPassword] = useState('');
    const [lobbyError, setLobbyError] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [difficultyFilter, setDifficultyFilter] = useState('all');
    const [fabVisible, setFabVisible] = useState(true);
    const [questReadyCount, setQuestReadyCount] = useState(0);
    const lastScrollY = useRef(0);
    const { player, refreshPlayer, authReady } = useAuth();
    const navigate = useNavigate();

    // Difficulty options (used for both create room and filter)
    const DIFFICULTY_OPTIONS = [
        { value: 'easy', label: 'Easy' },
        { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' }
    ];
    const QUESTION_COUNT_OPTIONS = [10, 20, 30, 40];

    // Game type options
    const GAME_TYPE_OPTIONS = [
        { value: 'math', label: '🔢 Math' },
        { value: 'science', label: '🔬 Science' }
    ];

    // Create room form state
    const [roomName, setRoomName] = useState('');
    const [roomPassword, setRoomPassword] = useState('');
    const [isSolo, setIsSolo] = useState(false);
    const [isPrivateRoom, setIsPrivateRoom] = useState(false);

    const [delaySeconds] = useState(2);
    const [questionsCount, setQuestionsCount] = useState(QUESTION_COUNT_OPTIONS[0]);
    const [questionDifficulty, setQuestionDifficulty] = useState(DIFFICULTY_OPTIONS[0].value);
    const [gameType, setGameType] = useState(GAME_TYPE_OPTIONS[0].value);

    // Handle scroll to show/hide FAB
    const handleScroll = useCallback(() => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
            // Scrolling down
            setFabVisible(false);
        } else {
            // Scrolling up
            setFabVisible(true);
        }
        lastScrollY.current = currentScrollY;
    }, []);

    useEffect(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    useEffect(() => {
        if (!authReady) return;
        syncPlayer();
        logger.info('[LOBBY] Subscribing to rooms...');
        const lobbyRef = subscribeToLobbyRooms((newRooms) => {
            logger.info('[LOBBY] Received rooms:', newRooms.length);
            setRooms(newRooms);
        });
        return () => {
            unsubscribeFromRoom(lobbyRef);
        };
    }, [authReady]);

    useEffect(() => {
        if (authReady && player?.id) {
            loadQuestReadyCount();
        }
    }, [player?.id, authReady]);

    useEffect(() => {
        if (isSolo) {
            setRoomPassword('');
            if (!roomName.trim()) {
                setRoomName('Solo Game');
            }
        } else {
            if (roomName === 'Solo Game') {
                setRoomName('');
            }
        }
    }, [isSolo]);

    const syncPlayer = async () => {
        if (!player?.id) return;
        try {
            const latestData = await api.getProfile(player.id);
            refreshPlayer(latestData);
        } catch (err) {
            logger.error('Failed to sync player:', err);
        }
    };

    const loadQuestReadyCount = async () => {
        if (!player?.id) {
            setQuestReadyCount(0);
            return;
        }
        try {
            const quests = await api.getQuests(player.id);
            const readyCount = quests.filter((quest) => quest.completed && !quest.claimed).length;
            setQuestReadyCount(readyCount);
        } catch (err) {
            logger.error('Failed to load quest notifications:', err);
        }
    };

    // Filter and sort rooms (latest first)
    const filteredRooms = useMemo(() => {
        let result = [...rooms];

        // Filter by difficulty
        if (difficultyFilter !== 'all') {
            result = result.filter(room => room.questionDifficulty === difficultyFilter);
        }

        // Sort by createdAt (latest first)
        result.sort((a, b) => {
            const timeA = a.createdAt || 0;
            const timeB = b.createdAt || 0;
            return timeB - timeA;
        });

        return result;
    }, [rooms, difficultyFilter]);

    const MAX_ROOM_NAME_LENGTH = 15;
    const MAX_ROOM_PLAYERS = 5;

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setError('');
        setLobbyError('');
        setLoading(true);

        try {
            const trimmedName = roomName.trim();
            const resolvedName = trimmedName || (isSolo ? 'Solo Game' : '');
            if (!resolvedName) {
                setError('Room name is required');
                setLoading(false);
                return;
            }

            if (resolvedName.length > MAX_ROOM_NAME_LENGTH) {
                setError(`Room name must be ${MAX_ROOM_NAME_LENGTH} characters or less`);
                setLoading(false);
                return;
            }

            const room = await api.createRoom({
                name: resolvedName,
                password: isSolo ? '' : roomPassword,
                hostId: player.id,
                hostUsername: player.username,
                hostDisplayName: player.displayName || player.username,
                delaySeconds: Number(delaySeconds),
                questionsCount: Number(questionsCount),
                questionDifficulty,
                gameType,
                isSolo: isSolo,
                isPrivate: !isSolo && isPrivateRoom
            });
            navigate(`/room/${room.roomId}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };



    const openJoinModal = (room) => {
        if (room.playerCount >= MAX_ROOM_PLAYERS) {
            setLobbyError(`Room is full (max ${MAX_ROOM_PLAYERS} players).`);
            return;
        }
        setLobbyError('');
        setError('');
        if (!room.isPrivate) {
            handleJoinRoom(room.id, '');
            return;
        }
        setSelectedRoom(room);
        setJoinPassword('');
        setShowJoin(true);
    };

    const onJoinSubmit = (e) => {
        e.preventDefault();
        handleJoinRoom(selectedRoom.id, joinPassword);
    };

    const handleJoinRoom = async (roomId, password = '') => {
        if (!player?.id || !player?.username) {
            setError('Player data is not fully loaded. Please refresh or re-login.');
            logger.error('Missing player data:', player);
            return;
        }

        setError('');
        setLobbyError('');
        setLoading(true);

        const joinData = {
            password: password,
            playerId: player.id,
            playerUsername: player.username,
            playerDisplayName: player.displayName || player.username
        };

        logger.info('Sending join request:', { roomId, joinData });

        try {
            await api.joinRoom(roomId, joinData);
            navigate(`/room/${roomId}`);
        } catch (err) {
            const message = err.message;
            const isRoomFull = message.toLowerCase().includes('room is full');
            if (isRoomFull) {
                if (showJoin) {
                    setError(message);
                } else {
                    setLobbyError(message);
                }
            } else {
                setError(message);
            }
            // If direct join failed, show modal
            const room = rooms.find(r => r.id === roomId);
            if (!isRoomFull && room && room.isPrivate) {
                setSelectedRoom(room);
                setShowJoin(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const truncateDisplayName = (value) => {
        if (!value) return 'Unknown';
        const trimmed = value.trim();
        return trimmed.length > 8 ? `${trimmed.slice(0, 8)}..` : trimmed;
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--spacing-lg)' }}>
            <h1 className="title">Game Lobby</h1>
            <p className="subtitle">Join a quest and start competing!</p>
            {lobbyError && <div className="error-message">{lobbyError}</div>}

            <div className="room-filter-card">
                <div className="room-filter-header">
                    <div>
                        <div className="room-filter-title">Filter rooms</div>
                    </div>

                </div>
                <div className="room-filter-options">
                    <button
                        type="button"
                        className={`room-filter-chip ${difficultyFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setDifficultyFilter('all')}
                    >
                        All
                    </button>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            className={`room-filter-chip ${difficultyFilter === opt.value ? 'active' : ''}`}
                            onClick={() => setDifficultyFilter(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Floating Action Buttons */}
            <div className={`fab-container ${fabVisible ? '' : 'fab-hidden'}`}>
                <button className="fab fab-primary" onClick={() => setShowCreate(true)} title="Create Room">
                    +
                </button>
                <button className="fab fab-secondary" onClick={() => navigate('/leaderboard')} title="Leaderboard">
                    🏆
                </button>
                <button className="fab fab-secondary fab-quest" onClick={() => navigate('/quests')} title="Challenges">
                    🎯
                    {questReadyCount > 0 && (
                        <span className="fab-badge">
                            {questReadyCount > 9 ? '9+' : questReadyCount}
                        </span>
                    )}
                </button>
            </div>

            {
                filteredRooms.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                            {difficultyFilter === 'all' ? 'No rooms available' : 'No rooms match this filter'}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            {difficultyFilter === 'all' ? 'Create a room to start playing!' : 'Try a different filter or create a room!'}
                        </p>
                    </div>
                ) : (
                    <div className="room-list">
                        {filteredRooms.map((room) => {
                            const isRoomFull = room.playerCount >= MAX_ROOM_PLAYERS;
                            return (
                                <div
                                    key={room.id}
                                    className={`room-item ${isRoomFull ? 'room-item-full' : ''}`}
                                    onClick={() => openJoinModal(room)}
                                    aria-disabled={isRoomFull}
                                >
                                    <span className={`difficulty-label difficulty-${room.questionDifficulty || 'medium'}`}>
                                        {GAME_TYPE_OPTIONS.find(g => g.value === room.gameType)?.label || '🔢 Math'} • {DIFFICULTY_OPTIONS.find(d => d.value === room.questionDifficulty)?.label || 'Medium'}
                                    </span>
                                    <div className="room-info">
                                        <h3>{room.name}</h3>
                                        <div className="room-meta">
                                            <span className={`status-badge ${room.isPrivate ? 'private' : 'public'}`}>
                                                {room.isPrivate ? '� Private' : '🌐 Public'}
                                            </span>
                                            <span>👤 {truncateDisplayName(room.hostUsername)}</span>
                                            <span>👥 {room.playerCount}/{MAX_ROOM_PLAYERS}</span>
                                        </div>
                                    </div>
                                    <div className="join-action">
                                        <span>{isRoomFull ? 'Full' : 'Join'}</span>
                                        <span className="arrow">→</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

            {/* Create Room Modal */}
            {showCreate && (
                <div className="result-overlay" onClick={() => setShowCreate(false)}>
                    <div className="card" style={{ width: '90%', maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>Create Room</h2>

                        {error && <div className="error-message">{error}</div>}

                        <form onSubmit={handleCreateRoom}>
                            <div className="input-group">
                                <label>Game Mode</label>
                                <div className="room-filter-options" style={{ justifyContent: 'flex-start' }}>
                                    <button
                                        type="button"
                                        className={`room-filter-chip ${!isSolo ? 'active' : ''}`}
                                        onClick={() => setIsSolo(false)}
                                    >
                                        Multiplayer
                                    </button>
                                    <button
                                        type="button"
                                        className={`room-filter-chip ${isSolo ? 'active' : ''}`}
                                        onClick={() => setIsSolo(true)}
                                    >
                                        Solo (Practice)
                                    </button>
                                </div>
                                {isSolo && (
                                    <small className="input-hint">
                                        Solo games are hidden from the lobby and do not count toward quests or leaderboards.
                                    </small>
                                )}
                            </div>

                            <div className="input-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                                    <label style={{ margin: 0 }}>Room Name</label>
                                    {!isSolo && (
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-xs)',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            color: isPrivateRoom ? 'var(--primary-light)' : 'var(--text-muted)',
                                            lineHeight: 1
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={isPrivateRoom}
                                                onChange={(e) => {
                                                    setIsPrivateRoom(e.target.checked);
                                                    if (!e.target.checked) setRoomPassword('');
                                                }}
                                                style={{
                                                    cursor: 'pointer',
                                                    margin: 0,
                                                    width: '14px',
                                                    height: '14px'
                                                }}
                                            />
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span>🔒</span>
                                                <span style={{ paddingTop: '1px' }}>Private</span>
                                            </span>
                                        </label>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    className="input"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="My Quiz Room"
                                    maxLength={MAX_ROOM_NAME_LENGTH}
                                    required
                                />
                            </div>



                            {!isSolo && isPrivateRoom && (
                                <div className="input-group animate-fade-in">
                                    <label>Room Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{
                                            position: 'absolute',
                                            left: '1rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: 'var(--text-muted)',
                                            zIndex: 1
                                        }}>
                                            🔒
                                        </span>
                                        <input
                                            type="password"
                                            className="input"
                                            style={{ paddingLeft: '2.5rem' }}
                                            value={roomPassword}
                                            onChange={(e) => setRoomPassword(e.target.value)}
                                            placeholder="Set room password"
                                            required={isPrivateRoom}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            )}



                            <div className="input-group">
                                <label>Game Type</label>
                                <select
                                    className="select"
                                    value={gameType}
                                    onChange={(e) => setGameType(e.target.value)}
                                >
                                    {GAME_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                <div className="input-group">
                                    <label>Difficulty</label>
                                    <select
                                        className="select"
                                        value={questionDifficulty}
                                        onChange={(e) => setQuestionDifficulty(e.target.value)}
                                    >
                                        {DIFFICULTY_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="input-group">
                                    <label>Questions</label>
                                    <select className="select" value={questionsCount} onChange={(e) => setQuestionsCount(Number(e.target.value))}>
                                        {QUESTION_COUNT_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Join Room Modal */}
            {showJoin && selectedRoom && (
                <div className="result-overlay" onClick={() => setShowJoin(false)}>
                    <div className="card" style={{ width: '90%', maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>Join Private Room</h2>

                        {error && <div className="error-message">{error}</div>}

                        <form onSubmit={onJoinSubmit}>
                            <div className="input-group">
                                <label>Room Password</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={joinPassword}
                                    onChange={(e) => setJoinPassword(e.target.value)}
                                    placeholder="Enter room password"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowJoin(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Joining...' : 'Join'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Lobby;
