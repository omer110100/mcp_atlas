#!/usr/bin/env python3
"""Build the complete Classic World atlas from a pinned, licensed source snapshot.

Only the overview coordinates are schematic. Portal coordinates stay in the
source full-render pixel space. No portal target is inferred from a map name,
return-map metadata, a reciprocal connection, or the order of quest maps.
"""

from __future__ import annotations

import collections
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source-data"
DIST = ROOT / "dist"
ASSET_MANIFEST = SOURCE / "asset-manifest.json"
COMMIT = "8ec33d9a51855ddcf84edf1230793bf927c1da55"
RAW_BASE = f"https://raw.githubusercontent.com/ohmi69/osms_datamine_dashboard/{COMMIT}/"
DATA_URL = "https://osmsdataexplorer.com/data/api/v1/maps.json"


# These positions are a designed atlas arrangement, not in-game geography.
GROUPS = [
    dict(id="maple", he="אי ההתחלה", en="Maple Island", color="#a1d68b", x=480, y=280, rx=300, ry=180, root=1010),
    dict(id="kerning", he="קרנינג והביצות", en="Kerning City", color="#a3accd", x=500, y=850, rx=350, ry=350, root=10003000),
    dict(id="perion", he="פריון וההרים", en="Perion", color="#e2a36f", x=1170, y=550, rx=345, ry=250, root=10004000),
    dict(id="ellinia", he="אליניה והיערות", en="Ellinia", color="#79d5b1", x=1960, y=850, rx=350, ry=345, root=10002000),
    dict(id="henesys", he="הנסיס והשדות", en="Henesys", color="#edca78", x=1390, y=1530, rx=370, ry=300, root=10001000),
    dict(id="lith", he="לית והחופים", en="Lith Harbor", color="#87cddd", x=500, y=1520, rx=285, ry=270, root=10000000),
    dict(id="sleepy", he="סליפיווד והמעמקים", en="Sleepywood", color="#b6a3df", x=1200, y=1060, rx=345, ry=245, root=10005000),
    dict(id="hollow", he="החלל הנשכח", en="Forgotten Hollow", color="#9db3f0", x=2060, y=1510, rx=310, ry=300, root=10006000),
    dict(id="florina", he="חוף פלורינה", en="Florina Beach", color="#77cdd0", x=500, y=2070, rx=290, ry=155, root=10007000),
    dict(id="market", he="השוק החופשי", en="Free Market", color="#d2b1e3", x=2070, y=290, rx=320, ry=180, root=80002000),
    dict(id="special", he="משימות ומבחנים", en="Quests & Trials", color="#d4acd3", x=2700, y=1550, rx=255, ry=350, root=80000000),
    dict(id="events", he="מפות אירועים", en="Event Maps", color="#e7b3ab", x=2700, y=550, rx=255, ry=320, root=90040000),
    dict(id="system", he="חדרים מיוחדים", en="System Rooms", color="#95a4b4", x=2700, y=2100, rx=255, ry=155, root=89000000),
]
MAJOR_TOWNS = {20, 60, 1010, 10000000, 10001000, 10002000, 10003000,
               10004000, 10005000, 10006000, 10007000}
MARK_GROUP = {"Rith": "lith", "Henesys": "henesys", "Ellinia": "ellinia",
              "KerningCity": "kerning", "Perion": "perion", "Dungeon": "sleepy",
              "ForgottenHollow": "hollow"}
SYSTEM_IDS = {89000000, 99999999, 900000000}
HOUSING_IDS = {10001008, 10003008, 88000000, 88001000}
JUMP_IDS = set(range(10002040, 10002045)) | set(range(10005040, 10005047)) | set(range(10003100, 10003110))


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def prepare_output():
    """Rebuild only from the source snapshot included in this checkout."""
    required = ("maps.json", "meta.json", "portals-raw.json", "maps-raw.json",
                "map-manifest.json", "service_connections.json", "asset-manifest.json")
    missing = [name for name in required if not (SOURCE / name).is_file()]
    if missing:
        raise FileNotFoundError("Missing pinned source files: " + ", ".join(missing))
    DIST.mkdir(parents=True, exist_ok=True)


def snapshot_local_deadline(utc_text):
    """Use the reviewed local time for this immutable event snapshot.

    This avoids an operating-system timezone-database dependency on Windows.
    A future deadline must be reviewed explicitly, including its DST offset.
    """
    reviewed = {"2026-12-09T23:59:00Z": "2026-12-10T01:59:00+02:00"}
    if utc_text not in reviewed:
        raise ValueError(f"Review the Israel-local time for new deadline: {utc_text}")
    local_time = datetime.fromisoformat(reviewed[utc_text])
    assert local_time.astimezone(timezone.utc) == datetime.fromisoformat(utc_text.replace("Z", "+00:00"))
    return local_time.isoformat()


def group_for(m):
    mid = m["id"]
    if m["region"] == "Maple Island":
        return "maple"
    if mid in SYSTEM_IDS or m["region"] == "Dev":
        return "system"
    if m["region"] == "Event":
        return "events"
    if 80002000 <= mid <= 80002020:
        return "market"
    if 10007000 <= mid <= 10007040:
        return "florina"
    if m["region"] == "Other" and mid not in HOUSING_IDS:
        return "special"
    if mid == 88000000:
        return "henesys"
    if mid == 88001000:
        return "kerning"
    if mid == 10002004:
        return "ellinia"
    return MARK_GROUP.get(m.get("map_mark"), "special")


def scope_for(m):
    mid = m["id"]
    if mid in SYSTEM_IDS or m["region"] == "Dev":
        return "system"
    if m["region"] == "Event":
        return "event"
    if mid == 10002091:
        return "unavailable"
    if mid in HOUSING_IDS or mid in JUMP_IDS:
        return "conditional"
    if group_for(m) == "special":
        return "conditional"
    return "world"


def make_adjacency(maps):
    ids = {m["id"] for m in maps}
    adj = {mid: set() for mid in ids}
    for m in maps:
        for p in m["portals"]:
            target = p["to"]
            if target in ids and target != m["id"]:
                adj[m["id"]].add(target)
                adj[target].add(m["id"])
    return adj


def place_group(group, nodes, adjacency):
    """Deterministic BFS radial initialization with spring/collision relaxation."""
    ids = sorted(n["id"] for n in nodes)
    if not ids:
        return {}
    root = group["root"] if group["root"] in ids else ids[0]
    local = set(ids)
    neighbors = {mid: sorted(adjacency[mid] & local) for mid in ids}
    children = {mid: [] for mid in ids}
    depth = {root: 0}
    queue = collections.deque([root])
    while queue:
        current = queue.popleft()
        for target in neighbors[current]:
            if target not in depth:
                depth[target] = depth[current] + 1
                children[current].append(target)
                queue.append(target)
    disconnected = [mid for mid in ids if mid not in depth]
    # Unconnected records remain separate islands; this does not create edges.
    for mid in disconnected:
        depth[mid] = 1

    leaves = {}
    def weight(mid):
        leaves[mid] = sum(weight(child) for child in children[mid]) if children[mid] else 1
        return leaves[mid]
    weight(root)
    angles = {root: -math.pi / 2}
    def assign_angles(mid, low, high):
        cursor = low
        total = sum(leaves[c] for c in children[mid]) or 1
        for child in children[mid]:
            span = (high - low) * leaves[child] / total
            angles[child] = cursor + span / 2
            assign_angles(child, cursor, cursor + span)
            cursor += span
    # Reserve a small sector for records without a fixed portal connection.
    connected_span = 2 * math.pi * (0.84 if disconnected else 1)
    assign_angles(root, -math.pi / 2, -math.pi / 2 + connected_span)
    for index, mid in enumerate(disconnected):
        angles[mid] = -math.pi / 2 + connected_span + (index + .5) * (2 * math.pi - connected_span) / max(1, len(disconnected))

    max_depth = max(depth.values()) or 1
    rx, ry = group["rx"] - 24, group["ry"] - 24
    pos = {}
    for index, mid in enumerate(ids):
        if mid == root:
            pos[mid] = [0.0, 0.0]
            continue
        r = .18 + .63 * math.sqrt(depth[mid] / max_depth)
        if mid in disconnected:
            r = .75 + .12 * (index % 3) / 2
        angle = angles.get(mid, index * 2.3999632297)
        pos[mid] = [rx * r * math.cos(angle), ry * r * math.sin(angle)]
    initial = {mid: point[:] for mid, point in pos.items()}
    edges = sorted({tuple(sorted((mid, target))) for mid in ids for target in neighbors[mid]})
    major = {n["id"] for n in nodes if n["major"]}

    def clamp(mid):
        x, y = pos[mid]
        extent = math.sqrt((x / rx) ** 2 + (y / ry) ** 2)
        if extent > .96:
            pos[mid][0] *= .96 / extent
            pos[mid][1] *= .96 / extent

    for iteration in range(520):
        forces = {mid: [0.0, 0.0] for mid in ids}
        for ai, left in enumerate(ids):
            for right in ids[ai + 1:]:
                dx = pos[right][0] - pos[left][0]
                dy = pos[right][1] - pos[left][1]
                dist = math.hypot(dx, dy)
                if dist < .001:
                    angle = (left * 1.31 + right * .97) % (2 * math.pi)
                    dx, dy, dist = math.cos(angle), math.sin(angle), 1.0
                spacing = 76 if left in major or right in major else 52
                force = 1600 / max(dist * dist, 25)
                if dist < spacing:
                    force += (spacing - dist) * .46
                fx, fy = dx / dist * force, dy / dist * force
                forces[left][0] -= fx
                forces[left][1] -= fy
                forces[right][0] += fx
                forces[right][1] += fy
        for left, right in edges:
            dx = pos[right][0] - pos[left][0]
            dy = pos[right][1] - pos[left][1]
            dist = math.hypot(dx, dy) or .001
            wanted = 94 if left in major or right in major else 70
            force = (dist - wanted) * .025
            fx, fy = dx / dist * force, dy / dist * force
            forces[left][0] += fx
            forces[left][1] += fy
            forces[right][0] -= fx
            forces[right][1] -= fy
        temp = 4.5 * (1 - iteration / 650)
        for mid in ids:
            if mid == root:
                pos[mid] = [0.0, 0.0]
                continue
            # A mild tether preserves branch sectors instead of random reshuffling.
            forces[mid][0] += (initial[mid][0] - pos[mid][0]) * .006
            forces[mid][1] += (initial[mid][1] - pos[mid][1]) * .006
            length = math.hypot(*forces[mid]) or 1
            scale = min(1.0, temp / length)
            pos[mid][0] += forces[mid][0] * scale
            pos[mid][1] += forces[mid][1] * scale
            clamp(mid)

    # Finish with geometric separation. This affects layout only, never routing.
    for _ in range(160):
        changed = False
        for ai, left in enumerate(ids):
            for right in ids[ai + 1:]:
                dx = pos[right][0] - pos[left][0]
                dy = pos[right][1] - pos[left][1]
                dist = math.hypot(dx, dy)
                minimum = 69 if left in major or right in major else 47
                if dist >= minimum:
                    continue
                changed = True
                if dist < .001:
                    dx, dy, dist = 1.0, 0.0, 1.0
                move = (minimum - dist + .1) / (1 if root in (left, right) else 2)
                ux, uy = dx / dist, dy / dist
                if left != root:
                    pos[left][0] -= ux * move
                    pos[left][1] -= uy * move
                    clamp(left)
                if right != root:
                    pos[right][0] += ux * move
                    pos[right][1] += uy * move
                    clamp(right)
        if not changed:
            break
    return {mid: (round(group["x"] + x, 1), round(group["y"] + y, 1)) for mid, (x, y) in pos.items()}


def notes_for(m, incoming):
    mid, scope = m["id"], m["scope"]
    notes = []
    if scope == "unavailable":
        notes.append("רשומת מסוף ההפלגה קיימת בנתוני הלקוח, אך אוסיריה ואורביס אינם פתוחים בגרסה הנוכחית. אין כאן מסלול הפלגה זמין.")
    elif scope == "system":
        notes.append("חדר מערכת או בדיקה שמופיע בנתוני הלקוח. זמינותו לשחקן רגיל ודרך הכניסה אליו אינן מאומתות.")
    elif scope == "event":
        notes.append("מפת אירוע שנמצאה בנתוני הלקוח. הופעתה כאן אינה מאשרת שהאירוע פעיל כעת או שקיימת כניסה חופשית.")
    elif mid in HOUSING_IDS:
        notes.append("מפת מגורים. הגישה בפועל תלויה במערכת המגורים ובהרשאות הדמות; אין להסיק שכל בית פתוח לכל שחקן.")
    elif mid in JUMP_IDS:
        notes.append("מפת משימה או מסלול קפיצות. הכניסה וההתקדמות עשויות להיות מותנות במשימה המתאימה.")
    elif 80001000 <= mid <= 80001300:
        notes.append("מבחן קידום לעבודה השנייה. הכניסה נעשית דרך המדריך ובכפוף למקצוע, לרמה ולמשימת הקידום.")
    elif 80000000 <= mid <= 80000600:
        notes.append("שלב במשימה הקבוצתית בקרנינג. מעברי השלבים מותנים בהשלמת המשימה ומוצגים בנפרד מהפורטלים הקבועים.")
    elif 80003000 <= mid <= 80003400:
        notes.append("מפה של משימת ארנב הירח. זוהי פעילות מוגבלת בזמן ובתנאי קבוצה; רצף המעברים שלא פורסם במקור לא הומצא.")
    if mid == 10001008:
        notes.append("שם הרשומה נשמר בדיוק כפי שפורסם במקור, אף שהוא נראה כשם רחוב. המזהה מבדיל אותה מבית הפטרייה בעל השם המוכר.")
    if mid == 80002000:
        notes.append("היציאה מהשוק מחזירה למקום שממנו נכנסת. אין להשתמש בו כמעבר חופשי בין שתי ערים שונות.")
    if not incoming.get(mid) and scope == "world" and mid not in {1, 60, 10007000, 80002000}:
        notes.append("אין בנתוני הפורטלים כניסה קבועה שמקושרת למפה זו. ייתכן שהגישה מופעלת בשיחה או במשימה.")
    return notes


def separate_group_boundaries(maps):
    """Keep nodes from adjacent schematic areas clear at their shared boundary."""
    by_group = {g["id"]: g for g in GROUPS}
    fixed = {g["root"] for g in GROUPS}
    def constrain(m):
        g = by_group[m["group"]]
        rx, ry = g["rx"] - 24, g["ry"] - 24
        dx, dy = m["x"] - g["x"], m["y"] - g["y"]
        extent = math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
        if extent > .96:
            m["x"] = g["x"] + dx * .96 / extent
            m["y"] = g["y"] + dy * .96 / extent
    for _ in range(140):
        changed = False
        for i, left in enumerate(maps):
            for right in maps[i + 1:]:
                dx, dy = right["x"] - left["x"], right["y"] - left["y"]
                minimum = 69 if left["major"] or right["major"] else 47
                if abs(dx) >= minimum or abs(dy) >= minimum:
                    continue
                dist = math.hypot(dx, dy)
                if dist >= minimum:
                    continue
                changed = True
                movable = int(left["id"] not in fixed) + int(right["id"] not in fixed)
                if not movable:
                    continue
                if dist < .001:
                    dx, dy, dist = 1, 0, 1
                shift = (minimum - dist + .15) / movable
                if left["id"] not in fixed:
                    left["x"] -= dx / dist * shift
                    left["y"] -= dy / dist * shift
                    constrain(left)
                if right["id"] not in fixed:
                    right["x"] += dx / dist * shift
                    right["y"] += dy / dist * shift
                    constrain(right)
        if not changed:
            break
    for m in maps:
        m["x"], m["y"] = round(m["x"], 1), round(m["y"], 1)


def main():
    prepare_output()
    raw_maps = read(SOURCE / "maps.json")
    metadata = read(SOURCE / "meta.json")
    raw_portals = read(SOURCE / "portals-raw.json")
    internal_maps = read(SOURCE / "maps-raw.json")
    image_hashes = read(SOURCE / "map-manifest.json")
    services_source = read(SOURCE / "service_connections.json")
    manifest = read(ASSET_MANIFEST)
    assets = manifest.get("maps", manifest)
    npc_lookup = internal_maps.get("npc_lookup", {})
    assert hashlib.sha256((SOURCE / "maps.json").read_bytes()).hexdigest() == metadata["files"]["maps.json"]["sha256"]
    maps = []
    for source_map in raw_maps:
        mid = source_map["id"]
        original = raw_portals.get(f"{mid:09d}", [])
        assert len(original) == len(source_map.get("portals", []))
        portals = []
        for index, (p, raw) in enumerate(zip(source_map.get("portals", []), original)):
            assert all(p[k] == raw[k] for k in ("name", "type", "x", "y"))
            to = p.get("dest_map_id")
            if to == 999999999:
                to = None
            portals.append({
                "key": f"{mid}:{raw['id']}", "number": index + 1,
                "rawId": raw["id"], "name": p["name"], "type": p["type"],
                "x": p["x"], "y": p["y"], "to": to,
                "toPortal": p.get("dest_portal", ""),
                "kind": "unknown" if to is None else "internal" if to == mid else "cross",
                "noEffect": p["type"] in (1, 10),
            })
        image_hash = image_hashes[f"{mid:09d}"]
        asset = assets.get(str(mid), {})
        m = {
            "id": mid, "name": source_map["name"], "street": source_map.get("street_name", ""),
            "region": source_map["region"], "group": group_for(source_map),
            "scope": scope_for(source_map), "major": mid in MAJOR_TOWNS,
            "hiddenArea": source_map.get("street_name") == "Hidden Street",
            "isTown": bool(source_map.get("is_town", False)),
            "isNew": 10006000 <= mid <= 10006162 or 80003000 <= mid <= 80003400,
            "x": 0, "y": 0, "portals": portals,
            "npcs": [{"id": n["npc_id"], "name": npc_lookup.get(str(n["npc_id"]), {}).get("name", str(n["npc_id"])),
                      "x": n["x"], "y": n["y"]} for n in source_map.get("npcs", [])],
            "image": asset.get("image_path") or f"assets/maps/{image_hash}.webp",
            "minimap": (asset.get("minimap_path") or f"assets/minimaps/{mid}.png") if source_map.get("minimap_url") else None,
            "originalImage": RAW_BASE + f"data/maps/{image_hash}.webp",
            "width": asset.get("original_width"), "height": asset.get("original_height"),
            "notes": [],
        }
        maps.append(m)
    ids = {m["id"] for m in maps}
    incoming = collections.defaultdict(list)
    for m in maps:
        for p in m["portals"]:
            if p["kind"] == "cross":
                assert p["to"] in ids, f"Target missing from source set: {p}"
                incoming[p["to"]].append(m["id"])
    adjacency = make_adjacency(maps)
    groups = []
    for original_group in GROUPS:
        nodes = [m for m in maps if m["group"] == original_group["id"]]
        positions = place_group(original_group, nodes, adjacency)
        for m in nodes:
            m["x"], m["y"] = positions[m["id"]]
        group = {key: val for key, val in original_group.items() if key != "root"}
        group["count"] = len(nodes)
        groups.append(group)
    separate_group_boundaries(maps)
    for m in maps:
        m["notes"] = notes_for(m, incoming)
    services = []
    for edge in services_source["edges"]:
        assert edge["from"] in ids
        assert edge["to"] is None or edge["to"] in ids
        service = dict(edge, label=edge["label_he"], condition=edge["condition_he"],
                       routeAllowed=edge["route_allowed"], sourceUrls=edge["source_urls"])
        if edge.get("active_until_utc"):
            service["activeUntilLocal"] = snapshot_local_deadline(edge["active_until_utc"])
            if edge["id"] == "moon-bunny-entry":
                service["condition"] = "רמה 11 ומעלה, קבוצה של 3. ערוצים 20 עד 30 בווינדיה ו-7 עד 10 בזניט. זמין עד 10 בדצמבר 2026 בשעה 01:59 לפי שעון ישראל."
        services.append(service)
    all_portals = [p for m in maps for p in m["portals"]]
    portal_counts = collections.Counter(p["kind"] for p in all_portals)
    pairs = {(m["id"], p["to"]) for m in maps for p in m["portals"] if p["kind"] == "cross"}
    stats = {"maps": len(maps), "cross": portal_counts["cross"], "internal": portal_counts["internal"],
             "unknown": portal_counts["unknown"], "pairs": len(pairs), "portals": len(all_portals),
             "services": len(services), "majorTowns": sum(m["major"] for m in maps),
             "scopes": dict(collections.Counter(m["scope"] for m in maps))}
    atlas = {
        "meta": {
            "game": "MapleStory Classic World", "version": "2.0.0", "asOf": "2026-11-19",
            "dataUpdatedAt": metadata["data_updated_at"], "clientBuild": metadata["client_build"],
            "sourceUrl": DATA_URL, "sourceCommit": COMMIT,
            "sourceSha256": metadata["files"]["maps.json"]["sha256"],
            "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "Data from OSMS Data Explorer (https://osmsdataexplorer.com), CC BY 4.0. Grouping, normalization and layout adapted for this atlas. Game content and artwork © Nexon.",
            "stats": stats, "worldWidth": 3100, "worldHeight": 2350,
            "layoutNote": "מפת הקשרים סכמטית. מספרי השערים והמיקום בתמונות מבוססים על נתוני הלקוח; המרחקים בין הנקודות באטלס אינם מרחקי הליכה במשחק.",
            "coverageNote": "כל 364 רשומות המפה וכל 1,436 רשומות הפורטלים במאגר הנוכחי נכללו. קיום בנתוני הלקוח אינו מבטיח גישה פעילה: משימות, אירועים, חדרי מערכת ומעברים ללא יעד קבוע מסומנים בנפרד.",
            "portalNote": "שער ללא אפקט אינו בהכרח מעבר סודי; הוא יכול להיות דלת מצוירת. אף יעד חסר לא הושלם בניחוש.",
        },
        "groups": groups, "maps": maps, "services": services,
        "sources": [
            {"title": "OSMS Data Explorer · Public dataset v1", "url": "https://osmsdataexplorer.com/data/api/v1/README.md", "description": "נתוני המפות, הפורטלים, הדמויות והתמונות שחולצו מקובצי הלקוח של קלאסיק; עדכון 18 בנובמבר 2026."},
            {"title": "OSMS public dataset snapshot", "url": RAW_BASE + "data/api/v1/meta.json", "description": "גרסת הלקוח, חותמת הזמן וגיבובי הקבצים של העותק שעליו נבנה האטלס."},
            {"title": "Nexon · November update: Forgotten Hollow", "url": "https://www.nexon.com/maplestory/news/update/48255/november-update-forgotten-hollow-patch-notes", "description": "עדכון נובמבר הרשמי, האזור החדש, הפעילויות ותנאי הכניסה העדכניים."},
            {"title": "MS-Classic · Route planner", "url": "https://ms-classic.com/tools/route-planner", "description": "אימות עצמאי של 608 קשרים מכוונים בין 321 מפות. הקשרים תואמים במלואם לתת-הקבוצה המקבילה במאגר המקור."},
            {"title": "MS-Classic · Forgotten Hollow guide", "url": "https://ms-classic.com/guides/forgotten-hollow-guide", "description": "אימות שתי הכניסות הנסתרות לאזור מאליניה ומסליפיווד. יעדי התסריטים מוצגים כקשרים מתועדים נפרדים, בלי לשנות את נתוני הפורטלים המקוריים."},
            {"title": "OSMS Data Explorer · License", "url": RAW_BASE + "data/api/v1/LICENSE", "description": "רישיון הנתונים וייחוס המקור. זכויות בתוכן המשחק ובאיורים שייכות לנקסון."},
            {"title": "Supplementary travel and quest services", "url": "https://ms-classic.com/guides/free-market-how-to", "description": "לכל שירות ומשימת קבוצה צורפו מקורות פרטניים ותנאים. שירותים אלה אינם נספרים כפורטלים קבועים בנתוני הלקוח."},
        ],
    }
    assert len(maps) == len(ids) == 364
    assert len(all_portals) == len({p["key"] for p in all_portals}) == 1436
    assert (stats["cross"], stats["internal"], stats["unknown"], stats["pairs"]) == (694, 357, 385, 621)
    assert sum(g["count"] for g in groups) == len(maps)
    assert all(0 <= m["x"] <= 3100 and 0 <= m["y"] <= 2350 for m in maps)
    (DIST / "atlas-data.json").write_text(json.dumps(atlas, ensure_ascii=False, separators=(",", ":")), encoding="utf-8", newline="\n")
    audit = {"stats": stats, "groups": [{"id": g["id"], "count": g["count"]} for g in groups],
             "imagesWithDimensions": sum(m["width"] is not None for m in maps),
             "minNodeDistance": round(min(math.hypot(a["x"] - b["x"], a["y"] - b["y"])
                                           for i, a in enumerate(maps) for b in maps[i + 1:]), 2)}
    (SOURCE / "build-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
    print(json.dumps(audit, ensure_ascii=False))


if __name__ == "__main__":
    main()
