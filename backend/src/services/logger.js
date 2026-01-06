const isProduction = process.env.NODE_ENV === 'production' || process.env.K_SERVICE;

/**
 * Structured logger for Google Cloud Logging.
 * In production/Cloud Run, outputs JSON with 'severity' field.
 * In development, outputs human-readable strings.
 */
const formatLog = (severity, message, meta = {}) => {
    const { requestId, ...rest } = meta;
    if (isProduction) {
        const msg = typeof message === 'string' ? message : JSON.stringify(message);
        return JSON.stringify({
            severity,
            message: msg,
            requestId,
            ...rest
        });
    }
    const reqIdStr = requestId ? ` [RID:${requestId}]` : '';
    const metaStr = rest && Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    return `[${severity}]${reqIdStr} ${message}${metaStr}`;
};

const logger = {
    info: (message, meta) => console.log(formatLog('INFO', message, meta)),
    error: (message, meta) => {
        const errorMeta = meta instanceof Error
            ? { stack: meta.stack, message: meta.message }
            : meta;
        console.error(formatLog('ERROR', message, errorMeta));
    },
    warn: (message, meta) => console.warn(formatLog('WARNING', message, meta)),
    debug: (message, meta) => console.log(formatLog('DEBUG', message, meta)),
    // Support for setting a requestId context if needed in the future
};

export default logger;
