import userService from '../services/user.service.js';
import { admin } from '../services/firebase.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { logTransaction, TRANSACTION_TYPES, TRANSACTION_REASONS } from '../routes/transactions.js';
import { getFirestore } from '../services/firebase.js';
import { ForbiddenError } from '../utils/errors.js';

/**
 * Handle Firebase login and user creation/retrieval
 */
export class AuthController {
    loginWithFirebase = asyncHandler(async (req, res) => {
        const { idToken } = req.body;
        const decoded = await admin.auth().verifyIdToken(idToken);

        const user = await userService.findOrCreateUser(decoded);
        const firebaseCustomToken = await admin.auth().createCustomToken(user.id);

        res.json({
            ...userService.toPlayerResponse(user),
            firebaseCustomToken,
        });
    });

    /**
     * Fetch player profile
     */
    getProfile = asyncHandler(async (req, res) => {
        const { playerId } = req.params;
        const profile = await userService.getProfile(playerId);
        res.json(profile);
    });

    /**
     * Update player profile (display name)
     */
    updateProfile = asyncHandler(async (req, res) => {
        const { playerId } = req.params;
        const { displayName } = req.body;

        // Security check: only own profile can be updated
        if (req.user.uid !== playerId) {
            throw new ForbiddenError('You can only update your own profile');
        }

        const updatedProfile = await userService.updateDisplayName(playerId, displayName);

        // Log transaction if name changed (tokens were spent)
        await logTransaction(getFirestore(), {
            playerId,
            type: TRANSACTION_TYPES.SPEND,
            amount: 500,
            reason: TRANSACTION_REASONS.NAME_CHANGE,
            roomId: null
        });

        res.json(userService.toPlayerResponse(updatedProfile));
    });
}

export default new AuthController();
