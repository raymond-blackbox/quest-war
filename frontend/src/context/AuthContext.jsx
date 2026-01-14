import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { auth } from '../services/firebase';
import { onIdTokenChanged } from 'firebase/auth';
import logger from '../utils/logger';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [player, setPlayer] = useState(() => {
        const saved = sessionStorage.getItem('player');
        return saved ? JSON.parse(saved) : null;
    });
    const [authReady, setAuthReady] = useState(false);

    // Handle Firebase Auth state and token syncing
    useEffect(() => {
        const unsubscribe = onIdTokenChanged(auth, async (user) => {
            if (user) {
                try {
                    const idToken = await user.getIdToken();
                    logger.debug('[AUTH DEBUG] Firebase user changed:', {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName
                    });
                    api.setToken(idToken);

                    // Clear stale player data if Firebase UID doesn't match stored player
                    const savedPlayer = sessionStorage.getItem('player');
                    if (savedPlayer) {
                        const parsed = JSON.parse(savedPlayer);
                        if (parsed.id !== user.uid) {
                            logger.warn('[AUTH DEBUG] Stored player ID mismatch - clearing stale data', {
                                storedId: parsed.id,
                                firebaseUid: user.uid
                            });
                            sessionStorage.removeItem('player');
                            setPlayer(null);
                        }
                    }
                } catch (err) {
                    logger.error('Failed to get ID token:', err);
                    api.setToken(null);
                }
            } else {
                logger.debug('[AUTH DEBUG] No Firebase user - signed out');
                api.setToken(null);
                // Clear player data on sign out
                sessionStorage.removeItem('player');
                setPlayer(null);
            }
            setAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (player) {
            sessionStorage.setItem('player', JSON.stringify(player));
        } else {
            sessionStorage.removeItem('player');
        }
    }, [player]);

    const login = useCallback((playerData) => {
        setPlayer(playerData);
    }, []);

    const logout = useCallback(() => {
        setPlayer(null);
    }, []);

    const updateTokens = useCallback((tokens) => {
        setPlayer(prev => {
            if (!prev) return prev;
            return { ...prev, tokens: Number(tokens) };
        });
    }, []);

    const refreshPlayer = useCallback((playerData) => {
        if (!playerData) return;
        setPlayer(prev => {
            const sanitizedTokens = Number(playerData.tokens ?? prev?.tokens ?? 0);
            if (!prev) {
                return { ...playerData, tokens: sanitizedTokens };
            }
            return { ...prev, ...playerData, tokens: sanitizedTokens };
        });
    }, []);

    return (
        <AuthContext.Provider value={{ player, login, logout, updateTokens, refreshPlayer, authReady }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
