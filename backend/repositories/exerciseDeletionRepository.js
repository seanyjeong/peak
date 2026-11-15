const { exerciseSnapshot } = require('../utils/bridgeSnapshot');

class ExerciseDeletionRepository {
    constructor(pool) { this.pool = pool; }

    async usage(academyId, exerciseId) {
        const [rows] = await this.pool.query(
            'SELECT id FROM exercises WHERE id = ? AND academy_id = ?', [exerciseId, academyId]);
        if (!rows.length) return null;
        const [refs] = await this.pool.query(
            'SELECT COUNT(*) AS count FROM exercise_pack_items WHERE exercise_id = ?', [exerciseId]);
        return { packReferences: Number(refs[0].count) };
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
