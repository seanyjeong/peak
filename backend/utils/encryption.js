/**
 * 데이터 암호화/복호화 유틸리티
 * P-ACA와 동일한 암호화 방식 사용
 */

const crypto = require('crypto');

// 환경변수에서 암호화 키 가져오기 (32바이트 = 256비트)
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || 'paca-default-encryption-key-32b!'; // 32자

// 암호화 키를 32바이트로 맞추기
function getKey() {
    const key = ENCRYPTION_KEY;
    if (key.length === 32) {
        return Buffer.from(key, 'utf8');
    }
    // 키가 32바이트가 아니면 SHA-256 해시로 변환
    return crypto.createHash('sha256').update(key).digest();
}

/**
 * 데이터 복호화
 * @param {string} ciphertext - Base64 인코딩된 암호문
 * @returns {string} - 복호화된 평문
 */
function decrypt(ciphertext) {
    if (!ciphertext || ciphertext === '') {
        return ciphertext; // null, undefined, 빈 문자열은 그대로 반환
    }

    // 암호화되지 않은 데이터 (ENC: 접두사 없음)
    if (typeof ciphertext === 'string' && !ciphertext.startsWith('ENC:')) {
        return ciphertext; // 평문 그대로 반환
    }

    try {
        // ENC: 접두사 제거
        const base64Data = ciphertext.substring(4);
        const data = Buffer.from(base64Data, 'base64');

        const iv = data.slice(0, 16);
        const authTag = data.slice(16, 32);
        const encrypted = data.slice(32);

        const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Decryption error:', error);
        return ciphertext; // 실패 시 원본 반환
    }
}

/**
 * 객체의 지정된 필드들을 복호화
 */
function decryptFields(obj, fields) {
    if (!obj) return obj;

    const result = { ...obj };
    for (const field of fields) {
        if (result[field] !== undefined && result[field] !== null) {
            result[field] = decrypt(result[field]);
        }
    }
    return result;
}

module.exports = {
    decrypt,
    decryptFields
};
