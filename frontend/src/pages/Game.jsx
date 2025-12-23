import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { playCountdownBeep, playCorrectSound, playWinSound, playLoseSound } from '../utils/audio';

import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { subscribeToRoom, unsubscribeFromRoom, onDisconnect, ref, database, set, remove } from '../services/firebase';
import Timer from '../components/Timer';
import QuestionCard from '../components/QuestionCard';
import PlayerList from '../components/PlayerList';

const truncateDisplayName = (value) => {
    if (!value) return 'Unknown';
    const trimmed = value.trim();
    if (trimmed.length <= 8) return trimmed;
    return `${trimmed.slice(0, 10)}..`;
};

function Game() {
    const { roomId } = useParams();
    const { player, refreshPlayer } = useAuth();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [countdown, setCountdown] = useState(null);
    // Selection state now includes the question context to prevent carry-over
    const [selection, setSelection] = useState({ forQuestion: null, answerIndex: null });
    const [hasSyncedTokens, setHasSyncedTokens] = useState(false);
    const [hasPlayedResultSound, setHasPlayedResultSound] = useState(false);
    const [hasPlayedGameEndSound, setHasPlayedGameEndSound] = useState(false);


    // Derive effective selected answer - only valid if it's for the current question
    const selectedAnswer = useMemo(() => {
        if (selection.forQuestion === room?.questionNumber) {
            return selection.answerIndex;
        }
        return null;
    }, [selection, room?.questionNumber]);

    // Derive showResult directly from room data - always in sync with Firebase
    const showResult = room?.currentQuestion?.answerRevealed === true;

    // Derive hasAnswered - true if we have a local selection or server says we answered
    const hasAnswered = useMemo(() => {
        if (!room?.currentQuestion) return false;
        if (selectedAnswer !== null) return true;

        const myUserId = player?.id;
        if (room.currentQuestion.answeredBy === myUserId) return true;
        if (room.currentQuestion.incorrectAnswers && room.currentQuestion.incorrectAnswers[myUserId]) return true;

        return false;
    }, [room?.currentQuestion, selectedAnswer, player?.id]);
    const winnerBonus = useMemo(() => {
        if (!room?.settings) return 0;
        return Number(room.settings.tokenPerWin || 0);
    }, [room?.settings]);

    useEffect(() => {
        const roomRef = subscribeToRoom(roomId, (data) => {
            if (!data) {
                navigate('/lobby');
                return;
            }

            setRoom(data);
        });

        // Set up presence
        if (player?.id) {
            const presenceRef = ref(database, `rooms/${roomId}/presence/${player.id}`);
            set(presenceRef, true).catch(err => console.error("Presence Set Error:", err));
            const connectedDisconnectRef = onDisconnect(presenceRef);
            connectedDisconnectRef.remove();
        }

        return () => {
            unsubscribeFromRoom(roomRef);
            if (player?.id) {
                const presenceRef = ref(database, `rooms/${roomId}/presence/${player.id}`);
                remove(presenceRef).catch(e => { });
            }
        };
    }, [roomId, navigate, player.id]);

    useEffect(() => {
        if (!room || !player?.id) return;

        if (room.status === 'playing' || room.status === 'starting') {
            setHasSyncedTokens(false);
            return;
        }

        if ((room.status === 'ended' || room.status === 'aborted') && !hasSyncedTokens) {
            const syncTokens = async () => {
                try {
                    const latest = await api.getProfile(player.id);
                    refreshPlayer(latest);
                } catch (err) {
                    console.error('Failed to refresh player tokens:', err);
                } finally {
                    setHasSyncedTokens(true);
                }
            };

            syncTokens();
        }
    }, [room, player?.id, hasSyncedTokens, refreshPlayer]);

    useEffect(() => {
        // If status changes to playing, we definitely want to stop counting down
        if (room?.status === 'playing') {
            setCountdown(null);
            return;
        }

        if (room?.status === 'starting' && countdown === null) {
            setCountdown(3);
            playCountdownBeep(3);

            const interval = setInterval(() => {
                setCountdown((prev) => {
                    if (prev === null) {
                        clearInterval(interval);
                        return null;
                    }
                    if (prev <= 1) {
                        clearInterval(interval);
                        playCountdownBeep("Start");
                        return null;
                    }
                    playCountdownBeep(prev - 1);
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [room?.status]);

    useEffect(() => {
        if (room?.questionNumber) {
            // Reset per-question state
            setHasPlayedResultSound(false);

            // Failsafe: Blur any focused element on question change to break Safari sticky focus
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        }
    }, [room?.questionNumber]);

    const handleAnswer = useCallback(async (answerIndex) => {
        const currentQuestion = room?.currentQuestion;
        if (hasAnswered || currentQuestion?.correctlyAnsweredBy) {
            return;
        }

        // If current player already answered this question incorrectly
        if (currentQuestion?.incorrectAnswers && currentQuestion.incorrectAnswers[player.id]) {
            return;
        }

        const currentQNum = room.questionNumber;
        setSelection({ forQuestion: currentQNum, answerIndex: answerIndex });

        try {
            console.log('[FRONTEND] Sending submitAnswer API code...');
            const res = await api.submitAnswer(roomId, player.id, player.username, answerIndex);
            console.log('[FRONTEND] SubmitAnswer success:', res);
        } catch (err) {
            console.error('[FRONTEND] Failed to submit answer:', err);
            setHasAnswered(false);
        }
    }, [hasAnswered, roomId, player.id, player.username, room?.currentQuestion]);

    // Play sound when result is revealed and user answered correctly
    useEffect(() => {
        if (showResult && room?.currentQuestion && !hasPlayedResultSound) {
            const { correctIndex } = room.currentQuestion;

            console.log('[AUDIO DEBUG]', {
                showResult,
                selectedAnswer,
                correctIndex,
                hasPlayed: hasPlayedResultSound,
                match: selectedAnswer === correctIndex
            });

            if (selectedAnswer !== null && correctIndex !== undefined && correctIndex !== null) {
                if (Number(selectedAnswer) === Number(correctIndex)) {
                    console.log('[AUDIO] Playing correct sound!');
                    playCorrectSound();
                } else {
                    console.log('[AUDIO] Answer incorrect, no sound.');
                }
                setHasPlayedResultSound(true);
            }
        }
    }, [showResult, selectedAnswer, room?.currentQuestion, hasPlayedResultSound]);

    // Play Win/Lose sound when game ends
    useEffect(() => {
        if (!room) return;
        if ((room.status === 'ended' || room.status === 'aborted') && !hasPlayedGameEndSound) {
            if (room.winner === player.id) {
                playWinSound();
            } else {
                playLoseSound();
            }
            setHasPlayedGameEndSound(true);
        }
    }, [room?.status, room?.winner, player.id, hasPlayedGameEndSound]);

    const handleBackToLobby = () => {
        navigate('/lobby');
    };

    const handleQuit = async (e) => {
        if (e) e.stopPropagation();
        if (window.confirm('Are you sure you want to quit this game?')) {
            try {
                await api.quitGame(roomId, player.id);
                navigate('/lobby');
            } catch (err) {
                console.error('Failed to quit game:', err);
                alert('Failed to quit game. Please try again or refresh.');
            }
        }
    };

    if (!room) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--spacing-2xl)' }}>
                <div className="animate-pulse" style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>
                    Loading game...
                </div>
            </div>
        );
    }

    // Starting countdown - only show if status is starting OR we haven't cleared it yet
    if (countdown !== null && room.status === 'starting') {
        return (
            <div className="countdown">
                <div className="countdown-number" key={countdown}>
                    {countdown}
                </div>
            </div>
        );
    }


    // Game ended or aborted
    if (room.status === 'ended' || room.status === 'aborted') {
        const isAborted = room.status === 'aborted';
        const isDraw = room.isDraw;
        const correctAnswerTokens = Number(room.players?.[player.id]?.tokensEarned || 0);
        const isWinner = room.winner === player.id;
        // tokensEarned in RTDB only tracks correct answer tokens
        // Winner bonus is awarded separately at game end by backend
        const winnerBonusEarned = isWinner ? winnerBonus : 0;
        const totalTokensEarned = correctAnswerTokens + winnerBonusEarned;
        const hasTokenEarnings = totalTokensEarned > 0;

        // Calculate player's rank
        let rankIcon = '🥈';
        if (isAborted) {
            rankIcon = '⚠️';
        } else if (isDraw) {
            rankIcon = '🤝';
        } else if (room.players) {
            const sortedPlayers = Object.entries(room.players)
                .map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => (b.score || 0) - (a.score || 0));
            const rank = sortedPlayers.findIndex(p => p.id === player.id) + 1;

            if (rank === 1) rankIcon = '🏆';
            else if (rank === 2) rankIcon = '🥈';
            else if (rank === 3) rankIcon = '🥉';
            else rankIcon = '🎖️';
        }

        return (
            <div className="result-overlay">
                <div className="card result-card animate-fade-in">
                    <button
                        className="btn-close-result"
                        onClick={handleBackToLobby}
                        aria-label="Back to Lobby"
                    >
                        ×
                    </button>
                    <div className={`result-icon ${room.winner === player.id ? 'animate-pulse' : ''}`}>
                        {rankIcon}
                    </div>
                    <div className="result-title">
                        {isAborted ? 'Game Aborted' : isDraw ? 'Game Draw' : 'Game Over!'}
                    </div>

                    {isAborted ? (
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
                            The game was terminated by a player. No tokens awarded.
                        </p>
                    ) : isDraw ? (
                        <div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
                                Result
                            </p>
                            <div className="result-name">It's a Draw!</div>
                            <p style={{ color: 'var(--warning)', marginTop: 'var(--spacing-md)' }}>
                                Multiple players tied for the top score. Winner bonus was not granted.
                            </p>
                        </div>
                    ) : room.winner ? (
                        <div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
                                Winner
                            </p>
                            <div className="result-name">{truncateDisplayName(room.winnerUsername)}</div>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)' }}>No winner this round</p>
                    )}

                    {!isAborted && (
                        <div
                            style={{
                                marginTop: 'var(--spacing-lg)',
                                padding: 'var(--spacing-md)',
                                borderRadius: 'var(--radius-lg)',
                                background: 'rgba(255,255,255,0.04)',
                                color: hasTokenEarnings ? 'var(--success)' : 'var(--text-secondary)'
                            }}
                        >
                            {hasTokenEarnings ? (
                                <p>
                                    🪙 You earned {totalTokensEarned} token{totalTokensEarned === 1 ? '' : 's'}
                                    {winnerBonusEarned > 0 ? ` (${correctAnswerTokens} from answers + ${winnerBonusEarned} winner bonus)` : correctAnswerTokens > 0 ? ' from correct answers' : ''}
                                    .
                                </p>
                            ) : (
                                <p>🪙 No tokens earned this game. Try to answer faster next round!</p>
                            )}
                        </div>
                    )}

                    {!isAborted && (
                        <div style={{ marginTop: 'var(--spacing-md)', maxHeight: '200px', overflowY: 'auto', marginBottom: 'var(--spacing-md)' }}>
                            <PlayerList
                                players={
                                    (() => {
                                        const p = room.presence || {};
                                        const pl = room.players || {};
                                        const merged = {};
                                        Object.entries(pl).forEach(([id, data]) => {
                                            merged[id] = { ...data, connected: p[id] === true };
                                        });
                                        return merged;
                                    })()
                                }
                                hostId={room.hostId}
                                currentPlayerId={player.id}
                                showScores
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const currentQuestion = room.currentQuestion;

    if (!currentQuestion) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--spacing-2xl)' }}>
                <div className="animate-pulse" style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>
                    Preparing next question...
                </div>
            </div>
        );
    }

    return (
        <div className="container game-container" style={{ paddingTop: 'var(--spacing-lg)' }}>
            <div className="timer-section">
                {!showResult && currentQuestion.startedAt ? (
                    <Timer
                        key={`timer-${room.questionNumber}-${currentQuestion.startedAt}`}
                        seconds={
                            room.settings?.roundSeconds ??
                            currentQuestion.roundSeconds ??
                            30
                        }
                    />
                ) : (
                    <div className="card animate-fade-in" style={{ textAlign: 'center', padding: 'var(--spacing-sm)' }}>
                        {currentQuestion.correctlyAnsweredBy ? (
                            <>
                                <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                                    Correct Answer:
                                </p>
                                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', marginBottom: '0.5rem', lineHeight: '1.2' }}>
                                    {currentQuestion.answeredByUsername}
                                </p>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem', lineHeight: '1' }}>⏱️</div>
                                <p style={{ color: 'var(--warning)', fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: '1.2' }}>
                                    {currentQuestion.timeUp ? "Time's up! No one answered correctly." : "Round ending..."}
                                </p>
                            </>
                        )}

                    </div>
                )}
            </div>

            <QuestionCard
                key={room.questionNumber}
                question={currentQuestion.question}
                questionNumber={room.questionNumber}
                totalQuestions={room.totalQuestions}
                options={currentQuestion.options}
                onAnswer={handleAnswer}
                disabled={hasAnswered || showResult}
                selectedAnswer={selectedAnswer}
                correctIndex={currentQuestion.correctIndex}
                showResult={showResult}
                isWaiting={!showResult && hasAnswered}
            />

            <button
                className="btn-quit-mobile"
                onClick={handleQuit}
                aria-label="Quit game"
            >
                ×
            </button>

            <div className="game-footer">
                <div className="scores-section">
                    <h3 className="section-title">
                        Scores
                    </h3>
                    <PlayerList
                        players={
                            (() => {
                                const p = room.presence || {};
                                const pl = room.players || {};
                                const merged = {};
                                Object.entries(pl).forEach(([id, data]) => {
                                    merged[id] = { ...data, connected: p[id] === true };
                                });
                                return merged;
                            })()
                        }
                        hostId={room.hostId}
                        currentPlayerId={player.id}
                        showScores
                    />
                </div>
            </div>
        </div>
    );
}

export default Game;
