const truncateDisplayName = (value) => {
    if (!value) return 'Unknown';
    const trimmed = value.trim();
    if (trimmed.length <= 8) return trimmed;
    return `${trimmed.slice(0, 8)}..`;
};

function PlayerList({ players, hostId, currentPlayerId, showScores = false }) {
    if (!players) return null;

    const playerArray = Object.entries(players).map(([id, data]) => ({
        id,
        ...data
    }));

    // Sort by score if showing scores
    if (showScores) {
        playerArray.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    return (
        <ul className="player-list">
            {playerArray.map((player, index) => (
                <li
                    key={player.id}
                    className={`player-item ${player.id === currentPlayerId ? 'me' : ''}`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                >
                    <div className="player-name">
                        {truncateDisplayName(player.displayName || player.username)}
                        <div className="badge-group">
                            {player.id === hostId && (
                                <span className="host-badge">Host</span>
                            )}
                            {player.id === currentPlayerId }
                        </div>
                    </div>
                    {showScores ? (
                        <span className="player-score">{player.score || 0}</span>
                    ) : (
                        <span className={`ready-badge ${player.ready ? 'ready' : 'not-ready'}`}>
                            {player.ready ? '✓ Ready' : 'Waiting'}
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}

export default PlayerList;
