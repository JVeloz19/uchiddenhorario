import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import {
  searchCourse,
  getFilterOptions,
  searchInstructors,
  searchSubjectCourseCombos,
  createAnonymousUcSession,
  AuthExpiredError,
  UcTimeoutError,
} from './ucClient.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback,linklocal,uniquelocal');

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// In-memory only: maps an opaque bearer token we hand the frontend to an
// anonymous UC search session (JSESSIONID etc.). Never touches disk, gone
// on restart, expires on its own well before Banner's own session does.
const SESSION_TTL_MS = envInt('SESSION_TTL_MS', 60 * 60 * 1000);
const MAX_SESSIONS = envInt('MAX_SESSIONS', 500);
const MAX_SESSIONS_PER_IP = envInt('MAX_SESSIONS_PER_IP', 5);
const sessions = new Map();

class HttpError extends Error {
  constructor(status, error, message) {
    super(message);
    this.status = status;
    this.error = error;
  }
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, entry] of sessions) {
    if (entry.expiresAt < now) sessions.delete(token);
  }
}

function countSessionsForIp(ip) {
  let count = 0;
  for (const entry of sessions.values()) {
    if (entry.ip === ip) count++;
  }
  return count;
}

function assertSessionCapacity(ip) {
  pruneExpiredSessions();
  if (sessions.size >= MAX_SESSIONS) {
    throw new HttpError(429, 'session_limit_reached', 'Too many active anonymous sessions');
  }
  if (countSessionsForIp(ip) >= MAX_SESSIONS_PER_IP) {
    throw new HttpError(429, 'session_limit_reached', 'Too many active anonymous sessions for this client');
  }
}

function createSession(ucSession, ip) {
  assertSessionCapacity(ip);
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { ucSession, ip, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSession(token) {
  const entry = sessions.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return entry.ucSession;
}

setInterval(() => {
  pruneExpiredSessions();
}, 15 * 60 * 1000).unref();

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';

// Vite bumps to 5174/5175/... whenever the previous port is still taken by
// a stale dev server, so pin the allowlist to localhost/127.0.0.1 on any
// port during local dev instead of one exact origin.
const localDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || (!isProduction && localDevOrigin.test(origin))) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);
app.use(express.json());

const sessionLimiter = rateLimit({
  windowMs: envInt('SESSION_RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000),
  limit: envInt('SESSION_RATE_LIMIT_MAX', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'rate_limited', message: 'Too many session requests, please slow down' });
  },
});

const apiLimiter = rateLimit({
  windowMs: envInt('API_RATE_LIMIT_WINDOW_MS', 60 * 1000),
  limit: envInt('API_RATE_LIMIT_MAX', 60),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'rate_limited', message: 'Too many requests, please slow down' });
  },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

async function createAnonymousSessionResponse(req, res) {
  try {
    assertSessionCapacity(req.ip);
    const ucSession = await createAnonymousUcSession();
    const token = createSession(ucSession, req.ip);
    res.json({ token, expiresInMs: SESSION_TTL_MS, anonymous: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.error, message: err.message });
    }
    if (err instanceof UcTimeoutError) {
      return res.status(504).json({ error: 'upstream_timeout', message: 'UC registration timed out' });
    }
    console.error(err);
    res.status(502).json({ error: 'upstream_error', message: 'Failed to create anonymous UC session' });
  }
}

app.post('/api/session', sessionLimiter, createAnonymousSessionResponse);

// Backward-compatible alias for the old frontend call. This no longer uses
// UC credentials; it only creates an anonymous Banner search session.
app.post('/api/login', sessionLimiter, createAnonymousSessionResponse);

function requireSession(req, res, next) {
  const authHeader = req.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!bearerToken) {
    return res.status(401).json({ error: 'session_required', message: 'Create an anonymous UC session first' });
  }

  const session = getSession(bearerToken);
  if (!session) {
    return res.status(401).json({ error: 'session_expired', message: 'Please log in again' });
  }

  req.ucSession = session;
  next();
}

function handleUcError(res, err) {
  if (err instanceof AuthExpiredError) {
    return res.status(401).json({ error: 'auth_expired', message: err.message });
  }
  if (err instanceof UcTimeoutError) {
    return res.status(504).json({ error: 'upstream_timeout', message: 'UC registration timed out' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.error, message: err.message });
  }
  console.error(err);
  res.status(502).json({ error: 'upstream_error', message: 'Failed to reach UC registration' });
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const VALID_HOURS = new Set(Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')));
const VALID_MINUTES = new Set(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']);
const VALID_AMPM = new Set(['AM', 'PM']);
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function badRequest(message) {
  return new HttpError(400, 'invalid_request', message);
}

function getQueryString(query, key, { required = false, maxLength = 80, pattern } = {}) {
  const value = query[key];
  if (value == null || value === '') {
    if (required) throw badRequest(`${key} is required`);
    return undefined;
  }
  if (Array.isArray(value) || typeof value === 'object') {
    throw badRequest(`${key} must be a single value`);
  }
  const str = String(value);
  if (str.length > maxLength) throw badRequest(`${key} is too long`);
  if (CONTROL_CHARS.test(str)) throw badRequest(`${key} contains invalid characters`);
  if (pattern && !pattern.test(str)) throw badRequest(`${key} is invalid`);
  return str;
}

function parseTimeParam(hour, min, ampm) {
  if (!hour && !min && !ampm) return null;
  if (!hour || !min || !ampm) throw badRequest('time filters require hour, minute, and AM/PM');
  if (!VALID_HOURS.has(hour) || !VALID_MINUTES.has(min) || !VALID_AMPM.has(ampm)) {
    throw badRequest('time filters contain invalid values');
  }
  return { hour, min, ampm };
}

app.get('/api/search', apiLimiter, requireSession, async (req, res) => {
  try {
    const term = getQueryString(req.query, 'term', { required: true, pattern: /^\d{6}$/ });
    const subjectCourse = getQueryString(req.query, 'subjectCourse', { maxLength: 20, pattern: /^[A-Za-z0-9]+$/ });
    const openOnly = getQueryString(req.query, 'openOnly', { maxLength: 5 });
    if (openOnly && openOnly !== 'true' && openOnly !== 'false') throw badRequest('openOnly is invalid');

    const daysOfWeek = DAY_KEYS.map((day, i) => {
      const value = getQueryString(req.query, `day_${day}`, { maxLength: 5 });
      if (!value) return null;
      if (value !== 'true' && value !== 'false') throw badRequest(`day_${day} is invalid`);
      return value === 'true' ? i : null;
    }).filter((i) => i !== null);

    const filters = {
      subject: getQueryString(req.query, 'subject', { maxLength: 20 })?.toUpperCase(),
      courseNumber: getQueryString(req.query, 'courseNumber', { maxLength: 20 }),
      instructor: getQueryString(req.query, 'instructor', { maxLength: 120 }),
      instructionalMethod: getQueryString(req.query, 'instructionalMethod', { maxLength: 80 }),
      college: getQueryString(req.query, 'college', { maxLength: 80 }),
      campus: getQueryString(req.query, 'campus', { maxLength: 80 }),
      attribute: getQueryString(req.query, 'attribute', { maxLength: 80 }),
      partOfTerm: getQueryString(req.query, 'partOfTerm', { maxLength: 80 }),
      openOnly: openOnly === 'true',
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
      startTime: parseTimeParam(
        getQueryString(req.query, 'startHour', { maxLength: 2 }),
        getQueryString(req.query, 'startMin', { maxLength: 2 }),
        getQueryString(req.query, 'startAmpm', { maxLength: 2 })
      ),
      endTime: parseTimeParam(
        getQueryString(req.query, 'endHour', { maxLength: 2 }),
        getQueryString(req.query, 'endMin', { maxLength: 2 }),
        getQueryString(req.query, 'endAmpm', { maxLength: 2 })
      ),
    };

    const result = await searchCourse({
      subjectCourse: subjectCourse ? String(subjectCourse).toUpperCase() : undefined,
      term,
      session: req.ucSession,
      filters,
    });
    res.json(result);
  } catch (err) {
    handleUcError(res, err);
  }
});

app.get('/api/filters', apiLimiter, requireSession, async (req, res) => {
  try {
    const term = getQueryString(req.query, 'term', { required: true, pattern: /^\d{6}$/ });
    const options = await getFilterOptions(term, req.ucSession);
    res.json(options);
  } catch (err) {
    handleUcError(res, err);
  }
});

app.get('/api/instructors', apiLimiter, requireSession, async (req, res) => {
  try {
    const term = getQueryString(req.query, 'term', { required: true, pattern: /^\d{6}$/ });
    const q = getQueryString(req.query, 'q', { maxLength: 120 }) ?? '';
    const results = await searchInstructors(q, term, req.ucSession);
    res.json(results);
  } catch (err) {
    handleUcError(res, err);
  }
});

app.get('/api/subject-course-combos', requireSession, async (req, res) => {
  const { term, q } = req.query;
  if (!term) {
    return res.status(400).json({ error: 'term is required' });
  }

  try {
    const results = await searchSubjectCourseCombos(q ? String(q) : '', String(term), req.ucSession);
    res.json(results);
  } catch (err) {
    handleUcError(res, err);
  }
});

const port = process.env.PORT ?? 8787;
app.listen(port, () => {
  console.log(`uchiddenhorario backend listening on :${port}`);
});
