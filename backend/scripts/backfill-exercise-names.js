#!/usr/bin/env node
/**
 * 일회성: daily_plans.exercises JSON 에서 name 누락된 항목을
 * exercises 테이블 조회로 채워넣는다.
 * 실행: node scripts/backfill-exercise-names.js
 */
require('dotenv').config();
const db = require('../config/database');

function ts() { return new Date().toISOString().replace('T',' ').slice(0,19) + ' KST'; }

(async () => {
    let fixed = 0, scanned = 0, already = 0;
    try {
        const [allEx] = await db.query('SELECT id, name FROM exercises');
        const nameMap = {};
        allEx.forEach(e => { nameMap[e.id] = e.name; });

        const [plans] = await db.query('SELECT id, exercises FROM daily_plans WHERE exercises IS NOT NULL');
        console.log(`[${ts()}] scanning ${plans.length} plans ...`);

        for (const p of plans) {
            scanned++;
            let arr;
            try {
                arr = typeof p.exercises === 'string' ? JSON.parse(p.exercises) : p.exercises;
            } catch { continue; }
            if (!Array.isArray(arr)) continue;

            let changed = false;
            const next = arr.map(e => {
                if (!e || typeof e !== 'object') return e;
                if (e.name) return e;
                const eid = e.exercise_id || e.id;
                if (!eid) return e;
                const name = nameMap[eid];
                if (name) { changed = true; return { ...e, name, exercise_id: eid }; }
                return e;
            });

            if (changed) {
                await db.query('UPDATE daily_plans SET exercises = ? WHERE id = ?', [JSON.stringify(next), p.id]);
                fixed++;
                console.log(`[${ts()}]   plan_id=${p.id} fixed`);
            } else {
                already++;
            }
        }
        console.log(`[${ts()}] DONE scanned=${scanned} fixed=${fixed} already_clean=${already}`);
    } catch (e) {
        console.error(`[${ts()}] ERROR: ${e.message}`);
        process.exit(1);
    } finally {
        try { await db.end(); } catch {}
        process.exit(0);
    }
})();
