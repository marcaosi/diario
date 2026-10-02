const crypto = require('crypto');

const COOKIE = 'diario_sessao';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function config() {
  return {
    user: process.env.ADMIN_USER || 'administrador',
    pass: process.env.ADMIN_PASSWORD || 'admin123',
    // Em produção (Vercel) o segredo é obrigatório; localmente usamos um valor fixo.
    secret: process.env.SESSION_SECRET || (process.env.VERCEL ? null : 'segredo-local-apenas-para-desenvolvimento'),
  };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function checkCredentials(usuario, senha) {
  const c = config();
  const okUser = safeEqual(usuario, c.user);
  const okPass = safeEqual(senha, c.pass);
  return okUser && okPass;
}

function secret() {
  const s = config().secret;
  if (!s) {
    const err = new Error('Configuração incompleta: defina a variável SESSION_SECRET na Vercel.');
    err.status = 500;
    err.expose = true;
    throw err;
  }
  return s;
}

function sign(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

function createToken(usuario) {
  const payload = Buffer.from(JSON.stringify({ u: usuario, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data.u;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function isSecure() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
}

function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${isSecure() ? '; Secure' : ''}`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure() ? '; Secure' : ''}`;
}

function requireAuth(req, res, next) {
  const usuario = verifyToken(parseCookies(req.headers.cookie)[COOKIE]);
  if (!usuario) return res.status(401).json({ error: 'Faça login para continuar.' });
  req.user = usuario;
  next();
}

module.exports = { checkCredentials, createToken, sessionCookie, clearCookie, requireAuth };
