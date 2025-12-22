import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

function Profile() {
    const { player, refreshPlayer } = useAuth();
    const [displayName, setDisplayName] = useState(player?.displayName || player?.username || '');
    const [status, setStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        setDisplayName(player?.displayName || player?.username || '');
    }, [player?.displayName, player?.username]);

    useEffect(() => {
        let isMounted = true;
        const loadProfile = async () => {
            if (!player?.id) {
                setLoadingProfile(false);
                return;
            }
            try {
                const latest = await api.getProfile(player.id);
                if (isMounted) {
                    refreshPlayer(latest);
                    setDisplayName(latest.displayName || latest.username || '');
                }
            } catch (error) {
                if (isMounted) {
                    // Silent fail on load or log to console
                    console.error('Failed to load profile:', error);
                }
            } finally {
                if (isMounted) {
                    setLoadingProfile(false);
                }
            }
        };

        loadProfile();
        return () => {
            isMounted = false;
        };
    }, [player?.id, refreshPlayer]);

    const initial = useMemo(() => {
        const source = player?.displayName || player?.username || '?';
        return source.charAt(0).toUpperCase();
    }, [player?.displayName, player?.username]);

    const openModal = () => {
        setNewName(displayName);
        setStatus(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setNewName('');
        setStatus(null);
    };

    const handleConfirm = async () => {
        const trimmedName = newName.trim();
        if (!player?.id || !trimmedName) return;

        // Basic validation
        if (trimmedName.length < 3 || trimmedName.length > 12) {
            setStatus({ type: 'error', message: 'Name must be 3-12 characters.' });
            return;
        }

        if (trimmedName === displayName) {
            closeModal();
            return;
        }

        if ((player.tokens || 0) < 500) {
            setStatus({ type: 'error', message: 'Insufficient tokens.' });
            return;
        }

        setSaving(true);
        setStatus(null);

        try {
            const updated = await api.updateProfile(player.id, { displayName: trimmedName });
            refreshPlayer(updated);
            setDisplayName(updated.displayName);
            closeModal();
            // Show success via global toast or simple alert? For now, we set status but modal closes.
            // Converting status to be shown on main page temporarily or just re-open modal on error?
            // Let's rely on immediate UI update.
        } catch (error) {
            setStatus({ type: 'error', message: error.message || 'Unable to update display name.' });
        } finally {
            setSaving(false);
        }
    };

    if (!player) {
        return null;
    }

    const canAfford = (player.tokens || 0) >= 500;
    const isValidName = newName.trim().length >= 3 && newName.trim().length <= 12;
    const isDifferent = newName.trim() !== displayName;

    // Character Demo Logic
    const [characterIndex, setCharacterIndex] = useState(0);
    const characters = [
        '/assets/male-character.png',
        '/assets/female-character.png'
    ];

    const toggleCharacter = () => {
        setCharacterIndex((prev) => (prev === 0 ? 1 : 0));
    };

    return (
        <div className="container profile-page">
            <div className="profile-grid">
                <div className="profile-details-card">
                    <div className="profile-form">
                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label htmlFor="displayName" style={{ marginBottom: 0 }}>Display Name</label>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.8rem', fontSize: '0.8rem', width: 'auto' }}
                                    onClick={openModal}
                                >
                                    Edit
                                </button>
                            </div>
                            <input
                                id="displayName"
                                type="text"
                                className="input"
                                value={displayName}
                                readOnly
                                disabled
                            />
                            <small className="input-hint">
                                This name appears in rooms, games, and the leaderboard.
                            </small>
                        </div>
                    </div>
                </div>
                <div className="profile-character-card">
                    <div className="character-frame">
                        <div className="character-carousel">
                            <button
                                className="carousel-btn prev"
                                onClick={toggleCharacter}
                            >
                                &#10094;
                            </button>
                            <div className="character-avatar">
                                <img
                                    src={characters[characterIndex]}
                                    alt="Character Avatar"
                                    className="character-img"
                                />
                            </div>
                            <button
                                className="carousel-btn next"
                                onClick={toggleCharacter}
                            >
                                &#10095;
                            </button>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div className="coming-soon-pill" style={{ opacity: 0.7 }}>Coming Soon</div>
                            <p className="character-caption">
                                {characterIndex === 0 ? 'Male Avatar' : 'Female Avatar'} (Demo)
                            </p>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => navigate('/lobby')}
                            style={{ marginTop: 'var(--spacing-xl)' }}
                        >
                            ← Back to Lobby
                        </button>
                    </div>
                </div>


            </div>

            {
                isModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3 className="modal-title">Change Display Name</h3>
                            <div className="modal-body">
                                <p style={{ marginBottom: '1rem' }}>
                                    Changing your display name costs <strong>500 tokens</strong>.
                                    Current balance: 🪙 {player.tokens || 0}
                                </p>

                                <div className="input-group">
                                    <label>New Display Name</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        maxLength={12}
                                        placeholder="Enter new name"
                                        autoFocus
                                    />
                                </div>

                                {status && status.type === 'error' && (
                                    <div className="error-message" style={{ marginBottom: '1rem' }}>
                                        {status.message}
                                    </div>
                                )}
                            </div>
                            <div className="modal-actions">
                                <button
                                    className="btn btn-secondary"
                                    onClick={closeModal}
                                    disabled={saving}
                                    style={{ width: 'auto' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleConfirm}
                                    disabled={saving || !canAfford || !isValidName || !isDifferent}
                                    style={{ width: 'auto' }}
                                >
                                    {saving ? 'Updating...' : 'Confirm (500 Tokens)'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default Profile;
