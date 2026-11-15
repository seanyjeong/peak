const { ExerciseDeletionRepository } = require('../repositories/exerciseDeletionRepository');
const { ExerciseDeletionService, ExerciseDeletionError } = require('../services/exerciseDeletionService');

function registerExerciseDeletion(router, { db, verifyToken }) {
    const service = new ExerciseDeletionService(new ExerciseDeletionRepository(db));
    router.get('/:id/usage', verifyToken, async (req, res) => {
        try { res.json({ success: true, ...await service.usage(req.user.academyId, req.params.id) }); }
        catch (error) { respondError(res, error); }
    });
    router.delete('/:id', verifyToken, async (req, res) => {
        try {
            await service.remove(req.user.academyId, req.params.id, req.headers['x-academy-bridge-before-hash']);
            res.json({ success: true });
        } catch (error) { respondError(res, error); }
    });
}

const IN_USE_MESSAGES = {
    pack: '운동 팩에서 사용 중입니다. 팩에서 운동을 먼저 제외해 주세요.',
    plan: '수업 계획에서 사용 중입니다. 계획에서 운동을 먼저 제외해 주세요.',
};

function respondError(res, error) {
    if (error instanceof ExerciseDeletionError) {
        return res.status(error.status).json({ error: error.message,
            ...(error.message === 'exercise_in_use' ? { message: IN_USE_MESSAGES[error.usedIn] } : {}) });
    }
    return res.status(500).json({ error: 'exercise_delete_failed' });
}

module.exports = { registerExerciseDeletion };
