"""Build only explicitly Classic-observed links from a public drop-table page.

No old-version-only rows or drop rates are included in the result. Public
factual payloads are archived in source-data/drops with attribution and
provenance. See the NOTICE.md there for source and observation limitations.
"""
from pathlib import Path
import collections
import json
import re

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT / 'source-data' / 'drops'
OSMS = PROJECT / 'source-data'
import argparse
parser = argparse.ArgumentParser(description='Rebuild explicitly observed Classic item-monster links from attributed public factual snapshots')
parser.add_argument('--output', type=Path, default=PROJECT / 'dist' / 'drop-data.json')
OUTPUT = parser.parse_args().output
items = json.loads((OSMS / 'items.json').read_text())
mobs = json.loads((OSMS / 'monsters.json').read_text())
by_item = {x['id']: x for x in items}

snapshot = json.loads((ROOT / 'msclassic-confirmed-records.json').read_text())
records = snapshot['monsters']

links = []
unresolved = []
excluded = collections.Counter({'legacy_reference_without_classic_confirmation': snapshot['excludedLegacyUnconfirmedCount']})
for mob in records:
    named = [x for x in mobs if x['name'] == mob['name']]
    candidates = [x for x in named if x['level'] == mob['level'] and Path(x['icon_url']).name == Path(mob['img']).name]
    for drop in mob['drops']:
        if not drop.get('confirmed'):
            excluded['legacy_reference_without_classic_confirmation'] += 1
            continue
        item_id = int(re.search(r'/(\d+)\.png$', drop['icon'])[1])
        item = by_item.get(item_id)
        assert item and item['name'] == drop['item'], (item_id, drop['item'])
        status = 'team_seen' if drop['confirmed'] == 'Seen by our team' else ('classic_counted' if drop['counted'] else 'classic_confirmed')
        row = {
            'itemId': item_id,
            'itemName': item['name'],
            'mobName': mob['name'],
            'status': status,
            'sourceUrl': 'https://ms-classic.com/drops',
            'sourceItemUrl': 'https://ms-classic.com/items/' + drop['islug'],
            'sourceMonsterUrl': 'https://ms-classic.com/monsters/' + mob['slug'],
            'sourceLabel': drop['confirmed'],
            'checkedAt': '2026-11-19',
            'observationDate': None,
            'observationVersion': None,
            'retestedInVersion2': False,
            'matchMethod': 'item ID from source icon, exact OSMS item name; unique monster name + level + identical sprite hash',
            'attribution': 'MS-Classic; Classic observations attributed there to MapleClassic Wiki',
            'license': 'CC BY-NC-SA 4.0',
            'licenseUrl': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        }
        if status == 'team_seen':
            row['attribution'] = 'MS-Classic team observation; isolated factual relationship'
            row['license'] = 'Source page has no general reuse license; factual relationship only, linked and attributed'
            row['licenseUrl'] = None
        else:
            row['underlyingSourceUrl'] = 'https://mapleclassic.wiki/wiki/' + mob['name'].replace(' ', '_')
        if item.get('stats', {}).get('quest'):
            row['questFlag'] = True
            row['condition'] = 'הפריט מסומן כפריט משימה בנתוני הלקוח. תנאי הנשירה המדויקים לא תועדו במקור.'
        # The source table attaches the species-level report to the level-30
        # copy, while its normal level-24 page says no rows are recorded. The
        # wiki reports a species-level drop but does not distinguish copies.
        # Never turn that inconsistency into a fixed link to either monster ID.
        if mob['name'] == 'Zombie Mushroom':
            row['mobId'] = None
            row['candidateMobIds'] = [x['id'] for x in named]
            row['reason'] = 'Species-level observation; source variants conflict (normal level 24 versus level-30 job-test copy). No exact monster ID assigned.'
            row['matchMethod'] = 'Item ID exact; monster variant unresolved'
            row['routeAllowed'] = False
            unresolved.append(row)
            continue
        assert len(candidates) == 1, (mob['name'], mob['level'], candidates)
        row['mobId'] = candidates[0]['id']
        row['mobLevel'] = candidates[0]['level']
        links.append(row)

supplement_count = 0
supplement = json.loads((ROOT / 'maplelandhub-mushmom-confirmed.json').read_text())
boss = next(x for x in mobs if x['id'] == 700000)
assert boss['name'] == 'Mushmom' and boss['level'] == 40
for fact in supplement['rows']:
    assert fact['sourceLabel'] == 'Confirmed in Classic' and fact['monsterId'] == 700000
    item_id = fact['itemId']
    source_item_name = fact['itemName']
    assert item_id in by_item and by_item[item_id]['name'] == source_item_name
    row = {
        'itemId': item_id,
        'itemName': source_item_name,
        'mobId': 700000,
        'mobName': 'Mushmom',
        'mobLevel': 40,
        'status': 'classic_confirmed',
        'sourceUrl': 'https://maplelandhub.com/classic/en/monster/700000',
        'sourceItemUrl': 'https://maplelandhub.com' + fact['itemPath'],
        'sourceMonsterUrl': 'https://maplelandhub.com/classic/en/monster/700000',
        'sourceLabel': 'Confirmed in Classic',
        'checkedAt': '2026-11-19',
        'observationDate': None,
        'observationVersion': None,
        'retestedInVersion2': False,
        'matchMethod': 'Exact source numeric monster and item IDs, and exact current OSMS names and monster level',
        'attribution': 'MaplelandHub Classic World published confirmation label; isolated factual relationship',
        'license': 'Source page has no general reuse license; factual relationship only, linked and attributed',
        'licenseUrl': None,
        'sourceCaveat': 'Confirmation label used for relationship only. The page also shows historical KMS rates; none are retained here.',
    }
    underlying = fact.get('underlyingSourceUrl')
    if underlying:
        row['underlyingSourceUrl'] = underlying
        row['attribution'] += '; source credits NiaDB for this observation'
    assert not any(x['itemId'] == item_id and x['mobId'] == 700000 for x in links)
    links.append(row)
    supplement_count += 1

# Numeric URLs on Six Path independently corroborate 49 identifier joins. Its
# observations share underlying wiki data, so this is not 49 extra sightings.
sixpath_rows = json.loads((ROOT / 'sixpath-counted-id-corroboration.json').read_text())['rows']
sixpath_pairs = {(r['itemId'], r['mobId']) for r in sixpath_rows}
for row in links:
    if (row['itemId'], row['mobId']) in sixpath_pairs:
        row['corroboratingSourceUrl'] = 'https://sixpath.wiki/drops'
        row['numericIdsCorroborated'] = True

links.sort(key=lambda x: (x['itemId'], x['mobId']))
result = {
    'meta': {
        'game': 'MapleStory Classic World',
        'catalogVersion': '2.0.0',
        'checkedAt': '2026-11-19',
        'sourcePage': 'https://ms-classic.com/drops',
        'sourcePageSha256': snapshot['sourceHtmlSha256'],
        'sourceRecords': snapshot['originalRelationshipCount'],
        'sourceMonsterNames': len(records),
        'supplementalConfirmedRelationships': supplement_count,
        'numericIdJoinsCorroboratedBySixPath': len(sixpath_pairs),
        'acceptedRelationships': len(links),
        'coveredItemIds': len({x['itemId'] for x in links}),
        'coveredMonsterIds': len({x['mobId'] for x in links}),
        'unresolvedRelationships': len(unresolved),
        'excluded': dict(excluded),
        'statusCounts': dict(collections.Counter(x['status'] for x in links)),
        'allKnownGameDrops': False,
        'dropRatesIncluded': False,
        'missingDataMeans': 'not_documented_in_collected_sources',
        'coverageNoteHe': 'נכללו רק קשרי נשירה שמסומנים במקור כתצפיות בקלאסיק. זהו מאגר חלקי של דיווחים קהילתיים, ולא טבלת הנשירה הרשמית. תצפיות קודמות לא נבדקו מחדש בכל עדכון.',
        'missingNoteHe': 'אין במקורות שנאספו תיעוד לנשירה של הפריט הזה. זה לא אומר שהפריט אינו נושר.',
        'historicalVersionNoteHe': 'מזהי הפריטים והמפלצות תואמים לקטלוג גרסה 2.0.0. גרסת המשחק ותאריך התצפית של כל דיווח אינם מפורטים בטבלת המקור.',
        'idMatchNote': 'Items use numeric source-icon IDs and exact current names. Monsters require exact name, displayed level, and identical sprite hash. The ambiguous Zombie Mushroom row is excluded from fixed-ID links.',
        'license': 'CC BY-NC-SA 4.0 for the MapleClassic Wiki-derived observations; separately attributed isolated factual observations from MS-Classic and MaplelandHub.',
        'licenseUrl': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        'attribution': 'Classic drop observations: MapleClassic Wiki, via MS-Classic. Filtered to explicitly Classic-confirmed observations, ID-matched to OSMS Data Explorer, rates removed. Game content © Nexon.',
        'sources': [
            {'name': 'MS-Classic drop table', 'url': 'https://ms-classic.com/drops', 'role': 'Published source records and Classic-confirmed / team-seen labels'},
            {'name': 'MapleClassic Wiki reuse and license', 'url': 'https://mapleclassic.wiki/wiki/MapleWiki:About#Reusing_the_wiki', 'role': 'Underlying observation attribution and CC BY-NC-SA 4.0 license'},
            {'name': 'OSMS Data Explorer public dataset', 'url': 'https://osmsdataexplorer.com/data/api/v1/README.md', 'role': 'Current item/monster IDs; expressly excludes server-side drop tables'},
            {'name': 'MaplelandHub Classic World Mushmom drops', 'url': 'https://maplelandhub.com/classic/en/monster/700000', 'role': 'Four explicitly Classic-confirmed factual relationships, exact numeric IDs; all historical KMS rates excluded'},
            {'name': 'Six Path public counted drop rows', 'url': 'https://sixpath.wiki/drops', 'role': 'Corroborates numeric item/monster IDs for 49 links; observations share underlying wiki data'},
        ],
    },
    'links': links,
    'unresolved': unresolved,
}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result['meta'], ensure_ascii=False, indent=2))
