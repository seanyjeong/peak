const { ExerciseBridgeUpdateRepository } = require('../repositories/exerciseBridgeUpdateRepository');
const { ExerciseBridgeUpdateService } = require('../services/exerciseBridgeUpdateService');
const { ExerciseDeletionError } = require('../services/exerciseDeletionService');

function registerExerciseBridgeUpdate(router, { db, verifyToken }) {
    const service = new ExerciseBridgeUpdateService(new ExerciseBridgeUpdateRepository(db));
    router.get('/bridge-capabilities', verifyToken, (_req, res) => res.json({ success: true, commandCas: true }));
    router.put('/:id', verifyToken, async (req, res, next) => {
        const expected = req.headers['x-academy-bridge-before-hash'];
        if (expected === undefined) return next();
        try {
            await service.update(req.user.academyId, req.params.id, expected, req.body);
            res.json({ success: true });
        } catch (error) {
            res.status(error instanceof ExerciseDeletionError ? error.status : 500)
                .json({ error: error instanceof ExerciseDeletionError ? error.message : 'exercise_update_failed' });
        }
    });
}

module.exports = { registerExerciseBridgeUpdate };
