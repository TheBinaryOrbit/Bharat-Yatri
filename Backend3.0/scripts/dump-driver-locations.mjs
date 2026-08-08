// Dumps every driver-location entry Redis is holding: the GEO index (drivers:geo)
// and the per-driver metadata hashes (driver:meta:*), joined and cross-checked.
import 'dotenv/config';
import Redis from 'ioredis';

const GEO_KEY = 'drivers:geo';
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 3,
});

const ago = (ms) => {
  if (!Number.isFinite(ms)) return '—';
  const s = Math.round((Date.now() - ms) / 1000);
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ${s % 60}s ago`;
};

const main = async () => {
  // GEO members with their coordinates + scores
  const members = await redis.zrange(GEO_KEY, 0, -1);
  const positions = members.length ? await redis.geopos(GEO_KEY, ...members) : [];

  // Every metadata hash currently alive, including any orphan whose GEO member is gone
  const metaKeys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', 'driver:meta:*', 'COUNT', 500);
    cursor = next;
    metaKeys.push(...batch);
  } while (cursor !== '0');

  const pipeline = redis.pipeline();
  metaKeys.forEach((k) => pipeline.hgetall(k).ttl(k));
  const results = metaKeys.length ? await pipeline.exec() : [];

  const metaById = new Map();
  metaKeys.forEach((key, i) => {
    const id = key.replace('driver:meta:', '');
    metaById.set(id, { meta: results[i * 2][1], ttl: results[i * 2 + 1][1] });
  });

  console.log(`\nRedis: ${redis.options.host}:${redis.options.port}  db=${redis.options.db ?? 0}`);
  console.log(`GEO members (${GEO_KEY}): ${members.length}   meta hashes (driver:meta:*): ${metaKeys.length}\n`);

  console.log('── GEO INDEX ──────────────────────────────────────────────────────────');
  if (!members.length) console.log('  (empty — no driver has ever gone online, or all were evicted)');

  members.forEach((id, i) => {
    const [lng, lat] = positions[i] || [];
    const entry = metaById.get(id);
    const m = entry?.meta;

    if (!m || !Object.keys(m).length) {
      console.log(`  ${id}  ${lat}, ${lng}   ⚠ STALE — no meta hash (will be evicted on next search)`);
      return;
    }

    const state = m.isOnline === '1' ? '🟢 online' : `🟡 grace (disconnected ${ago(Number(m.disconnectedAt))})`;
    console.log(`  ${id}  ${lat}, ${lng}`);
    console.log(`     ${state}   ttl=${entry.ttl}s   updated ${ago(Number(m.updatedAt))}`);
    console.log(`     meta: ${JSON.stringify(m)}`);
  });

  const orphans = [...metaById.keys()].filter((id) => !members.includes(id));
  if (orphans.length) {
    console.log('\n── META WITHOUT A GEO MEMBER (driver has meta but is not in the index) ──');
    orphans.forEach((id) => {
      const { meta, ttl } = metaById.get(id);
      console.log(`  ${id}  ttl=${ttl}s  ${JSON.stringify(meta)}`);
    });
  }

  console.log('');
  await redis.quit();
};

main().catch(async (err) => {
  console.error('Failed:', err.message);
  await redis.quit().catch(() => {});
  process.exit(1);
});
