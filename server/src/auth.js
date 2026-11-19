
import jwt from 'jsonwebtoken';

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }
  return secret;
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      email: user.email
    },
    jwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'sohel-smm'
    }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : '';

  if (!token) {
    return res.status(401).json({ error: 'Please log in.' });
  }

  try {
    const payload = jwt.verify(
      token,
      jwtSecret(),
      { issuer: 'sohel-smm' }
    );

    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      email: payload.email
    };

    if (!Number.isSafeInteger(req.user.id)) {
      throw new Error('Invalid user');
    }

    next();
  } catch {
    return res.status(401).json({
      error: 'Session expired. Please log in again.'
    });
  }
}

export function requireAdmin(req, res, next) {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    return res.status(403).json({
      error: 'Admin access required.'
    });
  }

  next();
}
