import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { searchCourse, AuthExpiredError } from './ucClient.js';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());

// Vite bumps to 5174/5175/... whenever the previous port is still taken by
// a stale dev server, so pin the allowlist to localhost/127.0.0.1 on any
// port during local dev instead of one exact origin.
const localDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || localDevOrigin.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/search', async (req, res) => {
  const { subjectCourse, term } = req.query;

  if (!subjectCourse || !term) {
    return res.status(400).json({ error: 'subjectCourse and term are required query params' });
  }

  try {
    const result = await searchCourse({
      subjectCourse: String(subjectCourse).toUpperCase(),
      term: String(term),
    });
    res.json(result);
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return res.status(401).json({ error: 'auth_expired', message: err.message });
    }
    console.error(err);
    res.status(502).json({ error: 'upstream_error', message: 'Failed to reach UC registration' });
  }
});

const port = process.env.PORT ?? 8787;
app.listen(port, () => {
  console.log(`uchiddenhorario backend listening on :${port}`);
});
