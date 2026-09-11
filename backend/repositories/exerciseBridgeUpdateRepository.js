const { exerciseSnapshot } = require('../utils/bridgeSnapshot');

class ExerciseBridgeUpdateRepository {
    constructor(pool) { this.pool = pool; }

    async update(academyId, exerciseId, expectedHash, values) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.query(
                'SELECT * FROM exercises WHERE id = ? AND academy_id = ? FOR UPDATE', [exerciseId, academyId]);
            if (!rows.length) { await connection.rollback(); return 'not_found'; }
            if (exerciseSnapshot(rows[0]) !== expectedHash) { await connection.rollback(); return 'changed'; }
            await connection.query(`UPDATE exercises SET name = ?, tags = ?, default_sets = ?,
                default_reps = ?, description = ?, video_url = ? WHERE id = ? AND academy_id = ?`,
            [values.name, JSON.stringify(values.tags), values.default_sets, values.default_reps,
                values.description, values.video_url, exerciseId, academyId]);
            await connection.commit();
            return 'updated';
        } catch (error) { await connection.rollback(); throw error; }
        finally { connection.release(); }
    }
}

module.exports = { ExerciseBridgeUpdateRepository };
