
/**
 * A custom store for express-rate-limit that uses Firebase Realtime Database
 * to share rate limit state across multiple server instances.
 */
export class DistributedRateLimitStore {
    constructor(getDb, options = {}) {
        this.getDb = getDb;
        this.prefix = options.prefix || 'ratelimits';
        this.windowMs = null;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    async increment(key) {
        if (!this.windowMs) throw new Error('Store not initialized');

        const now = Date.now();
        const windowId = Math.floor(now / this.windowMs);
        const safeKey = key.replace(/[.$#\[\]\/]/g, '_');

        const db = this.getDb();
        if (!db) {
            console.error('[RATELIMIT] Error: Realtime Database is not initialized.');
            return { totalHits: 0, resetTime: new Date(now + this.windowMs) };
        }

        try {
            const ref = db.ref(`${this.prefix}/${windowId}/${safeKey}`);
            const result = await ref.transaction((current) => (current || 0) + 1);
            return {
                totalHits: result.snapshot.val(),
                resetTime: new Date((windowId + 1) * this.windowMs)
            };
        } catch (err) {
            console.error('[RATELIMIT] Distributed store failed, falling back:', err);
            return { totalHits: 1, resetTime: new Date(now + this.windowMs) };
        }
    }

    async decrement(key) {
        const db = this.getDb();
        if (!this.windowMs || !db) return;
        try {
            const windowId = Math.floor(Date.now() / this.windowMs);
            const safeKey = key.replace(/[.$#\[\]\/]/g, '_');
            const ref = db.ref(`${this.prefix}/${windowId}/${safeKey}`);
            await ref.transaction((current) => (!current || current <= 0) ? 0 : current - 1);
        } catch (err) {
            console.error('[RATELIMIT] Decrement failed:', err);
        }
    }

    async resetKey(key) {
        const db = this.getDb();
        if (!this.windowMs || !db) return;
        try {
            const windowId = Math.floor(Date.now() / this.windowMs);
            const safeKey = key.replace(/[.$#\[\]\/]/g, '_');
            await db.ref(`${this.prefix}/${windowId}/${safeKey}`).remove();
        } catch (err) {
            console.error('[RATELIMIT] Reset failed:', err);
        }
    }
}
