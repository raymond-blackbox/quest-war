import { vi } from 'vitest';

/**
 * Mocking strategy for Firebase admin
 */
const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User'
};

export const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue(mockUser),
    createCustomToken: vi.fn().mockResolvedValue('mock-custom-token'),
};

export const mockDoc = {
    exists: true,
    data: vi.fn().mockReturnValue(mockUser),
    get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => mockUser
    }),
    update: vi.fn().mockResolvedValue(true),
    set: vi.fn().mockResolvedValue(true),
};

export const mockCollection = {
    doc: vi.fn().mockReturnValue(mockDoc),
    get: vi.fn().mockResolvedValue({
        forEach: vi.fn(),
        docs: []
    }),
    add: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
};

export const mockFirestore = {
    collection: vi.fn().mockReturnValue(mockCollection),
    doc: vi.fn().mockReturnValue(mockDoc),
};

export const mockRtdb = {
    ref: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
        exists: () => true,
        val: () => ({})
    }),
    update: vi.fn().mockResolvedValue(true),
    push: vi.fn().mockReturnThis(),
    key: 'mock-key',
    child: vi.fn().mockReturnThis(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
};

// Hoist the mocks
vi.mock('../src/services/firebase.js', () => ({
    admin: {
        auth: () => ({
            verifyIdToken: vi.fn().mockResolvedValue({
                uid: 'test-user-id',
                email: 'test@example.com',
                username: 'testuser',
                displayName: 'Test User'
            }),
            createCustomToken: vi.fn().mockResolvedValue('mock-custom-token'),
        }),
        firestore: {
            FieldValue: {
                serverTimestamp: () => 'mock-timestamp'
            }
        },
        database: () => ({
            ref: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
                exists: () => true,
                val: () => ({})
            }),
            update: vi.fn().mockResolvedValue(true),
        })
    },
    initializeFirebase: vi.fn(),
    getFirestore: () => ({
        collection: vi.fn().mockReturnValue({
            doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({
                        uid: 'test-user-id',
                        username: 'testuser',
                        tokens: 100
                    })
                })
            })
        })
    }),
    getRealtimeDb: () => ({
        ref: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
            exists: () => true,
            val: () => ({})
        }),
    })
}));

/**
 * Helper to generate a dummy auth header
 */
export const getAuthHeader = (token = 'valid-token') => {
    return { Authorization: `Bearer ${token}` };
};

export { mockUser };
