import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { subscribeToRoom, unsubscribeFromRoom, onDisconnect, ref, database, set } from '../services/firebase';
import PlayerList from '../components/PlayerList';

function Room() {
    const { roomId } = useParams();
    const { player } = useAuth();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);


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
                navigate(`/game/${roomId}`);
                return;
            }

            setRoom(roomData);

            // Handle presence/disconnect logic
            // Handle presence/disconnect logic
            const presenceRef = ref(database, `rooms/${roomId}/presence/${player.id}`);
            set(presenceRef, true);
            connectedDisconnectRef = onDisconnect(presenceRef);
            connectedDisconnectRef.remove();

            if (roomData.hostId === player.id) {
                // Host: remove entire room on disconnect (Best effort)
                disconnectRef = onDisconnect(ref(database, `rooms/${roomId}`));
                disconnectRef.remove();
            } else if (roomData.players?.[player.id]) {
                // Player: remove self on disconnect (Best effort, only works if waiting)
                disconnectRef = onDisconnect(ref(database, `rooms/${roomId}/players/${player.id}`));
                disconnectRef.remove();
            }
        });

        return () => {
            unsubscribeFromRoom(roomRef);
            // Cancel onDisconnect when component unmounts (e.g. user navigates away safely)
            if (disconnectRef) {
                disconnectRef.cancel();
            }
            // Also cancel connected status disconnect? Or set it to false immediately?
            // If user navigates away, they ARE disconnected from the room in a sense.
            // But if they navigate to Game, we want to KEEP connected=true.
            // Current logic in lines 26-33 handles navigation to game.

            // If we are unmounting and NOT going to game...
            // Actually, cancel() just cancels the *server-side* trigger.
            // The user is still online.
            if (disconnectRef) disconnectRef.cancel();
            // Do NOT cancel connectedDisconnectRef. 
            // If the user closes the tab, we want this to fire. 
            // If they navigate away, it will fire and set connected=false, which is acceptable (they left the room context).
            // Main issue is ensuring it doesn't break if we navigate to Game, but Game should set it back to true.
            // However, react useEffect cleanup runs BEFORE the next component effect.
            // So: Room unmounts -> cancel() (IF we kept it) -> Game mounts -> set(true).
            // If we REMOVE cancel(): Room unmounts -> Handler stays active -> Game mounts -> set(true).
            // If connection drops later: Handler fires?
            // Yes.
            // BUT Game.jsx should probably OVERWRITE the handler or manage its own independent one.
            // Since the path is the same `rooms/.../connected`, replacing the onDisconnect listener is good.
            // Wait, does defining a NEW onDisconnect replace the old one for the same path?
            // "You can establish multiple onDisconnect() operations for a single location."
            // So they will stack.
            // Room sets one. Game sets one. Drop -> Both fire. Both set false. Fine.
            // BUT if we navigate Room -> Lobby -> Drop. 
            // Room handler fires. Sets false. Fine.

            // So, removing cancel() is SAFE and CORRECT for tracking "active connection".
            // if (connectedDisconnectRef) connectedDisconnectRef.cancel();
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

    const roundSeconds = room?.settings?.roundSeconds ?? room?.roundSeconds ?? 10;
    const questionsCount = room?.settings?.questionsCount ?? room?.totalQuestions ?? 10;
    const questionDifficulty = room?.settings?.questionDifficulty ?? room?.questionDifficulty ?? 'medium';

    const DIFFICULTY_LABELS = {
        easy: 'Easy Math',
        medium: 'Medium Math',
        hard: 'Hard Math'
    };

    const displayedRoomName = isHost && room?.hostPassword
        ? `${room.name} (${room.hostPassword})`
        : room?.name;

    const handleToggleReady = async () => {
        try {
            await api.toggleReady(roomId, player.id, !isReady);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleStartGame = async () => {
        setLoading(true);
        setError('');
        try {
            await api.startGame(roomId, player.id);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLeaveRoom = async () => {
        try {
            await api.leaveRoom(roomId, player.id);
            navigate('/lobby');
        } catch (err) {
            console.error('Failed to leave room:', err);
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
