const express = require('express');
const auth = require('./auth');
const { readDb, writeDb } = require('./store');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Sessão ----
app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body || {};
  if (!auth.checkCredentials(usuario, senha)) {
    await sleep(600); // freia tentativas repetidas
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }
  res.setHeader('Set-Cookie', auth.sessionCookie(auth.createToken(usuario)));
  res.json({ ok: true, usuario });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', auth.clearCookie());
  res.json({ ok: true });
});

// Tudo abaixo exige login
app.use('/api', auth.requireAuth);

app.get('/api/me', (req, res) => {
  res.json({ usuario: req.user });
});

// ---- Registros diários ----
app.get('/api/entries', async (req, res) => {
  const db = await readDb();
  res.json({ entries: db.entries });
});

app.put('/api/entries/:date', async (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Data inválida. Use o formato AAAA-MM-DD.' });
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Registro inválido.' });
  }
  const db = await readDb();
  const entry = { ...body, date, updatedAt: new Date().toISOString() };
  db.entries[date] = entry;
  await writeDb(db);
  res.json({ entry });
});

app.delete('/api/entries/:date', async (req, res) => {
  const { date } = req.params;
  const db = await readDb();
  if (!db.entries[date]) return res.status(404).json({ error: 'Registro não encontrado.' });
  delete db.entries[date];
  await writeDb(db);
  res.json({ ok: true });
});

// Backup completo do banco em JSON
app.get('/api/export', async (req, res) => {
  const db = await readDb();
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="diario-backup-${stamp}.json"`);
  res.type('application/json').send(JSON.stringify(db, null, 2));
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Erro interno no servidor.' });
});

module.exports = app;
