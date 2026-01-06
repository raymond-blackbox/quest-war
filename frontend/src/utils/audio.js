import logger from './logger';

/**
 * Audio utility for Game Effects
 */

// Singleton AudioContext
let audioContext = null;

const getAudioContext = () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
};

/**
 * Play a ticking sound using an oscillator
 */
export const playTickSound = () => {
    try {
        const ctx = getAudioContext();

        // If context is suspended (browser policy), try to resume
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // High frequency ticking sound
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);

        // Short envelope
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        logger.error("Audio play failed", e);
    }
};

/**
 * Play a countdown beep or start sound
 * @param {number|string} type - 3, 2, 1 or "Start"
 */
export const playCountdownBeep = (type) => {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === "Start") {
            // "GO" sound - Higher pitch / slightly longer
            osc.frequency.setValueAtTime(880, now); // A5
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // Ramp up

            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

            osc.start(now);
            osc.stop(now + 0.4);
        } else {
            // "3, 2, 1" sound - Short beep
            // Using a lower pitch for the count
            osc.frequency.setValueAtTime(440, now); // A4

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch (e) {
        logger.error("Audio play failed", e);
    }
};

/**
 * Play correct answer sound
 * Plays from public/sounds/correct.mp3
 */
export const playCorrectSound = () => {
    try {
        const audio = new Audio('/sounds/positive.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => logger.error("Could not play correct sound:", e));
    } catch (e) {
        logger.error("Audio error:", e);
    }
};

/**
 * Play win sound
 * Plays from public/sounds/win.mp3
 */
export const playWinSound = () => {
    try {
        const audio = new Audio('/sounds/win.mp3');
        audio.volume = 0.6;
        audio.play().catch(e => logger.error("Could not play win sound:", e));
    } catch (e) {
        logger.error("Audio error:", e);
    }
};

/**
 * Play lose sound
 * Plays from public/sounds/lose.mp3
 */
export const playLoseSound = () => {
    try {
        const audio = new Audio('/sounds/lose.mp3');
        audio.volume = 0.7;
        audio.play().catch(e => logger.error("Could not play lose sound:", e));
    } catch (e) {
        logger.error("Audio error:", e);
    }
};

/**
 * Play quest claim sound
 * Plays from public/sounds/questClaim.mp3
 */
export const playQuestClaimSound = () => {
    try {
        const audio = new Audio('/sounds/questClaim.mp3');
        audio.volume = 0.4;
        audio.play().catch(e => logger.error("Could not play quest claim sound:", e));
    } catch (e) {
        logger.error("Audio error:", e);
    }
};
