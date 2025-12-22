import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { signInWithGoogle, signInWithCustomAuthToken } from '../services/firebase';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const player = await api.login(username.trim(), password);
            if (player.firebaseCustomToken) {
                await signInWithCustomAuthToken(player.firebaseCustomToken);
            }
            login(player);
            navigate('/lobby');
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setError('');
        setLoading(true);
        try {
            const { idToken } = await signInWithGoogle();
            const player = await api.loginWithGoogle(idToken);
            if (player.firebaseCustomToken) {
                await signInWithCustomAuthToken(player.firebaseCustomToken);
            }
            login(player);
            navigate('/lobby');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Google sign-in failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="animate-fade-in">
                <h1 className="logo">⚔️ Quest War</h1>
                <p className="subtitle">Battle your friends and gain token for Avatar!</p>
                <div className="card">
                    <h2 className="title" style={{ fontSize: '1rem' }}>Login with :</h2>
                    <br></br>
                    {error && <div className="error-message">{error}</div>}

                    <button
                        type="button"
                        className="btn btn-google"
                        onClick={handleGoogleAuth}
                        disabled={loading}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 48 48"
                            width="22"
                            height="22"
                        >
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.7 30.47 0 24 0 14.62 0 6.44 5.38 2.45 13.22l7.98 6.2C12.43 13.02 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.1 24.5c0-1.59-.14-3.12-.41-4.59H24v8.69h12.35c-.53 2.84-2.15 5.26-4.57 6.88l7.02 5.45C43.56 36.14 46.1 30.83 46.1 24.5z" />
                            <path fill="#FBBC05" d="M10.43 28.02c-.48-1.43-.75-2.96-.75-4.52s.27-3.09.75-4.52l-7.98-6.2C.88 15.42 0 19.12 0 23.5s.88 8.08 2.45 11.72l7.98-6.2z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.02-5.45c-2.04 1.37-4.66 2.18-8.88 2.18-6.26 0-11.57-3.52-13.57-8.52l-7.98 6.2C6.44 42.62 14.62 48 24 48z" />
                            <path fill="none" d="M0 0h48v48H0z" />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="social-divider">
                        <span />
                        <p>or use a Quest War account</p>
                        <span />
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                type="text"
                                className="input"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                    onClick={() => setShowPassword(prev => !prev)}
                                >
                                    <svg
                                        className="password-eye"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M2 12c2.6-4.5 6.5-7 10-7s7.4 2.5 10 7c-2.6 4.5-6.5 7-10 7s-7.4-2.5-10-7z"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="3"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                        />
                                        {!showPassword && (
                                            <path
                                                d="M3.5 4.5L20 21"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                            />
                                        )}
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Verifying...' : 'Enter Battle'}
                        </button>
                    </form>

                    <small style={{ display: 'block', marginTop: '1rem', color: 'var(--text-secondary)' }}>
                        Tip: use the seeded hero accounts or sign in with Google.
                    </small>
                </div>
            </div>
        </div>
    );
}

export default Login;
