#!/usr/bin/env python3
"""Normalize Classic World item, monster and exact spawn-point information.

Drop relationships deliberately do not originate here: the client dataset does
not publish server-side drop tables. All records stay keyed by game ID, because
different variants can share the same display name.
"""

from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source-data"
DIST = ROOT / "dist"
COMMIT = "8ec33d9a51855ddcf84edf1230793bf927c1da55"
RAW_BASE = f"https://raw.githubusercontent.com/ohmi69/osms_datamine_dashboard/{COMMIT}/"
ICON_MANIFEST = SOURCE / "hunt-icon-manifest.json"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def image_info(url):
    path = urllib.parse.urlparse(url).path.lstrip("/")
    if "/images/items/" in path:
        relative = "assets/items/" + Path(path).name
    elif "/images/monsters/" in path:
        relative = "assets/monsters/" + Path(path).name
    elif "/images/npcs/" in path:
        relative = "assets/npcs/" + Path(path).name
    else:
        raise ValueError(f"Unrecognized source image path: {path}")
    return relative, RAW_BASE + path


def fetch_icons(records):
    """Cache every unique tiny source PNG without modifying its content."""
    jobs = {}
    for row in records:
        if not row.get("icon_url"):
            continue
        relative, source = image_info(row["icon_url"])
        jobs[relative] = source
    manifest = read(ICON_MANIFEST) if ICON_MANIFEST.exists() else {"sourceCommit": COMMIT, "files": {}}
    errors = []

    def fetch(job):
        relative, source = job
        destination = DIST / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            if destination.exists():
                raw = destination.read_bytes()
            else:
                with urllib.request.urlopen(source, timeout=35) as response:
                    raw = response.read()
                if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
                    raise ValueError("Response is not a PNG")
                destination.write_bytes(raw)
            if not raw.startswith(b"\x89PNG\r\n\x1a\n") or len(raw) < 24:
                raise ValueError("Cached file is not a complete PNG header")
            width = int.from_bytes(raw[16:20], "big")
            height = int.from_bytes(raw[20:24], "big")
            return relative, {"sourceUrl": source, "bytes": len(raw), "width": width,
                              "height": height, "sha256": hashlib.sha256(raw).hexdigest()}, None
        except Exception as exc:
            return relative, None, str(exc)

    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = [pool.submit(fetch, job) for job in sorted(jobs.items())]
        for completed, future in enumerate(as_completed(futures), 1):
            relative, result, error = future.result()
            if error:
                errors.append({"path": relative, "error": error})
            else:
                manifest["files"][relative] = result
            if completed % 100 == 0 or completed == len(jobs):
                manifest["errors"] = errors
                ICON_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
                print(json.dumps({"iconsDone": completed, "total": len(jobs), "errors": len(errors)}), flush=True)
    total_bytes = sum(info["bytes"] for info in manifest["files"].values())
    assert total_bytes < 5_000_000, f"Icon budget exceeded: {total_bytes}"
    print(json.dumps({"iconBytes": total_bytes, "icons": len(manifest["files"]), "errors": errors}), flush=True)
    return manifest


def normalized_timer(value):
    """Keep the source text and optionally expose its numeric form, in seconds."""
    if value is None:
        return None
    match = re.fullmatch(r"(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?)(?: \[(\d+(?:\.\d+)?)\])?)?", value)
    if not match:
        return {"raw": value}
    minimum = float(match[1])
    maximum = float(match[2]) if match[2] else minimum
    mean = float(match[3]) if match[3] else minimum if maximum == minimum else None
    return {"raw": value, "minSeconds": minimum, "maxSeconds": maximum, "meanSeconds": mean}


def build():
    metadata = read(SOURCE / "meta.json")
    source_rows = {}
    for filename, expected in [("items.json", 2353), ("monsters.json", 128), ("maps.json", 364), ("npcs.json", 311)]:
        raw = (SOURCE / filename).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == metadata["files"][filename]["sha256"]
        rows = json.loads(raw)
        assert len(rows) == len({r["id"] for r in rows}) == expected
        source_rows[filename] = rows
    source_items, source_monsters, source_maps = (source_rows[n] for n in ("items.json", "monsters.json", "maps.json"))
    source_npcs = source_rows["npcs.json"]
    items = []
    for item in source_items:
        local_icon, original_icon = image_info(item["icon_url"])
        items.append({
            "id": item["id"], "name": item["name"], "category": item["category"],
            "subCategory": item.get("sub_category"), "icon": local_icon,
            "originalIcon": original_icon,
            "sourceUrl": "https://osmsdataexplorer.com/#" + ("equipment" if item["category"] == "Equipment" else "items") + f"?q=id:{item['id']}",
        })
    monsters = []
    for monster in source_monsters:
        local_icon, original_icon = image_info(monster["icon_url"])
        spawns = []
        for spawn in monster.get("spawns", []):
            entry = {"mapId": spawn["map_id"], "count": spawn["count"]}
            if "mob_time" in spawn:
                entry["mobTime"] = spawn["mob_time"]
                entry["timer"] = normalized_timer(spawn["mob_time"])
            spawns.append(entry)
        monsters.append({
            "id": monster["id"], "name": monster["name"], "level": monster["level"],
            "hp": monster["hp"], "exp": monster["exp"], "isBoss": monster["is_boss"],
            "icon": local_icon, "originalIcon": original_icon,
            "sourceUrl": f"https://osmsdataexplorer.com/#monsters?q=id:{monster['id']}",
            "spawns": spawns, "hasRecordedSpawn": bool(spawns),
        })
    map_spawns = {}
    map_npcs = {}
    npc_locations = {}
    point_counts = Counter()
    for m in source_maps:
        points = [{"mobId": p["mob_id"], "x": p["x"], "y": p["y"]} for p in m.get("mobs", [])]
        counts = Counter(point["mobId"] for point in points)
        map_spawns[str(m["id"])] = {
            "points": points, "totalPoints": len(points), "capacity": m.get("mob_capacity"),
            "mobRate": m.get("mob_rate"), "counts": dict(sorted(counts.items())),
        }
        for mob_id, count in counts.items():
            point_counts[(m["id"], mob_id)] += count
        map_npcs[str(m["id"])] = [{"npcId": n["npc_id"], "x": n["x"], "y": n["y"]} for n in m.get("npcs", [])]
        for n in m.get("npcs", []):
            npc_locations.setdefault(n["npc_id"], {}).setdefault(m["id"], []).append({"x": n["x"], "y": n["y"]})
    npcs = []
    for npc in source_npcs:
        locations = npc_locations.get(npc["id"], {})
        assert set(npc.get("maps", [])) == set(locations), f"NPC location mismatch for {npc['id']}"
        local_icon, original_icon = image_info(npc["icon_url"]) if npc.get("icon_url") else (None, None)
        npcs.append({
            "id": npc["id"], "name": npc["name"], "icon": local_icon, "originalIcon": original_icon,
            "sourceUrl": f"https://osmsdataexplorer.com/#npcs?q=id:{npc['id']}",
            "maps": [{"mapId": map_id, "points": points} for map_id, points in sorted(locations.items())],
            "hasRecordedLocation": bool(locations),
        })
    source_counts = {(s["mapId"], m["id"]): s["count"] for m in monsters for s in m["spawns"]}
    assert source_counts == dict(point_counts), "Monster spawn counts and exact map points disagree"
    assert len({m["id"] for m in monsters} - {p["mobId"] for s in map_spawns.values() for p in s["points"]}) == 30
    icon_manifest = read(ICON_MANIFEST) if ICON_MANIFEST.exists() else {"files": {}}
    stats = {
        "items": len(items), "monsters": len(monsters), "maps": len(map_spawns),
        "mapsWithSpawns": sum(bool(m["points"]) for m in map_spawns.values()),
        "spawnPoints": sum(m["totalPoints"] for m in map_spawns.values()),
        "monsterMapPairs": len(source_counts),
        "monstersWithSpawns": sum(m["hasRecordedSpawn"] for m in monsters),
        "bossRecords": sum(m["isBoss"] for m in monsters),
        "distinctBossNames": len({m["name"] for m in monsters if m["isBoss"]}),
        "bossesWithRecordedSpawns": sum(m["isBoss"] and m["hasRecordedSpawn"] for m in monsters),
        "npcs": len(npcs), "npcsWithRecordedLocations": sum(n["hasRecordedLocation"] for n in npcs),
        "npcPlacements": sum(len(points) for points in map_npcs.values()),
        "mapsWithNpcs": sum(bool(points) for points in map_npcs.values()),
        "localIcons": len(icon_manifest["files"]),
        "localIconBytes": sum(i["bytes"] for i in icon_manifest["files"].values()),
    }
    dataset = {
        "meta": {
            "game": "MapleStory Classic World", "version": "2.0.0", "asOf": "2026-11-19",
            "dataUpdatedAt": metadata["data_updated_at"], "clientBuild": metadata["client_build"],
            "sourceCommit": COMMIT, "sourceUrl": "https://osmsdataexplorer.com/data/api/v1/README.md",
            "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "Data from OSMS Data Explorer (https://osmsdataexplorer.com), CC BY 4.0. Records normalized and mapped to the atlas; original images unchanged. Game content and artwork © Nexon.",
            "sources": [{"file": name, "url": RAW_BASE + "data/api/v1/" + name, **metadata["files"][name]} for name in ("items.json", "monsters.json", "maps.json", "npcs.json")],
            "stats": stats,
            "spawnShareFormula": "100 * recorded target spawn points / all recorded monster spawn points on this map",
            "spawnShareNote": "ריכוז היעד הוא חלקן של נקודות ההופעה המתועדות של המפלצות הנבחרות מכל נקודות ההופעה במפה. זהו מדד להרכב המפה, לא סיכוי לנפילת פריט ולא מספר המפלצות החיות כרגע.",
            "countNote": "מספר נקודות ההופעה וקיבולת המפה הם שדות שונים. ספירת נקודות אינה מבטיחה שכל המפלצות נמצאות במפה באותו רגע.",
            "coordinateSpace": "original-full-render-pixels-top-left",
            "coordinateNote": "מיקומי ההופעה נמדדים בתמונת המפה המקורית. לנרמול הסימונים יש להשתמש ברוחב ובגובה המקוריים שבנתוני האטלס.",
            "bossNote": "הסימון מציין נקודת הופעה רשומה. הבוס יכול לנוע ממנה לאחר הופעתו. היעדר נקודה במקור אינו מוכיח שהבוס אינו קיים, ואין להסיק ממנו מיקום.",
            "timerNote": "זמני ההופעה נשמרו כפי שפורסמו בנתוני המקור. ערכים של טווח וממוצע אינם שעון חי ואינם מבטיחים מועד הופעה בשרת.",
            "dropNote": "טבלאות נפילת הפריטים נקבעות בשרת ואינן נכללות בקובצי הלקוח הללו. קשרי פריט ומפלצת חייבים להגיע ממקור נוסף ומיוחס.",
            "identityNote": "שמות פריטים, מפלצות ודמויות אינם מזהים ייחודיים. גרסאות בעלות אותו שם נשמרות לפי המזהה שלהן ולא אוחדו.",
            "npcNote": "מיקומי הדמויות נאספו מכל רשומות המפה ונבדקו מול קטלוג הדמויות. לדמות ללא מיקום מתועד לא הומצאה דרך הגעה.",
            "missingValueNote": "קיבולת או מכפיל הופעה שלא פורסמו במקור נשארו ריקים. לא הושלמו ערכי מדידה בניחוש.",
        },
        "items": items, "monsters": monsters, "mapSpawns": map_spawns, "npcs": npcs, "mapNpcs": map_npcs,
    }
    (DIST / "hunt-data.json").write_text(json.dumps(dataset, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    audit = {
        "stats": stats, "verifiedSpawnCountPairs": len(source_counts),
        "bossSpawnPoints": [{"id": m["id"], "name": m["name"], "spawns": [{**s, "points": [p for p in map_spawns[str(s["mapId"])]["points"] if p["mobId"] == m["id"]]} for s in m["spawns"]]} for m in monsters if m["isBoss"]],
        "duplicateItemNames": {name: count for name, count in Counter(i["name"] for i in items).items() if count > 1},
        "duplicateMonsterNames": {name: count for name, count in Counter(m["name"] for m in monsters).items() if count > 1},
        "duplicateNpcNames": {name: count for name, count in Counter(n["name"] for n in npcs).items() if count > 1},
    }
    (SOURCE / "hunt-build-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"huntDataBytes": (DIST / "hunt-data.json").stat().st_size, "stats": stats}), flush=True)
    return source_items + source_monsters + source_npcs


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--icons", action="store_true", help="Download all tiny source icons, then refresh metadata")
    options = parser.parse_args()
    entities = build()
    if options.icons:
        fetch_icons(entities)
        build()
