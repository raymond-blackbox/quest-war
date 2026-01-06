import { describe, it, expect, vi } from 'vitest';
import { app } from './index';

describe('index', () => {
    it('should be defined', () => {
        expect(app).toBeDefined();
    });
});
