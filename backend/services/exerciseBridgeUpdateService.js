const { ExerciseDeletionError } = require('./exerciseDeletionService');
const FIELDS = ['name', 'tags', 'default_sets', 'default_reps', 'description', 'video_url'];

class ExerciseBridgeUpdateService {
    constructor(repository) { this.repository = repository; }

    async update(academyId, rawId, hash, values) {
        if (!/^[1-9][0-9]*$/.test(String(rawId)) || !Number.isSafeInteger(Number(rawId))
            || !/^sha256:[a-f0-9]{64}$/.test(hash || '') || !values || Array.isArray(values)
            || Object.keys(values).length !== FIELDS.length || FIELDS.some((key) => !Object.hasOwn(values, key))
            || typeof values.name !== 'string' || !values.name.trim() || values.name.length > 100
            || !Array.isArray(values.tags) || values.tags.length > 100
            || values.tags.some((tag) => typeof tag !== 'string' || tag.length > 100)
            || ['default_sets', 'default_reps'].some((key) => values[key] !== null
                && (!Number.isSafeInteger(values[key]) || values[key] <= 0))
            || ['description', 'video_url'].some((key) => values[key] !== null && typeof values[key] !== 'string')) {
            throw new ExerciseDeletionError(400, 'invalid_exercise_update');
        }
        const result = await this.repository.update(academyId, Number(rawId), hash, values);
        if (result === 'not_found') throw new ExerciseDeletionError(404, 'exercise_not_found');
        if (result === 'changed') throw new ExerciseDeletionError(409, 'before_snapshot_changed');
        if (result !== 'updated') throw new Error('exercise_update_failed');
    }
}

module.exports = { ExerciseBridgeUpdateService };
