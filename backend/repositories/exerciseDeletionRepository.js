const { exerciseSnapshot } = require('../utils/bridgeSnapshot');

// 수업 계획은 운동을 daily_plans.exercises JSON 배열에 { exercise_id } 로 둔다(옛 행은 { id }).
// 값이 숫자·문자 어느 쪽으로 저장됐어도 찾는다. 팩 참조처럼 학원을 가리지 않고 본다.
const PLAN_REFERENCES = `FROM daily_plans
    WHERE JSON_CONTAINS(exercises, JSON_OBJECT('exercise_id', ?)) OR JSON_CONTAINS(exercises, JSON_OBJECT('exercise_id', ?))
       OR JSON_CONTAINS(exercises, JSON_OBJECT('id', ?)) OR JSON_CONTAINS(exercises, JSON_OBJECT('id', ?))`;
const planReferenceParams = (exerciseId) => [exerciseId, String(exerciseId), exerciseId, String(exerciseId)];

class ExerciseDeletionRepository {
    constructor(pool) { this.pool = pool; }

    async usage(academyId, exerciseId) {
        const [rows] = await this.pool.query(
            'SELECT id FROM exercises WHERE id = ? AND academy_id = ?', [exerciseId, academyId]);
        if (!rows.length) return null;
        const [refs] = await this.pool.query(
            'SELECT COUNT(*) AS count FROM exercise_pack_items WHERE exercise_id = ?', [exerciseId]);
        const [plans] = await this.pool.query(
            `SELECT COUNT(*) AS count ${PLAN_REFERENCES}`, planReferenceParams(exerciseId));
        return { packReferences: Number(refs[0].count), planReferences: Number(plans[0].count) };
    }

    async removeUnused(academyId, exerciseId, expectedHash) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.query(
                'SELECT * FROM exercises WHERE id = ? AND academy_id = ? FOR UPDATE', [exerciseId, academyId]);
            if (!rows.length) { await connection.rollback(); return 'not_found'; }
            if (expectedHash && exerciseSnapshot(rows[0]) !== expectedHash) { await connection.rollback(); return 'changed'; }
            // The exercise row lock also serializes inserts holding the pack-item FK lock.
            const [refs] = await connection.query(
                'SELECT id FROM exercise_pack_items WHERE exercise_id = ? FOR UPDATE', [exerciseId]);
            if (refs.length) { await connection.rollback(); return 'in_use'; }
            // 계획 행은 잠그지 않는다(JSON 검색은 표 전체를 훑어 모든 계획 행을 잠그게 된다).
            const [plans] = await connection.query(
                `SELECT id ${PLAN_REFERENCES} LIMIT 1`, planReferenceParams(exerciseId));
            if (plans.length) { await connection.rollback(); return 'in_plan'; }
            const [result] = await connection.query(
                'DELETE FROM exercises WHERE id = ? AND academy_id = ?', [exerciseId, academyId]);
            if (result.affectedRows !== 1) throw new Error('exercise_delete_conflict');
            await connection.commit();
            return 'deleted';
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally { connection.release(); }
    }
}

module.exports = { ExerciseDeletionRepository };
