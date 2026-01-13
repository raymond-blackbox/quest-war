import questService from '../services/quests.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { ForbiddenError } from '../utils/errors.js';

export class QuestController {
    getPlayerQuests = asyncHandler(async (req, res) => {
        const { playerId } = req.params;

        if (req.user.uid !== playerId) {
            throw new ForbiddenError('You can only view your own quests');
        }

        const quests = await questService.getPlayerQuests(playerId);
        res.json(quests);
    });

    claimQuestReward = asyncHandler(async (req, res) => {
        const { playerId, questId } = req.params;

        if (req.user.uid !== playerId) {
            throw new ForbiddenError('You can only claim rewards for your own quests');
        }

        const result = await questService.claimQuestReward(playerId, questId);
        res.json(result);
    });
}

export default new QuestController();
