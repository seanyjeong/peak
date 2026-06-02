const DEFAULT_CORS_ORIGINS = [
    'https://chejump.com',
    'https://supermax.kr',
    'https://peak-rose.vercel.app',
    'https://dev.sean8320.dedyn.io',
    'http://localhost:3000',
    'http://localhost:3001',
];

function isTestEnv() {
    return process.env.NODE_ENV === 'test';
}

function requireEnv(name) {
    const value = process.env[name];
    if (value && value.trim() !== '') {
        return value;
    }

    if (isTestEnv()) {
        return `test-${name.toLowerCase()}`;
    }

    throw new Error(`Missing required environment variable: ${name}`);
}

function validateRequiredEnv(names) {
    names.forEach(requireEnv);
}

function parseOrigins(value) {
    if (!value) {
        return [];
    }

    return value
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}

function getCorsOrigins() {
    return Array.from(new Set([
        ...DEFAULT_CORS_ORIGINS,
        ...parseOrigins(process.env.PEAK_CORS_ORIGINS),
        ...parseOrigins(process.env.CORS_ORIGINS),
    ]));
}

function isLocalDevelopmentOrigin(origin) {
    if (process.env.NODE_ENV === 'production') {
        return false;
    }

    try {
        const { hostname } = new URL(origin);
        return hostname === 'localhost' || hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

function isOriginAllowed(origin) {
    if (!origin) {
        return true;
    }

    return getCorsOrigins().includes(origin) || isLocalDevelopmentOrigin(origin);
}

function corsOriginDelegate(origin, callback) {
    callback(null, isOriginAllowed(origin));
}

module.exports = {
    DEFAULT_CORS_ORIGINS,
    requireEnv,
    validateRequiredEnv,
    getCorsOrigins,
    isOriginAllowed,
    corsOriginDelegate,
};
