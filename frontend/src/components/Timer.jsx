import { useState, useEffect, useRef } from 'react';

function Timer({ seconds, onComplete, warning = 10, danger = 5 }) {
    const [timeLeft, setTimeLeft] = useState(seconds);
    const intervalRef = useRef(null);
    const secondsRef = useRef(seconds);

    // Update seconds ref when it changes
    useEffect(() => {
        secondsRef.current = seconds;
    }, [seconds]);

    useEffect(() => {
        // Clear any existing interval first
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Reset time to the initial seconds value immediately
        setTimeLeft(seconds);

        // Create new interval
        intervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                // Use the ref to get the current seconds value to avoid stale closures
                const currentSeconds = secondsRef.current;
                if (prev <= 1) {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    onComplete?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [seconds, onComplete]);

    let className = 'timer';
    if (timeLeft <= danger) {
        className += ' danger';
    } else if (timeLeft <= warning) {
        className += ' warning';
    }

    const percentage = (timeLeft / seconds) * 100;

    return (
        <div className="timer-section">
            <div className={className}>
                {timeLeft}s
            </div>
            <div className="timer-progress-container">
                <div
                    className={`timer-progress-bar ${timeLeft <= danger ? 'danger' : timeLeft <= warning ? 'warning' : ''}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

export default Timer;
