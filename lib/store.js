/*
 * Armazenamento do diário.
 *
 * O banco é sempre UM documento JSON no formato { "entries": { "AAAA-MM-DD": {...} } }.
 *
 * - No seu computador: salvo no arquivo db.json, na raiz do projeto.
 * - Na Vercel: o sistema de arquivos das funções é somente leitura e é apagado
 *   a cada execução, então um db.json não persistiria. Lá, o mesmo documento JSON
 *   é guardado no Upstash Redis (integração gratuita da Vercel), em uma única chave.
 */
const fs = require('fs/promises');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'db.json');
const REDIS_KEY = 'diario:db';

const empty = () => ({ entries: {} });

let redisClient = null;
function redis() {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const { Redis } = require('@upstash/redis');
  redisClient = new Redis({ url, token });
  return redisClient;
}

function storageMissing() {
  const err = new Error(
    'Banco de dados não configurado na Vercel. Conecte o Upstash Redis ao projeto (Storage) e faça um novo deploy.'
  );
  err.status = 500;
  err.expose = true;
  return err;
}

function normalize(data) {
  return data && typeof data === 'object' && data.entries && typeof data.entries === 'object' ? data : empty();
}

async function readDb() {
  const r = redis();
  if (r) return normalize(await r.get(REDIS_KEY));
  if (process.env.VERCEL) throw storageMissing();
  try {
    return normalize(JSON.parse(await fs.readFile(DB_FILE, 'utf8')));
  } catch (err) {
    if (err.code === 'ENOENT') return empty();
    throw err;
  }
}

async function writeDb(db) {
  const r = redis();
  if (r) {
    await r.set(REDIS_KEY, db);
    return;
  }
  if (process.env.VERCEL) throw storageMissing();
  // Grava em arquivo temporário e renomeia, para nunca deixar o db.json pela metade.
  const tmp = `${DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_FILE);
}

module.exports = { readDb, writeDb };
