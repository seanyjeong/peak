const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { ExerciseDeletionService } = require('../../backend/services/exerciseDeletionService');
const { ExerciseDeletionRepository } = require('../../backend/repositories/exerciseDeletionRepository');
const { registerExerciseDeletion } = require('../../backend/routes/exerciseDeletion');

function fixture({ references = [], failDelete = false } = {}) {
    const row = { id: 12, academy_id: 5 }, calls = [];
    let deleted = false, committed = false;
    const connection = {
        async beginTransaction() { calls.push('begin'); },
        async rollback() { calls.push('rollback'); deleted = false; },
        async commit() { calls.push('commit'); committed = true; },
        release() { calls.push('release'); },
        async query(sql, params) {
            calls.push(sql);
            if (sql.startsWith('SELECT') && sql.includes('FROM exercises WHERE id = ?')) return [[...(!deleted && params[0] === row.id && params[1] === row.academy_id ? [row] : [])]];
            if (sql.includes('COUNT(*)')) return [[{ count: references.length }]];
            if (sql.includes('SELECT id FROM exercise_pack_items')) return [references];
            if (sql.startsWith('DELETE FROM exercises')) {
                if (failDelete) throw new Error('fixture_failure');
                assert.deepEqual(params, [12, 5]); deleted = true; return [{ affectedRows: 1 }];
            }
            throw new Error('unexpected_query');
        },
    };
    const db = { query: connection.query, async getConnection() { return connection; } };
    return { db, calls, state: () => ({ deleted, committed }) };
}

test('deletion rejects invalid identifiers before repository access', async () => {
    const service = new ExerciseDeletionService({ removeUnused: () => assert.fail('must not write') });
    for (const id of [0, -1, '12/../13', '12 OR 1=1', Number.MAX_SAFE_INTEGER + 1]) {
        await assert.rejects(service.remove(5, id), { status: 400 });
    }
});

test('native repository locks the exercise and dependencies before deleting', async () => {
    const f = fixture();
    const service = new ExerciseDeletionService(new ExerciseDeletionRepository(f.db));
    await service.remove(5, 12);
    assert.deepEqual(f.state(), { deleted: true, committed: true });
    assert.ok(f.calls[1].includes('academy_id = ? FOR UPDATE'));
    assert.ok(f.calls[2].includes('exercise_pack_items') && f.calls[2].includes('FOR UPDATE'));
    assert.deepEqual(f.calls.slice(-2), ['commit', 'release']);
});

test('existing pack references prevent cascade deletion, including foreign pack references', async () => {
    const f = fixture({ references: [{ id: 91, pack_id: 500 }] });
    const service = new ExerciseDeletionService(new ExerciseDeletionRepository(f.db));
    await assert.rejects(service.remove(5, 12), { status: 409, message: 'exercise_in_use' });
    assert.equal(f.calls.some((sql) => sql.startsWith('DELETE')), false);
    assert.deepEqual(f.state(), { deleted: false, committed: false });
    assert.deepEqual(f.calls.slice(-2), ['rollback', 'release']);
});

test('foreign and nonexistent exercises never reach deletion', async () => {
    for (const [academy, id] of [[7, 12], [5, 13]]) {
        const f = fixture();
        const service = new ExerciseDeletionService(new ExerciseDeletionRepository(f.db));
        await assert.rejects(service.remove(academy, id), { status: 404 });
        assert.equal(f.calls.some((sql) => sql.startsWith('DELETE')), false);
    }
});

test('database failure rolls back and releases the connection', async () => {
    const f = fixture({ failDelete: true });
    await assert.rejects(new ExerciseDeletionRepository(f.db).removeUnused(5, 12), /fixture_failure/);
    assert.deepEqual(f.calls.slice(-2), ['rollback', 'release']);
    assert.equal(f.state().committed, false);
});

test('real Express routes require authentication and expose only the dependency count', async (t) => {
    const f = fixture({ references: [{ id: 99, pack_id: 900 }] });
    const app = express(), router = express.Router();
    registerExerciseDeletion(router, { db: f.db, verifyToken(req, res, next) {
        if (req.headers.authorization !== 'Bearer fixture') return res.sendStatus(401);
        req.user = { academyId: 5 }; next();
    } });
    app.use('/peak/exercises', router);
    const server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
    t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
    const url = `http://127.0.0.1:${server.address().port}/peak/exercises/12`;
    assert.equal((await fetch(`${url}/usage`)).status, 401);
    const headers = { authorization: 'Bearer fixture' };
    assert.deepEqual(await (await fetch(`${url}/usage`, { headers })).json(), { success: true, packReferences: 1 });
    const deleted = await fetch(url, { headers, method: 'DELETE' });
    assert.equal(deleted.status, 409);
    assert.equal((await deleted.json()).error, 'exercise_in_use');
    assert.equal(f.state().deleted, false);
});
