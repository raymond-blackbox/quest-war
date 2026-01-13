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

// Helper function for mockDoc, as implied by the provided Code Edit
const makeMockDoc = (id = 'mock-doc-id', data = mockUser) => ({
    id,
    exists: true,
    data: vi.fn().mockReturnValue(data),
    get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => data
    }),
    update: vi.fn().mockResolvedValue(true),
    set: vi.fn().mockResolvedValue(true),
});

export const mockFirestore = {
    collection: vi.fn().mockImplementation(() => {
        const collection = {
            doc: vi.fn().mockImplementation((id) => makeMockDoc(id)),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
                empty: true,
                docs: [],
                forEach: vi.fn(),
            }),
            add: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
        };
        return collection;
    }),
    doc: vi.fn().mockImplementation((id) => makeMockDoc(id)),
    runTransaction: vi.fn().mockImplementation(async (callback) => {
        return callback({
            get: vi.fn().mockImplementation((ref) => (ref.get ? ref.get() : makeMockDoc())),
            update: vi.fn(),
            set: vi.fn(),
            delete: vi.fn(),
        });
    }),
};

export const mockRtdb = {
    ref: vi.fn().mockReturnThis(),
    child: vi.fn().mockReturnThis(),
    get: vi.fn().mockImplementation(async function () {
        const val = {};
        return {
            exists: () => true,
            val: () => val,
            key: 'mock-key',
            forEach: (cb) => {
                Object.entries(val).forEach(([key, v]) => {
                    cb({ key, val: () => v });
                });
            }
        };
    }),
    update: vi.fn().mockResolvedValue(true),
    set: vi.fn().mockResolvedValue(true),
    push: vi.fn().mockReturnThis(),
    key: 'mock-key',
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    orderByChild: vi.fn().mockReturnThis(),
    equalTo: vi.fn().mockReturnThis(),
    limitToLast: vi.fn().mockReturnThis(),
};

// Hoist the mocks
vi.mock('../src/services/firebase.js', () => ({
    admin: {
        auth: () => mockAuth,
        firestore: {
            FieldValue: {
                serverTimestamp: () => 'mock-timestamp',
                increment: (val) => ({ _increment: val })
            }
        },
        database: () => mockRtdb
    },
    initializeFirebase: vi.fn(),
    getFirestore: () => mockFirestore,
    getRealtimeDb: () => mockRtdb
}));

/**
 * Helper to generate a dummy auth header
 */
export const getAuthHeader = (token = 'valid-token') => {
    return { Authorization: `Bearer ${token}` };
};

export { mockUser };
