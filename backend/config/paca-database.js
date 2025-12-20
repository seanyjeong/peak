/**
 * P-ACA MySQL Database Connection
 * P-EAK에서 P-ACA 데이터 조회용
 */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.PACA_DB_HOST || 'localhost',
    port: parseInt(process.env.PACA_DB_PORT) || 3306,
    user: process.env.PACA_DB_USER || 'paca',
    password: process.env.PACA_DB_PASSWORD || 'q141171616!',
    database: process.env.PACA_DB_NAME || 'paca',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: '+09:00',
    dateStrings: true
});

// 모든 연결에 타임존 설정
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+09:00'");
});

module.exports = pool;
