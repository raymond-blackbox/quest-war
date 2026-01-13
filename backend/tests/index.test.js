import { describe, it, expect, vi } from 'vitest';
import './testSetup.js';
import request from 'supertest';
import { app } from '../src/index';

describe('App Entry Point (Index)', () => {
    it('should have health check endpoint', async () => {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
    });

    it('should return 404 for unknown routes', async () => {
        const response = await request(app).get('/api/unknown-route');
        expect(response.status).toBe(404);
    });

    it('should have security headers (Helmet)', async () => {
        const response = await request(app).get('/health');
        expect(response.headers).toHaveProperty('x-dns-prefetch-control');
        expect(response.headers).toHaveProperty('x-frame-options');
        expect(response.headers).toHaveProperty('x-content-type-options');
    });
});
