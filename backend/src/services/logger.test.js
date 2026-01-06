import { describe, it, expect, vi } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
    it('should be defined', () => {
        expect(logger).toBeDefined();
    });
});
