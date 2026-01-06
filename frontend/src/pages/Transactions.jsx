import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger';

function Transactions() {
    const { player, authReady } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadTransactions = useCallback(async () => {
        if (!player?.id) return;

        try {
            setLoading(true);
            setError(null);
            const data = await api.getTransactions(player.id, 15);
            setTransactions(data.transactions || []);
        } catch (err) {
            logger.error('Failed to load transactions:', err);
            setError('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    }, [player?.id]);

    useEffect(() => {
        if (authReady) {
            loadTransactions();
        }
    }, [loadTransactions, authReady]);

    const formatDate = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'earn': return '⬆️';
            case 'spend': return '⬇️';
            case 'revoke': return '↩️';
            default: return '•';
        }
    };

    const getTypeClass = (type) => {
        switch (type) {
            case 'earn': return 'transaction-earn';
            case 'spend': return 'transaction-spend';
            case 'revoke': return 'transaction-revoke';
            default: return '';
        }
    };

    if (!player) {
        return null;
    }

    return (
        <div className="container transactions-page">
            <div className="transactions-header">
                <h1>Transaction History</h1>
                <p className="transactions-subtitle">Your latest 15 token activity log</p>
            </div>

            {loading && (
                <div className="transactions-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading transactions...</p>
                </div>
            )}

            {error && (
                <div className="transactions-error">
                    <p>{error}</p>
                    <button className="btn btn-secondary" onClick={loadTransactions}>
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && transactions.length === 0 && (
                <div className="transactions-empty">
                    <div className="empty-icon">📭</div>
                    <h3>No Transactions Yet</h3>
                    <p>Your token activity will appear here once you start playing games!</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/lobby')}
                    >
                        Go to Lobby
                    </button>
                </div>
            )}

            {!loading && !error && transactions.length > 0 && (
                <div className="transactions-list">
                    {transactions.map((tx) => (
                        <div key={tx.id} className={`transaction-item ${getTypeClass(tx.type)}`}>
                            <div className="transaction-icon">
                                {getTypeIcon(tx.type)}
                            </div>
                            <div className="transaction-details">
                                <div className="transaction-reason">{tx.reason}</div>
                                <div className="transaction-date">{formatDate(tx.createdAt)}</div>
                            </div>
                            <div className="transaction-amount">
                                <span className={`amount ${tx.type}`}>
                                    {tx.type === 'earn' ? '+' : '-'}{tx.amount}
                                </span>
                                <span className="token-icon">🪙</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="transactions-footer">
                <button
                    className="btn btn-secondary"
                    onClick={() => navigate('/lobby')}
                >
                    ← Back to Lobby
                </button>
            </div>
        </div>
    );
}

export default Transactions;
