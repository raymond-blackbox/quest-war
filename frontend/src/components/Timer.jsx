import { useState, useEffect, useRef } from 'react';
import { playTickSound } from '../utils/audio';

function Timer({ seconds, onComplete, warning = 10, danger = 3 }) {
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

                // Play ticking sound if in danger zone (<= danger seconds)
                if (prev > 1 && prev <= danger + 1) { // +1 because we are about to decrement
                    playTickSound();
                }

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
