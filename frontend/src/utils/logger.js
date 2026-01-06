const isProduction = import.meta.env.PROD;

const logger = {
    info: (...args) => {
        if (!isProduction) {
            console.log(...args);
        }
    },
    debug: (...args) => {
        if (!isProduction) {
            console.debug(...args);
        }
    },
    warn: (...args) => {
        if (!isProduction) {
            console.warn(...args);
        }
    },
    error: (...args) => {
        // Keep errors even in production for debugging field issues
        console.error(...args);
    }
};

export default logger;
