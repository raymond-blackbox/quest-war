import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { subscribeToLobbyRooms, unsubscribeFromRoom } from '../services/firebase';

function Lobby() {
    const [rooms, setRooms] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [joinPassword, setJoinPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [difficultyFilter, setDifficultyFilter] = useState('all');
    const [fabVisible, setFabVisible] = useState(true);
    const lastScrollY = useRef(0);
    const { player, refreshPlayer } = useAuth();
    const navigate = useNavigate();

    // Difficulty options (used for both create room and filter)
    const DIFFICULTY_OPTIONS = [
        { value: 'easy', label: 'Easy Math' },
        { value: 'medium', label: 'Medium Math' },
        { value: 'hard', label: 'Hard Math' }
    ];
    const QUESTION_COUNT_OPTIONS = [10, 20, 30, 40];

    // Create room form state
    const [roomName, setRoomName] = useState('');
    const [roomPassword, setRoomPassword] = useState('');

    const [delaySeconds] = useState(2);
    const [questionsCount, setQuestionsCount] = useState(QUESTION_COUNT_OPTIONS[0]);
    const [questionDifficulty, setQuestionDifficulty] = useState(DIFFICULTY_OPTIONS[0].value);

    // Handle scroll to show/hide FAB
    const handleScroll = useCallback(() => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
            // Scrolling down
            setFabVisible(false);
            setShowFilter(false);
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
        syncPlayer();
        const lobbyRef = subscribeToLobbyRooms(setRooms);
        return () => {
            unsubscribeFromRoom(lobbyRef);
        };
    }, []);

    const syncPlayer = async () => {
        if (!player?.id) return;
        try {
            const latestData = await api.getProfile(player.id);
            refreshPlayer(latestData);
        } catch (err) {
            console.error('Failed to sync player:', err);
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

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const trimmedName = roomName.trim();
            if (!trimmedName) {
                setError('Room name is required');
                setLoading(false);
                return;
            }

            if (trimmedName.length > MAX_ROOM_NAME_LENGTH) {
                setError(`Room name must be ${MAX_ROOM_NAME_LENGTH} characters or less`);
                setLoading(false);
                return;
            }

            const room = await api.createRoom({
                name: trimmedName,
                password: roomPassword,
                hostId: player.id,
                hostUsername: player.username,
                hostDisplayName: player.displayName || player.username,
                delaySeconds: Number(delaySeconds),
                questionsCount: Number(questionsCount),
                questionDifficulty
            });
            navigate(`/room/${room.roomId}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };



    const openJoinModal = (room) => {
        if (!room.isPrivate) {
            handleJoinRoom(room.id, '');
            return;
        }
        setSelectedRoom(room);
        setJoinPassword('');
        setError('');
        setShowJoin(true);
    };

    const onJoinSubmit = (e) => {
        e.preventDefault();
        handleJoinRoom(selectedRoom.id, joinPassword);
    };

    const handleJoinRoom = async (roomId, password = '') => {
        if (!player?.id || !player?.username) {
            setError('Player data is not fully loaded. Please refresh or re-login.');
            console.error('Missing player data:', player);
            return;
        }

        setError('');
        setLoading(true);

        const joinData = {
            password: password,
            playerId: player.id,
            playerUsername: player.username,
            playerDisplayName: player.displayName || player.username
        };

        console.log('Sending join request:', { roomId, joinData });

        try {
            await api.joinRoom(roomId, joinData);
            navigate(`/room/${roomId}`);
        } catch (err) {
            setError(err.message);
            // If direct join failed, show modal
            const room = rooms.find(r => r.id === roomId);
            if (room && room.isPrivate) {
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

            {/* Floating Action Buttons */}
            <div className={`fab-container ${fabVisible ? '' : 'fab-hidden'}`}>
                <button className="fab fab-primary" onClick={() => setShowCreate(true)} title="Create Room">
                    +
                </button>
                <div className="fab-filter-wrapper">
                    <button
                        className={`fab fab-secondary ${difficultyFilter !== 'all' ? 'fab-active' : ''}`}
                        onClick={() => setShowFilter(!showFilter)}
                        title="Filter Rooms"
                    >
                        🎯
                    </button>
                    {showFilter && (
                        <div className="fab-dropdown">
                            <button
                                className={`fab-dropdown-item ${difficultyFilter === 'all' ? 'active' : ''}`}
                                onClick={() => {
                                    setDifficultyFilter('all');
                                    setShowFilter(false);
                                }}
                            >
                                All Rooms
                            </button>
                            {DIFFICULTY_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    className={`fab-dropdown-item ${difficultyFilter === opt.value ? 'active' : ''}`}
                                    onClick={() => {
                                        setDifficultyFilter(opt.value);
                                        setShowFilter(false);
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button className="fab fab-secondary" onClick={() => navigate('/leaderboard')} title="Leaderboard">
                    🏆
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
                        {filteredRooms.map((room) => (
                            <div key={room.id} className="room-item" onClick={() => openJoinModal(room)}>
                                <span className={`difficulty-label difficulty-${room.questionDifficulty || 'medium'}`}>
                                    {DIFFICULTY_OPTIONS.find(d => d.value === room.questionDifficulty)?.label || 'Medium Math'}
                                </span>
                                <div className="room-info">
                                    <h3>{room.name}</h3>
                                    <div className="room-meta">
                                        <span className={`status-badge ${room.isPrivate ? 'private' : 'public'}`}>
                                            {room.isPrivate ? '� Private' : '🌐 Public'}
                                        </span>
                                        <span>👤 {truncateDisplayName(room.hostUsername)}</span>
                                        <span>👥 {room.playerCount}</span>
                                    </div>
                                </div>
                                <div className="join-action">
                                    <span>Join</span>
                                    <span className="arrow">→</span>
                                </div>
                            </div>
                        ))}
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
                                <label>Room Name</label>
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

                            <div className="input-group">
                                <label>Room Password (Optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={roomPassword}
                                    onChange={(e) => setRoomPassword(e.target.value)}
                                    placeholder="Leave empty for public room"
                                />
                            </div>



                            <div className="input-group">
                                <label>Question Difficulty</label>
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
                                <label>Number of Questions</label>
                                <select className="select" value={questionsCount} onChange={(e) => setQuestionsCount(Number(e.target.value))}>
                                    {QUESTION_COUNT_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {option} Questions
                                        </option>
                                    ))}
                                </select>
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
