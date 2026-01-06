import questService from '../services/quests.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

export class QuestController {
    getPlayerQuests = asyncHandler(async (req, res) => {
        const { playerId } = req.params;

        // Security check: only own quests can be viewed if we are using token auth
        // But for now keeping it flexible if playerId is passed.

        const quests = await questService.getPlayerQuests(playerId);
        res.json(quests);
    });

    claimQuestReward = asyncHandler(async (req, res) => {
        const { playerId, questId } = req.params;
        const result = await questService.claimQuestReward(playerId, questId);
        res.json(result);
    });
}

export default new QuestController();
