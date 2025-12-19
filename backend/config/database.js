/**
 * P-EAK MySQL Database Connection
 */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'paca',
    password: process.env.DB_PASSWORD || 'q141171616!',
    database: process.env.DB_NAME || 'peak',
    waitForConnections: true,
    connectionLimit: 10,
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
