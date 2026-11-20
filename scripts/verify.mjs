#!/usr/bin/env node
/** Validate the cross-dataset contracts used by routing and exact map overlays. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = realpathSync(join(root, 'dist'));
const read = name => JSON.parse(readFileSync(join(root, name), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function check(condition, message) { if (!condition) throw new Error(message); }
function equal(actual, expected, message) { check(isDeepStrictEqual(actual, expected), message); }
function index(rows, label) {
  const result = new Map();
  for (const row of rows) {
    check(Number.isInteger(row.id) && !result.has(row.id), `${label}: duplicate or invalid ID ${row.id}`);
    result.set(row.id, row);
  }
  return result;
}
const countBy = (rows, key) => {
  const result = {};
  for (const row of rows) result[key(row)] = (result[key(row)] || 0) + 1;
  return result;
};
const assets = new Set();
function assetPath(name) {
  check(typeof name === 'string' && name && !isAbsolute(name), `Invalid local asset path: ${name}`);
  const file = resolve(dist, name);
  check(existsSync(file), `Missing local asset: ${name}`);
  const path = relative(dist, realpathSync(file));
  check(path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path), `Asset leaves dist/: ${name}`);
  assets.add(name);
  return file;
}
function imageDimensions(name) {
  const bytes = readFileSync(assetPath(name));
  if (name.endsWith('.png')) {
    check(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `Invalid PNG: ${name}`);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  check(bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP', `Invalid WebP: ${name}`);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    check(data + size <= bytes.length, `Truncated WebP chunk: ${name}`);
    if (type === 'VP8X' && size >= 10) return [bytes.readUIntLE(data + 4, 3) + 1, bytes.readUIntLE(data + 7, 3) + 1];
    if (type === 'VP8L' && size >= 5) {
      const bits = bytes.readUInt32LE(data + 1);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (type === 'VP8 ' && size >= 10) return [bytes.readUInt16LE(data + 6) & 0x3fff, bytes.readUInt16LE(data + 8) & 0x3fff];
    offset = data + size + (size % 2);
  }
  throw new Error(`No WebP dimensions: ${name}`);
}

async function main() {
  const atlas = read('dist/atlas-data.json');
  const hunt = read('dist/hunt-data.json');
  const drops = read('dist/drop-data.json');
  const metadata = read('source-data/meta.json');
  const sourceMaps = read('source-data/maps.json');
  const sourcePortals = read('source-data/portals-raw.json');
  const mapAssets = read('source-data/asset-manifest.json').maps;
  const iconManifest = read('source-data/hunt-icon-manifest.json');
  const serviceSource = read('source-data/service_connections.json');
  for (const name of ['maps.json', 'items.json', 'monsters.json', 'npcs.json']) {
    const bytes = readFileSync(join(root, 'source-data', name));
    equal(sha256(bytes), metadata.files[name].sha256, `Pinned source hash changed: ${name}`);
    equal(bytes.length, metadata.files[name].bytes, `Pinned source byte count changed: ${name}`);
    equal(JSON.parse(bytes.toString('utf8')).length, metadata.files[name].records, `Pinned source count changed: ${name}`);
  }
  equal(atlas.meta.version, '2.0.0', 'Unexpected atlas release');
  equal(hunt.meta.version, atlas.meta.version, 'Atlas/catalog versions differ');
  equal(drops.meta.catalogVersion, atlas.meta.version, 'Atlas/drop catalog versions differ');
  for (const data of [atlas, hunt]) {
    equal(data.meta.clientBuild, metadata.client_build, 'Client build mismatch');
    equal(data.meta.dataUpdatedAt, metadata.data_updated_at, 'Source timestamp mismatch');
  }
  console.log('PASS pinned source hashes, counts, version and client build');

  const maps = index(atlas.maps, 'Maps');
  const groups = new Set(atlas.groups.map(group => group.id));
  equal(groups.size, atlas.groups.length, 'Duplicate atlas group');
  equal(maps.size, sourceMaps.length, 'Map coverage differs from source');
  const portalKeys = new Set();
  const pairs = new Set();
  const portalKinds = { cross: 0, internal: 0, unknown: 0 };
  const outsideImage = [];
  for (const source of sourceMaps) {
    const map = maps.get(source.id);
    check(map && map.name === source.name && map.street === (source.street_name || ''), `Map identity changed: ${source.id}`);
    check(groups.has(map.group), `Unknown group on map ${source.id}`);
    check(map.x >= 0 && map.x <= atlas.meta.worldWidth && map.y >= 0 && map.y <= atlas.meta.worldHeight, `Invalid atlas position: ${source.id}`);
    check(map.width > 0 && map.height > 0, `Missing original image dimensions: ${source.id}`);
    const raw = sourcePortals[String(source.id).padStart(9, '0')] || [];
    equal(map.portals.length, (source.portals || []).length, `Portal count changed: ${source.id}`);
    equal(raw.length, map.portals.length, `Raw portal IDs missing: ${source.id}`);
    map.portals.forEach((portal, i) => {
      const original = source.portals[i];
      check(!portalKeys.has(portal.key), `Duplicate portal key: ${portal.key}`);
      portalKeys.add(portal.key);
      equal(portal.key, `${map.id}:${raw[i].id}`, `Portal ID mismatch: ${portal.key}`);
      equal(portal.number, i + 1, `Portal numbering changed: ${portal.key}`);
      equal(portal.rawId, raw[i].id, `Raw portal ID changed: ${portal.key}`);
      for (const field of ['name', 'type', 'x', 'y']) equal(portal[field], original[field], `Portal ${field} changed: ${portal.key}`);
      const to = original.dest_map_id === 999999999 ? null : original.dest_map_id ?? null;
      equal(portal.to, to, `Raw portal target was altered: ${portal.key}`);
      equal(portal.toPortal, original.dest_portal || '', `Destination portal name changed: ${portal.key}`);
      equal(portal.kind, to === null ? 'unknown' : to === map.id ? 'internal' : 'cross', `Portal kind mismatch: ${portal.key}`);
      equal(portal.noEffect, [1, 10].includes(portal.type), `Portal effect flag changed: ${portal.key}`);
      check(to === null || maps.has(to), `Missing destination map: ${portal.key}`);
      portalKinds[portal.kind]++;
      if (portal.kind === 'cross') pairs.add(`${map.id}:${to}`);
      if (portal.x < 0 || portal.y < 0 || portal.x > map.width || portal.y > map.height) outsideImage.push(portal.key);
    });
    const asset = mapAssets[String(map.id)];
    equal([map.width, map.height], [asset.original_width, asset.original_height], `Original dimensions changed: ${map.id}`);
    equal(imageDimensions(map.image), [asset.rendered_width, asset.rendered_height], `Local render dimensions changed: ${map.id}`);
    if (map.minimap) equal(imageDimensions(map.minimap), [asset.minimap_width, asset.minimap_height], `Minimap dimensions changed: ${map.id}`);
    equal(Boolean(map.minimap), Boolean(source.minimap_url), `Minimap coverage changed: ${map.id}`);
  }
  for (const group of atlas.groups) equal(group.count, atlas.maps.filter(map => map.group === group.id).length, `Group count mismatch: ${group.id}`);
  equal(atlas.meta.stats.maps, maps.size, 'Map statistic mismatch');
  equal(atlas.meta.stats.portals, portalKeys.size, 'Portal statistic mismatch');
  equal(atlas.meta.stats.pairs, pairs.size, 'Connection statistic mismatch');
  for (const [kind, count] of Object.entries(portalKinds)) equal(atlas.meta.stats[kind], count, `${kind} portal statistic mismatch`);
  equal(atlas.meta.stats.scopes, countBy(atlas.maps, map => map.scope), 'Scope statistic mismatch');
  equal(atlas.services.length, serviceSource.edges.length, 'Supplementary service coverage changed');
  equal(atlas.meta.stats.services, atlas.services.length, 'Supplementary service statistic mismatch');
  const serviceIds = new Set();
  for (const edge of atlas.services) {
    check(!serviceIds.has(edge.id), `Duplicate service ID: ${edge.id}`);
    serviceIds.add(edge.id);
    const source = serviceSource.edges.find(row => row.id === edge.id);
    check(source && maps.has(edge.from) && (edge.to === null || maps.has(edge.to)), `Invalid service endpoint: ${edge.id}`);
    equal([edge.from, edge.to, edge.routeAllowed], [source.from, source.to, source.route_allowed], `Service semantics changed: ${edge.id}`);
    check(edge.to !== null || edge.routeAllowed === false, `Unresolved service became routable: ${edge.id}`);
    check(edge.sourceUrls?.length > 0, `Missing service evidence: ${edge.id}`);
  }
  const marketReturn = atlas.services.find(edge => edge.id === 'free-market-return');
  check(marketReturn?.to === null && marketReturn.routeAllowed === false, 'Free Market dynamic return must not become a town shortcut');
  for (const [from, to, rawId] of [[10002071, 10006060, '9'], [10005054, 10006071, '7']]) {
    const edge = atlas.services.find(row => row.from === from && row.to === to && row.kind === 'documented_portal');
    check(edge?.walkable === true && edge.conditional === false, `Documented Hollow entrance missing: ${from}`);
    check(maps.get(from).portals.find(row => row.rawId === rawId)?.to === null, `Scripted entrance overwrote raw portal: ${from}`);
  }
  // This out-of-render event anchor is present in the source. Preserve it.
  equal(outsideImage, ['90040003:6'], 'Changed out-of-render portal anchors need source review');
  console.log(`PASS ${maps.size} maps, ${portalKeys.size} raw portals, ${pairs.size} directed pairs, ${atlas.services.length} documented services`);

  const items = index(hunt.items, 'Items');
  const monsters = index(hunt.monsters, 'Monsters');
  const npcs = index(hunt.npcs, 'NPCs');
  for (const [name, catalog] of [['items', items], ['monsters', monsters], ['npcs', npcs]]) {
    const source = read(`source-data/${name}.json`);
    equal(catalog.size, source.length, `${name} coverage mismatch`);
    equal(hunt.meta.stats[name], source.length, `${name} statistic mismatch`);
    for (const record of source) {
      const row = catalog.get(record.id);
      check(row && row.name === record.name, `${name} identity changed: ${record.id}`);
      if (row.icon) assetPath(row.icon);
      equal(Boolean(row.icon), Boolean(record.icon_url), `${name} icon availability changed: ${record.id}`);
    }
  }
  const pointPairs = new Map();
  const npcLocations = new Map();
  let totalPoints = 0, npcPoints = 0;
  for (const source of sourceMaps) {
    const map = maps.get(source.id);
    const spawns = hunt.mapSpawns[source.id];
    check(spawns, `Missing spawn map: ${source.id}`);
    equal(spawns.points, (source.mobs || []).map(p => ({ mobId: p.mob_id, x: p.x, y: p.y })), `Spawn coordinates changed: ${source.id}`);
    equal(spawns.totalPoints, spawns.points.length, `Spawn total mismatch: ${source.id}`);
    equal(spawns.counts, countBy(spawns.points, p => p.mobId), `Spawn counts mismatch: ${source.id}`);
    equal(spawns.capacity, source.mob_capacity ?? null, `Capacity value changed: ${source.id}`);
    equal(spawns.mobRate, source.mob_rate ?? null, `Mob rate value changed: ${source.id}`);
    for (const point of spawns.points) {
      check(monsters.has(point.mobId), `Unknown monster ${point.mobId} on map ${source.id}`);
      check(point.x >= 0 && point.y >= 0 && point.x <= map.width && point.y <= map.height, `Spawn outside original render: ${source.id}/${point.mobId}`);
      const key = `${source.id}:${point.mobId}`;
      pointPairs.set(key, (pointPairs.get(key) || 0) + 1);
      totalPoints++;
    }
    const placements = hunt.mapNpcs[source.id];
    equal(placements, (source.npcs || []).map(p => ({ npcId: p.npc_id, x: p.x, y: p.y })), `NPC coordinates changed: ${source.id}`);
    equal(map.npcs.map(p => ({ npcId: p.id, x: p.x, y: p.y })), placements, `Atlas/catalog NPC placements differ: ${source.id}`);
    for (const point of placements) {
      check(npcs.has(point.npcId), `Unknown NPC ${point.npcId} on map ${source.id}`);
      check(point.x >= 0 && point.y >= 0 && point.x <= map.width && point.y <= map.height, `NPC outside original render: ${source.id}/${point.npcId}`);
      const key = point.npcId;
      if (!npcLocations.has(key)) npcLocations.set(key, new Map());
      const locations = npcLocations.get(key);
      if (!locations.has(map.id)) locations.set(map.id, []);
      locations.get(map.id).push({ x: point.x, y: point.y });
      npcPoints++;
    }
  }
  equal(Object.keys(hunt.mapSpawns).length, maps.size, 'Extra or missing spawn-map records');
  equal(Object.keys(hunt.mapNpcs).length, maps.size, 'Extra or missing NPC-map records');
  const catalogPairs = new Map();
  for (const monster of monsters.values()) {
    equal(monster.hasRecordedSpawn, monster.spawns.length > 0, `Monster availability flag mismatch: ${monster.id}`);
    for (const spawn of monster.spawns) {
      const key = `${spawn.mapId}:${monster.id}`;
      check(!catalogPairs.has(key), `Duplicate monster/map pair: ${key}`);
      catalogPairs.set(key, spawn.count);
    }
  }
  equal(catalogPairs, pointPairs, 'Monster catalog counts do not match exact map points');
  for (const npc of npcs.values()) {
    const expected = [...(npcLocations.get(npc.id) || new Map()).entries()].sort((a, b) => a[0] - b[0]).map(([mapId, points]) => ({ mapId, points }));
    equal(npc.maps, expected, `NPC catalog locations differ from map points: ${npc.id}`);
    equal(npc.hasRecordedLocation, expected.length > 0, `NPC availability flag mismatch: ${npc.id}`);
  }
  equal(hunt.meta.stats.spawnPoints, totalPoints, 'Spawn-point statistic mismatch');
  equal(hunt.meta.stats.monsterMapPairs, pointPairs.size, 'Monster/map pair statistic mismatch');
  equal(hunt.meta.stats.npcPlacements, npcPoints, 'NPC placement statistic mismatch');
  console.log(`PASS ${items.size} items, ${monsters.size} monsters, ${npcs.size} NPCs, ${totalPoints} spawn points and ${npcPoints} NPC placements`);

  let iconBytes = 0;
  for (const [name, info] of Object.entries(iconManifest.files)) {
    const bytes = readFileSync(assetPath(name));
    equal(sha256(bytes), info.sha256, `Icon hash changed: ${name}`);
    equal(bytes.length, info.bytes, `Icon byte count changed: ${name}`);
    equal(imageDimensions(name), [info.width, info.height], `Icon dimensions changed: ${name}`);
    iconBytes += bytes.length;
  }
  equal(hunt.meta.stats.localIcons, Object.keys(iconManifest.files).length, 'Icon count statistic mismatch');
  equal(hunt.meta.stats.localIconBytes, iconBytes, 'Icon byte statistic mismatch');
  check(iconManifest.errors.length === 0, 'Icon download errors are recorded');
  console.log(`PASS ${assets.size} referenced image files; ${Object.keys(iconManifest.files).length} icons also match their SHA-256 hashes`);

  const dropPairs = new Set();
  for (const row of [...drops.links, ...drops.unresolved]) {
    check(items.get(row.itemId)?.name === row.itemName, `Invalid drop item: ${row.itemId}`);
    check(['classic_counted', 'classic_confirmed', 'team_seen'].includes(row.status), `Unconfirmed drop status: ${row.itemId}`);
    check(row.sourceUrl && row.attribution && row.license && row.checkedAt, `Missing drop provenance: ${row.itemId}`);
    check(row.retestedInVersion2 === false, `Drop retesting claim needs evidence: ${row.itemId}`);
    check(!Object.entries(row).some(([key, value]) => typeof value === 'number' && /rate|chance|probability/i.test(key)), `Numeric drop rate was introduced: ${row.itemId}`);
  }
  for (const row of drops.links) {
    check(monsters.get(row.mobId)?.name === row.mobName, `Invalid drop monster: ${row.mobId}`);
    equal(monsters.get(row.mobId).level, row.mobLevel, `Drop monster variant mismatch: ${row.mobId}`);
    const key = `${row.itemId}:${row.mobId}`;
    check(!dropPairs.has(key), `Duplicate drop relationship: ${key}`);
    dropPairs.add(key);
  }
  for (const row of drops.unresolved) {
    check(row.mobId === null && row.routeAllowed === false, 'An ambiguous drop observation became routable');
    check(row.candidateMobIds.every(id => monsters.has(id)), 'Unknown ambiguous monster candidate');
  }
  equal(drops.meta.acceptedRelationships, drops.links.length, 'Drop count statistic mismatch');
  equal(drops.meta.unresolvedRelationships, drops.unresolved.length, 'Unresolved drop count mismatch');
  equal(drops.meta.coveredItemIds, new Set(drops.links.map(row => row.itemId)).size, 'Drop item coverage mismatch');
  equal(drops.meta.coveredMonsterIds, new Set(drops.links.map(row => row.mobId)).size, 'Drop monster coverage mismatch');
  equal(drops.meta.allKnownGameDrops, false, 'Community observations must stay labelled as partial');
  equal(drops.meta.dropRatesIncluded, false, 'Drop-rate exclusion flag changed');
  console.log(`PASS ${drops.links.length} attributed Classic drop links and ${drops.unresolved.length} explicitly unresolved observation`);

  for (const file of [...readdirSync(dist).filter(name => name.endsWith('.js')).map(name => `dist/${name}`), ...readdirSync(join(root, 'scripts')).filter(name => name.endsWith('.mjs')).map(name => `scripts/${name}`)]) {
    const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8', windowsHide: true });
    check(result.status === 0, `JavaScript syntax error in ${file}: ${result.stderr || result.error?.message}`);
  }
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const path = match[1].split(/[?#]/)[0];
    if (path && !/^(?:[a-z]+:|\/\/)/i.test(path)) check(existsSync(resolve(dist, `.${path.startsWith('/') ? '' : '/' }${path}`)), `Missing HTML dependency: ${path}`);
  }
  const server = await createStaticServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, options = {}) => fetch(base + path, { ...options, signal: AbortSignal.timeout(5000) });
    const home = await request('/');
    check(home.status === 200 && await home.text() === html, 'Static server did not serve index.html');
    const data = await request('/atlas-data.json', { method: 'HEAD' });
    check(data.status === 200 && data.headers.get('content-type').startsWith('application/json'), 'Static server JSON/HEAD support failed');
    check((await request('/missing-data.json')).status === 404, 'Missing data must return 404');
    check((await request('/source-data/meta.json')).status === 404, 'Only dist/ should be served');
    check((await request('/..%2fsource-data%2fmeta.json')).status === 403, 'Encoded traversal should be rejected');
    check((await request('/', { method: 'POST' })).status === 405, 'Static server must reject write methods');
  } finally {
    server.closeAllConnections();
    await new Promise(resolveClose => server.close(resolveClose));
  }
  console.log('PASS JavaScript syntax, local HTML dependencies and static HTTP smoke checks');
  console.log('All checks passed. This verifies the archived snapshot and app data contracts; live game accessibility requires separate evidence.');
}

main().catch(error => {
  console.error(`Verification failed: ${error.message}`);
  process.exitCode = 1;
});
