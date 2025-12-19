/**
 * Trainers Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /maxt/trainers - 트레이너 목록
router.get('/', async (req, res) => {
    try {
        const [trainers] = await db.query(
            'SELECT * FROM trainers WHERE active = 1 ORDER BY name'
        );
        res.json({ success: true, trainers });
    } catch (error) {
        console.error('Get trainers error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /maxt/trainers/:id - 트레이너 상세
router.get('/:id', async (req, res) => {
    try {
        const [trainers] = await db.query(
            'SELECT * FROM trainers WHERE id = ?',
            [req.params.id]
        );
        if (trainers.length === 0) {
            return res.status(404).json({ error: 'Not Found' });
        }
        res.json({ success: true, trainer: trainers[0] });
    } catch (error) {
        console.error('Get trainer error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /maxt/trainers - 트레이너 등록
router.post('/', async (req, res) => {
    try {
        const { paca_user_id, name, phone } = req.body;
        const [result] = await db.query(
            'INSERT INTO trainers (paca_user_id, name, phone) VALUES (?, ?, ?)',
            [paca_user_id, name, phone]
        );
        res.status(201).json({
            success: true,
            trainerId: result.insertId
        });
    } catch (error) {
        console.error('Create trainer error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
