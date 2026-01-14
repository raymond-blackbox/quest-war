import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { subscribeToRoom, unsubscribeFromRoom, onDisconnect, ref, database, set } from '../services/firebase';
import PlayerList from '../components/PlayerList';
import logger from '../utils/logger';

function Room() {
    const { roomId } = useParams();
    const { player } = useAuth();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Track if disconnect handlers have been set up to prevent re-registration
    const disconnectSetupRef = useRef({ done: false, isHost: null });


    useEffect(() => {
        let disconnectRef = null;
        let connectedDisconnectRef = null;

        const roomRef = subscribeToRoom(roomId, (roomData) => {
            if (!roomData) {
                navigate('/lobby');
                return;
            }

            if (roomData.status === 'starting' || roomData.status === 'playing') {
                // If game starting/playing, cancel disconnect op if any, so room isn't deleted on navigation
                if (disconnectRef) {
                    disconnectRef.cancel();
                    disconnectRef = null;
                }
                if (connectedDisconnectRef) {
                    connectedDisconnectRef.cancel();
                    connectedDisconnectRef = null;
                }
                // Reset for next time room enters waiting
                disconnectSetupRef.current = { done: false, isHost: null };
                navigate(`/game/${roomId}`);
                return;
            }

            setRoom(roomData);

            // Handle presence - this needs to happen every time to maintain presence
            const presenceRef = ref(database, `rooms/${roomId}/presence/${player.id}`);
            set(presenceRef, true);

            // Only set up presence disconnect handler once
            if (!connectedDisconnectRef) {
                connectedDisconnectRef = onDisconnect(presenceRef);
                connectedDisconnectRef.remove();
            }

            // Determine if this player is the host based on CURRENT room data
            const isHost = roomData.hostId === player.id;
            const isPlayerInRoom = !!roomData.players?.[player.id];

            // Only set up disconnect handlers ONCE, or if host status changed
            if (!disconnectSetupRef.current.done || disconnectSetupRef.current.isHost !== isHost) {
                // Cancel any existing disconnect handler before setting a new one
                if (disconnectRef) {
                    disconnectRef.cancel();
                    disconnectRef = null;
                }

                if (isHost) {
                    // Host: remove entire room on disconnect (Best effort)
                    disconnectRef = onDisconnect(ref(database, `rooms/${roomId}`));
                    disconnectRef.remove();
                } else if (isPlayerInRoom) {
                    // Player: remove self on disconnect (Best effort, only works if waiting)
                    disconnectRef = onDisconnect(ref(database, `rooms/${roomId}/players/${player.id}`));
                    disconnectRef.remove();
                }

                disconnectSetupRef.current = { done: true, isHost };
            }
        });

        return () => {
            unsubscribeFromRoom(roomRef);
            if (disconnectRef) {
                disconnectRef.cancel();
            }
            if (connectedDisconnectRef) {
                connectedDisconnectRef.cancel();
            }
            // Reset on unmount
            disconnectSetupRef.current = { done: false, isHost: null };
        };
    }, [roomId, navigate, player.id]);


    const isHost = room?.hostId === player.id;
    const isSolo = room?.isSolo === true;
    const myData = room?.players?.[player.id];
    const isReady = myData?.ready || false;
    const presence = room?.presence || {};
    const rawPlayers = room?.players || {};
    const players = {};
    Object.entries(rawPlayers).forEach(([pid, p]) => {
        players[pid] = {
            ...p,
            connected: presence[pid] === true
        };
    });
    const playerIds = Object.keys(players);
    const allReady = isSolo ? playerIds.length === 1 : playerIds.length > 1 && playerIds.every(id => players[id].ready);

    const questionsCount = room?.settings?.questionsCount ?? room?.totalQuestions ?? 10;
    const questionDifficulty = room?.settings?.questionDifficulty ?? room?.questionDifficulty ?? 'medium';

    const DIFFICULTY_LABELS = {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard'
    };

    const GAME_TYPE_LABELS = {
        math: '🔢 Math Challenge',
        science: '🔬 Science Challenge'
    };

    const displayedRoomName = isHost && room?.hostPassword
        ? `${room.name} (${room.hostPassword})`
        : room?.name;

    const handleToggleReady = async () => {
        try {
            await api.toggleReady(roomId, !isReady);

        } catch (err) {
            setError(err.message);
        }
    };

    const handleStartGame = async () => {
        setLoading(true);
        setError('');
        try {
            await api.startGame(roomId);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLeaveRoom = async () => {
        try {
            await api.leaveRoom(roomId);

            navigate('/lobby');
        } catch (err) {
            logger.error('Failed to leave room:', err);
            navigate('/lobby');
        }
    };

    if (!room) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--spacing-2xl)' }}>
                <div className="animate-pulse" style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>
                    Loading room...
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ paddingTop: 'var(--spacing-md)' }}>
            <div className="animate-fade-in">
                <h1 className="title">{displayedRoomName}</h1>

                <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
                    <div style={{
                        display: 'flex',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-md)',
                        justifyContent: 'center',
                        flexWrap: 'wrap'
                    }}>
                        <div className="room-badge">
                            <div className="badge-text">
                                <span className="label">Mode</span>
                                <span className="value">
                                    {GAME_TYPE_LABELS[room?.settings?.gameType] || GAME_TYPE_LABELS[room?.gameType] || '🔢 Math Challenge'}
                                </span>
                            </div>
                        </div>
                        <div className="room-badge">
                            <div className="badge-text">
                                <span className="label">Difficulty</span>
                                <span className="value">{DIFFICULTY_LABELS[questionDifficulty] || 'Medium'}</span>
                            </div>
                        </div>
                        <div className="room-badge">
                            <div className="badge-text">
                                <span className="label">Questions</span>
                                <span className="value">{questionsCount}</span>
                            </div>
                        </div>
                    </div>

                    <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                        Players ({playerIds.length})
                    </h3>

                    <PlayerList players={players} hostId={room.hostId} currentPlayerId={player.id} />
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="room-actions">
                    <div className="ready-leave-grid">
                        {!isSolo && (
                            <button
                                className={`btn ${isReady ? 'btn-secondary' : 'btn-success'}`}
                                onClick={handleToggleReady}
                            >
                                {isReady ? 'Cancel Ready' : '✓ Ready'}
                            </button>
                        )}
                        <button
                            className="btn btn-secondary"
                            onClick={handleLeaveRoom}
                            style={isSolo ? { gridColumn: '1 / -1' } : undefined}
                        >
                            ← Leave Room
                        </button>
                    </div>

                    {isHost && (
                        <button
                            className="btn btn-accent animate-glow"
                            onClick={handleStartGame}
                            disabled={!allReady || loading}
                            style={{ opacity: allReady ? 1 : 0.5 }}
                        >
                            {loading
                                ? 'Starting...'
                                : isSolo
                                    ? 'Start Solo Game'
                                    : playerIds.length < 2
                                        ? 'Need 2+ Players'
                                        : allReady
                                            ? '🚀 Start Game!'
                                            : 'Waiting for players...'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Room;
