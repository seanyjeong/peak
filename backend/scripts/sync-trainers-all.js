#!/usr/bin/env node
/**
 * Peak Trainers — 모든 academy sync (crontab 전용)
 * 실행: node scripts/sync-trainers-all.js
 */

require('dotenv').config();
const pacaPool = require('../config/paca-database');
const db = require('../config/database');
const { syncAcademyTrainers } = require('../routes/trainers');

function ts() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' KST';
}

(async () => {
    const started = Date.now();
    console.log(`[${ts()}] sync-trainers-all START`);
    let exitCode = 0;
    try {
        const [academies] = await pacaPool.query(
            "SELECT DISTINCT academy_id FROM instructors WHERE deleted_at IS NULL ORDER BY academy_id"
        );
        let ts_synced = 0, ts_updated = 0, ts_deactivated = 0;
        for (const row of academies) {
            try {
                const r = await syncAcademyTrainers(row.academy_id);
                console.log(`[${ts()}]   academy=${row.academy_id} synced=${r.synced} updated=${r.updated} deactivated=${r.deactivated} total=${r.total}`);
                ts_synced += r.synced; ts_updated += r.updated; ts_deactivated += r.deactivated;
            } catch (e) {
                console.error(`[${ts()}]   academy=${row.academy_id} ERROR: ${e.message}`);
                exitCode = 1;
            }
        }
        const took = Date.now() - started;
        console.log(`[${ts()}] sync-trainers-all DONE academies=${academies.length} synced=${ts_synced} updated=${ts_updated} deactivated=${ts_deactivated} took=${took}ms`);
    } catch (e) {
        console.error(`[${ts()}] FATAL: ${e.message}`);
        exitCode = 2;
    } finally {
        try { await pacaPool.end(); } catch {}
        try { if (db.end) await db.end(); } catch {}
        process.exit(exitCode);
    }
})();
