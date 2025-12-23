import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { signInWithGoogle, signInWithCustomAuthToken, loginWithEmail, registerWithEmail, sendVerificationEmail, resetPassword } from '../services/firebase';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { idToken, user } = isRegistering
                ? await registerWithEmail(email.trim(), password)
                : await loginWithEmail(email.trim(), password);

            if (isRegistering) {
                await sendVerificationEmail();
                setMessage('A verification email has been sent. Please check your inbox.');
                setLoading(false); // Stop loading after sending verification email
                return; // Prevent immediate login after registration
            } else if (!user.emailVerified) {
                setError('Please verify your email address before logging in.');
                setLoading(false); // Stop loading if email not verified
                return;
            }

            const player = await api.loginWithFirebase(idToken);
            if (player.firebaseCustomToken) {
                await signInWithCustomAuthToken(player.firebaseCustomToken);
            }
            login(player);
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
            navigate('/lobby');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Please enter your email address first.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await resetPassword(email.trim());
            setMessage('Password reset email sent. Please check your inbox.');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to send reset email');
        } finally {
            setLoading(true); // Keep loading state or reset
            setTimeout(() => setLoading(false), 2000);
        }
    };

    const handleGoogleAuth = async () => {
        setError('');
        setLoading(true);
        try {
            const { idToken } = await signInWithGoogle();
            const player = await api.loginWithFirebase(idToken);
            if (player.firebaseCustomToken) {
                await signInWithCustomAuthToken(player.firebaseCustomToken);
            }
            login(player);
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
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
                    <div className="auth-toggle">
                        <button
                            type="button"
                            className={!isRegistering ? 'active' : ''}
                            onClick={() => setIsRegistering(false)}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            className={isRegistering ? 'active' : ''}
                            onClick={() => setIsRegistering(true)}
                        >
                            Sign Up
                        </button>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {message && <div className="success-message" style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{message}</div>}

                    <form onSubmit={handleEmailAuth} className="login-form">
                        <div className="form-group">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="form-input"
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group" style={{ position: 'relative' }}>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="form-input"
                                disabled={loading}
                                minLength={6}
                            />
                            {!isRegistering && (
                                <button
                                    type="button"
                                    className="btn-link"
                                    onClick={handleForgotPassword}
                                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', padding: '0.25rem' }}
                                    disabled={loading}
                                >
                                    Forgot?
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Login')}
                        </button>
                    </form>

                    <div className="divider">OR</div>

                    <div className="google-auth-container">
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
                    </div>

                    <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Notice: Competitive play requires a verified account.
                    </small>
                </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
                v1.2.8 (Add Win & Lose Sound)
            </div>
        </div>

    );
}

export default Login;
