const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const BOARD_ACCESS_TOKEN_TTL = '12h';
const BOARD_ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const BOARD_TOKEN_PURPOSE = 'peak-board';
const BOARD_PIN_PATTERN = /^\d{4,12}$/;
const BOARD_SLUG_PATTERN = /^[a-z0-9-]+$/;

function normalizeBoardPin(pin) {
  return String(pin || '').trim();
}

function validateBoardPin(pin) {
  const normalized = normalizeBoardPin(pin);
  if (!BOARD_PIN_PATTERN.test(normalized)) {
    return {
      valid: false,
      message: 'PIN은 숫자 4~12자리로 입력해주세요.',
    };
  }
  return { valid: true, pin: normalized };
}

function normalizeBoardSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function validateBoardSlug(slug) {
  const normalized = normalizeBoardSlug(slug);
  if (!normalized) {
    return {
      valid: false,
      message: '전광판 주소를 입력해주세요.',
    };
  }
  if (!BOARD_SLUG_PATTERN.test(normalized)) {
    return {
      valid: false,
      message: '전광판 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.',
    };
  }
  return { valid: true, slug: normalized };
}

async function hashBoardPin(pin) {
  const validation = validateBoardPin(pin);
  if (!validation.valid) {
    const error = new Error(validation.message);
    error.code = 'INVALID_BOARD_PIN';
    throw error;
  }
  return bcrypt.hash(validation.pin, 12);
}

async function verifyBoardPin(pin, hash) {
  const validation = validateBoardPin(pin);
  if (!validation.valid || !hash) return false;
  return bcrypt.compare(validation.pin, hash);
}

function getJwtSecret(secret = process.env.JWT_SECRET) {
  if (!secret) {
    const error = new Error('JWT_SECRET is required for board access tokens');
    error.code = 'MISSING_JWT_SECRET';
    throw error;
  }
  return secret;
}

function createBoardAccessToken(academy, secret) {
  return jwt.sign(
    {
      purpose: BOARD_TOKEN_PURPOSE,
      academyId: academy.id,
      slug: academy.slug,
    },
    getJwtSecret(secret),
    { expiresIn: BOARD_ACCESS_TOKEN_TTL }
  );
}

function extractBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.substring(7);
}

function verifyBoardAccessToken(token, academy, secret) {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, getJwtSecret(secret));
    return (
      decoded.purpose === BOARD_TOKEN_PURPOSE
      && Number(decoded.academyId) === Number(academy.id)
      && decoded.slug === academy.slug
    );
  } catch {
    return false;
  }
}

function hasBoardPin(academy) {
  return Boolean(academy?.boardPinHash);
}

function boardPinRequiredPayload(academy) {
  return {
    success: false,
    requiresPin: true,
    academy: {
      name: academy.name,
      slug: academy.slug,
    },
    message: '전광판 PIN을 입력해주세요.',
  };
}

function requireBoardAccess(req, res, academy) {
  if (!hasBoardPin(academy)) return true;
  const token = extractBearerToken(req);
  if (verifyBoardAccessToken(token, academy)) return true;
  res.status(401).json(boardPinRequiredPayload(academy));
  return false;
}

module.exports = {
  BOARD_ACCESS_TOKEN_TTL_SECONDS,
  boardPinRequiredPayload,
  createBoardAccessToken,
  hasBoardPin,
  hashBoardPin,
  normalizeBoardPin,
  normalizeBoardSlug,
  requireBoardAccess,
  validateBoardPin,
  validateBoardSlug,
  verifyBoardAccessToken,
  verifyBoardPin,
};
