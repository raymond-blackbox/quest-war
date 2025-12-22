import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

function Navbar() {
    const { player, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [tokenTooltipOpen, setTokenTooltipOpen] = useState(false);
    const profileRef = useRef(null);
    const tokensRef = useRef(null);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
            if (tokensRef.current && !tokensRef.current.contains(event.target)) {
                setTokenTooltipOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const condensedTokens = useMemo(() => {
        const value = Number(player?.tokens || 0);
        if (value >= 1_000_000) {
            return `${(value / 1_000_000).toFixed(0).replace(/\.0$/, '')}M`;
        }
        if (value >= 1_000) {
            return `${(value / 1_000).toFixed(0).replace(/\.0$/, '')}K`;
        }
        return value.toString();
    }, [player?.tokens]);

    const isInGame = location.pathname.includes('/game/');

    if (isInGame) return null;

    return (
        <nav className="navbar">
            <div className="navbar-brand" onClick={() => navigate('/lobby')} style={{ cursor: 'pointer' }}>
                ⚔️QuestWar
            </div>

            <div className="navbar-user">
                <button
                    ref={tokensRef}
                    className={`navbar-tokens ${tokenTooltipOpen ? 'open' : ''}`}
                    type="button"
                    onClick={() => setTokenTooltipOpen(prev => !prev)}
                >
                    <span role="img" aria-label="Coins">🪙</span> {condensedTokens}
                    <div className="token-tooltip">
                        <p>Total Tokens</p>
                        <strong>{Number(player?.tokens || 0).toLocaleString()}</strong>
                    </div>
                </button>
                <div className={`navbar-profile ${menuOpen ? 'open' : ''}`} ref={profileRef}>
                    <button
                        className="navbar-profile-trigger"
                        type="button"
                        onClick={() => setMenuOpen(prev => !prev)}
                    >
                        <span className="navbar-username">{player?.displayName || player?.username}</span>
                        <span className="navbar-caret">▾</span>
                    </button>
                    <div className="navbar-profile-menu">
                        <button
                            className="navbar-menu-item"
                            onClick={() => {
                                navigate('/profile');
                                setMenuOpen(false);
                            }}
                        >
                            Profile
                        </button>
                        <button
                            className="navbar-menu-item"
                            onClick={() => {
                                navigate('/transactions');
                                setMenuOpen(false);
                            }}
                        >
                            Transactions
                        </button>
                        <button className="navbar-menu-item" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
