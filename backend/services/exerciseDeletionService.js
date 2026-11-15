class ExerciseDeletionError extends Error {
    // usedIn: exercise_in_use 일 때 어디서 쓰는지('pack' | 'plan') — 안내 문구를 고른다.
    constructor(status, code, usedIn) { super(code); this.status = status; this.usedIn = usedIn; }
}

class ExerciseDeletionService {
    constructor(repository) { this.repository = repository; }

    async usage(academyId, exerciseId) {
        const id = checkedId(exerciseId);
        const value = await this.repository.usage(checkedId(academyId), id);
        if (!value) throw new ExerciseDeletionError(404, 'exercise_not_found');
        return value;
    }

    async remove(academyId, exerciseId, expectedHash) {
        if (expectedHash !== undefined && !/^sha256:[a-f0-9]{64}$/.test(expectedHash)) {
            throw new ExerciseDeletionError(400, 'invalid_snapshot_hash');
        }
        const state = await this.repository.removeUnused(checkedId(academyId), checkedId(exerciseId), expectedHash);
        if (state === 'not_found') throw new ExerciseDeletionError(404, 'exercise_not_found');
        if (state === 'in_use') throw new ExerciseDeletionError(409, 'exercise_in_use', 'pack');
        if (state === 'in_plan') throw new ExerciseDeletionError(409, 'exercise_in_use', 'plan');
        if (state === 'changed') throw new ExerciseDeletionError(409, 'before_snapshot_changed');
        if (state !== 'deleted') throw new Error('exercise_delete_failed');
    }
}

function checkedId(raw) {
    if (!/^[1-9][0-9]*$/.test(String(raw)) || !Number.isSafeInteger(Number(raw))) {
        throw new ExerciseDeletionError(400, 'invalid_exercise_id');
    }
    return Number(raw);
}

module.exports = { ExerciseDeletionService, ExerciseDeletionError };
