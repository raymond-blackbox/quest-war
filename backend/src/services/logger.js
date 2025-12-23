const isProduction = process.env.NODE_ENV === 'production' || process.env.K_SERVICE;

/**
 * Structured logger for Google Cloud Logging.
 * In production/Cloud Run, outputs JSON with 'severity' field.
 * In development, outputs human-readable strings.
 */
const formatLog = (severity, message, meta) => {
    if (isProduction) {
        // Ensure message is a string for Cloud Logging top-level message
        const msg = typeof message === 'string' ? message : JSON.stringify(message);
        return JSON.stringify({ severity, message: msg, ...meta });
    }
    const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${severity}] ${message}${metaStr}`;
};

const logger = {
    info: (message, meta = {}) => console.log(formatLog('INFO', message, meta)),
    error: (message, meta = {}) => {
        const errorMeta = meta instanceof Error
            ? { stack: meta.stack, message: meta.message }
            : meta;
        console.error(formatLog('ERROR', message, errorMeta));
    },
    warn: (message, meta = {}) => console.warn(formatLog('WARNING', message, meta)),
    debug: (message, meta = {}) => console.log(formatLog('DEBUG', message, meta))
};

export default logger;
