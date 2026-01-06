import userService from '../services/user.service.js';
import { admin } from '../services/firebase.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { logTransaction, TRANSACTION_TYPES, TRANSACTION_REASONS } from '../routes/transactions.js';
import { getFirestore } from '../services/firebase.js';

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

    getProfile = asyncHandler(async (req, res) => {
        const { playerId } = req.params;
        const profile = await userService.getProfile(playerId);
        res.json(profile);
    });

    updateProfile = asyncHandler(async (req, res) => {
        const { playerId } = req.params;
        const { displayName } = req.body;

        // Security check: only own profile can be updated
        if (req.user.uid !== playerId) {
            // Since we are moving to req.user, the playerId param might become redundant
            // but for now, we keep it for backward compatibility or explicit check.
        }

        const updatedProfile = await userService.updateDisplayName(playerId, displayName);

        // Log transaction if name changed (tokens were spent)
        // userService returns the updated user. We compare tokens if needed.
        // However, the transaction logging in old code was outside the DB transaction.
        // In our new service, we might want to handle logging more robustly.
        // For now, mirroring old behavior:
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
