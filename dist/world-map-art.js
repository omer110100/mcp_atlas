/* Authentic MapleStory Classic World map sheets. See docs/WORLD-MAP-ASSETS.md. */
window.AtlasWorldMapArt = {
  "version": 1,
  "sources": [
    {
      "name": "HubCW / MetaCW — game client world maps",
      "pageUrl": "https://hubcw.com/db/world",
      "resolvedPageUrl": "https://metacw.com/db/world",
      "retrievedAt": "2026-11-21T00:32:48+00:00",
      "provenance": "Game sheet images and spot membership published by HubCW / MetaCW from the MapleStory Classic World client.",
      "rights": "MapleStory game artwork is copyright Nexon. No general reuse license for game artwork was stated by the source.",
      "coordinateMethod": "Marker percentages in source HTML converted to nearest integer original-image pixel. Markers and table membership share source spot order; no geographic positions inferred."
    },
    {
      "name": "NiaMeowDB — independent coordinate cross-check",
      "pageUrl": "https://meowdb.com/msclassic/world-map",
      "retrievedAt": "2026-11-21T00:32:48+00:00",
      "verification": "All 76 integer spot coordinates match exactly; original keys WorldMap000.img:index and WorldMap001.img:index."
    },
    {
      "name": "Nexon — official Classic World map reference",
      "pageUrl": "https://www.nexon.com/maplestory/mscw/world-map",
      "dataUrl": "https://g.nexonstatic.com/maplestory/cms/v1/world-continent-maps-classic",
      "retrievedAt": "2026-11-21T00:32:48+00:00",
      "rights": "MapleStory artwork copyright Nexon."
    }
  ],
  "coordinateConvention": "Top-left origin; x increases rightward and y downward in original image pixels. A spot can represent multiple maps.",
  "maps": [
    {
      "id": "victoria",
      "name": "Victoria Island",
      "image": "assets/worldmaps/victoria-island.png",
      "width": 636,
      "height": 466,
      "sourceImageUrl": "https://metacw.com/static/gd/world/WorldMap001.png",
      "sha256": "e9d3c394dbafe253344016ddfd786611e9ba906765e4af5a2c883a6b8ff299bb",
      "spots": [
        {
          "id": "WorldMap001-0",
          "name": "Lith Harbor",
          "type": 0,
          "x": 101,
          "y": 374,
          "mapIds": [
            10000000,
            10000001,
            10000002,
            10000003
          ]
        },
        {
          "id": "WorldMap001-1",
          "name": "Right Around Lith Harbor",
          "type": 3,
          "x": 105,
          "y": 331,
          "mapIds": [
            10000010
          ]
        },
        {
          "id": "WorldMap001-2",
          "name": "Thicket Around the Beach I",
          "type": 3,
          "x": 125,
          "y": 318,
          "mapIds": [
            10000011
          ]
        },
        {
          "id": "WorldMap001-3",
          "name": "Thicket Around the Beach II",
          "type": 3,
          "x": 148,
          "y": 320,
          "mapIds": [
            10000012
          ]
        },
        {
          "id": "WorldMap001-4",
          "name": "Thicket Around the Beach III",
          "type": 3,
          "x": 172,
          "y": 311,
          "mapIds": [
            10000013
          ]
        },
        {
          "id": "WorldMap001-5",
          "name": "3-Way Road-Split",
          "type": 3,
          "x": 184,
          "y": 291,
          "mapIds": [
            10000020
          ]
        },
        {
          "id": "WorldMap001-6",
          "name": "Victoria Island Dungeon",
          "type": 2,
          "x": 271,
          "y": 258,
          "mapIds": [
            10005030,
            10005031,
            10005020,
            10005010,
            10005011,
            10005012,
            10005000,
            10005001,
            10005002,
            10005003,
            10005040,
            10005041,
            10005042,
            10005043,
            10005044,
            10005045,
            10005046,
            10005050,
            10005051,
            10005052,
            10005053,
            10005054,
            10005060,
            10005061,
            10005062,
            10005063,
            10005064,
            10005065,
            10005066,
            10005067,
            10005070,
            10005071,
            10005072,
            10005073,
            10005074,
            10005075,
            10005076,
            10005077,
            10005090,
            10005100,
            10005101,
            10005102,
            10005103,
            10005104,
            10005105
          ]
        },
        {
          "id": "WorldMap001-7",
          "name": "Forest West of Henesys",
          "type": 3,
          "x": 194,
          "y": 320,
          "mapIds": [
            10001030
          ]
        },
        {
          "id": "WorldMap001-8",
          "name": "A Hill West of Henesys",
          "type": 3,
          "x": 207,
          "y": 351,
          "mapIds": [
            10001020,
            10001021
          ]
        },
        {
          "id": "WorldMap001-9",
          "name": "Henesys Hunting Ground I",
          "type": 3,
          "x": 237,
          "y": 372,
          "mapIds": [
            10001010,
            10001011,
            10001012
          ]
        },
        {
          "id": "WorldMap001-10",
          "name": "Henesys",
          "type": 0,
          "x": 291,
          "y": 375,
          "mapIds": [
            10001000,
            10001001,
            10001002,
            10001003,
            10001004,
            10001005,
            10001007,
            10001008,
            10001040,
            10001041,
            10001042,
            10001043,
            10001044,
            10001045,
            10001050,
            10001051,
            10001052,
            88000000
          ]
        },
        {
          "id": "WorldMap001-11",
          "name": "The Road to the Dungeon",
          "type": 3,
          "x": 285,
          "y": 336,
          "mapIds": [
            10001090
          ]
        },
        {
          "id": "WorldMap001-12",
          "name": "Henesys Dungeon Entrance",
          "type": 3,
          "x": 276,
          "y": 314,
          "mapIds": [
            10001100,
            10001101,
            10001102,
            10001103,
            10001104,
            10001105,
            10001106
          ]
        },
        {
          "id": "WorldMap001-13",
          "name": "The Hill East of Henesys",
          "type": 3,
          "x": 342,
          "y": 370,
          "mapIds": [
            10001060
          ]
        },
        {
          "id": "WorldMap001-14",
          "name": "The Rain-Forest East of Henesys",
          "type": 3,
          "x": 352,
          "y": 351,
          "mapIds": [
            10001070
          ]
        },
        {
          "id": "WorldMap001-15",
          "name": "The Forest East of Henesys",
          "type": 3,
          "x": 358,
          "y": 325,
          "mapIds": [
            10001080,
            10001081,
            10001082
          ]
        },
        {
          "id": "WorldMap001-16",
          "name": "The Forest South of Ellinia",
          "type": 3,
          "x": 372,
          "y": 310,
          "mapIds": [
            10002030,
            10002031,
            10002032,
            10002033,
            10002034
          ]
        },
        {
          "id": "WorldMap001-17",
          "name": "The Forest of Wisdom",
          "type": 3,
          "x": 394,
          "y": 300,
          "mapIds": [
            10002020,
            10002021,
            10002022,
            10002023,
            10002024,
            10002025,
            10002026,
            10002027
          ]
        },
        {
          "id": "WorldMap001-18",
          "name": "The Field South of Ellinia",
          "type": 3,
          "x": 414,
          "y": 289,
          "mapIds": [
            10002010
          ]
        },
        {
          "id": "WorldMap001-19",
          "name": "Ellinia",
          "type": 0,
          "x": 442,
          "y": 254,
          "mapIds": [
            10002000,
            10002001,
            10002002,
            10002003,
            10002004,
            10002005,
            10002040,
            10002041,
            10002042,
            10002043,
            10002044,
            10002090,
            10002091
          ]
        },
        {
          "id": "WorldMap001-20",
          "name": "The Field Up North of Ellinia",
          "type": 3,
          "x": 391,
          "y": 258,
          "mapIds": [
            10002050
          ]
        },
        {
          "id": "WorldMap001-21",
          "name": "The Tree That Grew I",
          "type": 3,
          "x": 372,
          "y": 251,
          "mapIds": [
            10002060,
            10002061,
            10002062
          ]
        },
        {
          "id": "WorldMap001-22",
          "name": "The Forest North of Ellinia",
          "type": 3,
          "x": 361,
          "y": 226,
          "mapIds": [
            10002070,
            10002071,
            10002072,
            10002073,
            10002074,
            10002075,
            10002076,
            10002080,
            10002081,
            10002082,
            10002083
          ]
        },
        {
          "id": "WorldMap001-23",
          "name": "Kerning City Middle Forest I",
          "type": 3,
          "x": 159,
          "y": 280,
          "mapIds": [
            10003050,
            10003051,
            10003052
          ]
        },
        {
          "id": "WorldMap001-24",
          "name": "L Forest III",
          "type": 3,
          "x": 130,
          "y": 286,
          "mapIds": [
            10003040
          ]
        },
        {
          "id": "WorldMap001-25",
          "name": "L Forest II",
          "type": 3,
          "x": 111,
          "y": 268,
          "mapIds": [
            10003030
          ]
        },
        {
          "id": "WorldMap001-26",
          "name": "L Forest I",
          "type": 3,
          "x": 116,
          "y": 240,
          "mapIds": [
            10003020
          ]
        },
        {
          "id": "WorldMap001-27",
          "name": "Kerning City Construction Site",
          "type": 3,
          "x": 116,
          "y": 216,
          "mapIds": [
            10003010,
            10003011
          ]
        },
        {
          "id": "WorldMap001-28",
          "name": "Kerning City",
          "type": 0,
          "x": 96,
          "y": 184,
          "mapIds": [
            10003000,
            10003001,
            10003002,
            10003003,
            10003004,
            10003005,
            10003006,
            10003007,
            10003008,
            10003060,
            10003061,
            10003062,
            10003063,
            10003064,
            10003065,
            10003066,
            10003067,
            10003068,
            10003110,
            10003111,
            10003112,
            88001000
          ]
        },
        {
          "id": "WorldMap001-29",
          "name": "Sunset Sky",
          "type": 3,
          "x": 132,
          "y": 152,
          "mapIds": [
            10003070
          ]
        },
        {
          "id": "WorldMap001-30",
          "name": "Construction Site North of Kerning City",
          "type": 3,
          "x": 158,
          "y": 153,
          "mapIds": [
            10003080,
            10003081
          ]
        },
        {
          "id": "WorldMap001-31",
          "name": "The Swamp of Despair I",
          "type": 3,
          "x": 142,
          "y": 186,
          "mapIds": [
            10003090
          ]
        },
        {
          "id": "WorldMap001-32",
          "name": "The Swamp of Despair II",
          "type": 3,
          "x": 170,
          "y": 192,
          "mapIds": [
            10003091
          ]
        },
        {
          "id": "WorldMap001-33",
          "name": "The Swamp of Despair III",
          "type": 3,
          "x": 187,
          "y": 218,
          "mapIds": [
            10003092
          ]
        },
        {
          "id": "WorldMap001-34",
          "name": "Dangerous Croko I",
          "type": 3,
          "x": 195,
          "y": 242,
          "mapIds": [
            10003093
          ]
        },
        {
          "id": "WorldMap001-35",
          "name": "Dangerous Croko II",
          "type": 3,
          "x": 215,
          "y": 256,
          "mapIds": [
            10003094,
            10003095,
            10003096,
            10003097,
            10003098
          ]
        },
        {
          "id": "WorldMap001-36",
          "name": "Perion",
          "type": 0,
          "x": 244,
          "y": 86,
          "mapIds": [
            10004000,
            10004001,
            10004002,
            10004003
          ]
        },
        {
          "id": "WorldMap001-37",
          "name": "West Street Corner of Perion",
          "type": 3,
          "x": 203,
          "y": 114,
          "mapIds": [
            10004010
          ]
        },
        {
          "id": "WorldMap001-38",
          "name": "West Rocky Mountain I",
          "type": 3,
          "x": 200,
          "y": 136,
          "mapIds": [
            10004020,
            10004021,
            10004022,
            10004023
          ]
        },
        {
          "id": "WorldMap001-39",
          "name": "West Domain of Perion",
          "type": 3,
          "x": 185,
          "y": 152,
          "mapIds": [
            10004030
          ]
        },
        {
          "id": "WorldMap001-40",
          "name": "Perion Street Corner",
          "type": 3,
          "x": 284,
          "y": 109,
          "mapIds": [
            10004040,
            10004041,
            10004042
          ]
        },
        {
          "id": "WorldMap001-41",
          "name": "East Rocky Mountain I",
          "type": 3,
          "x": 302,
          "y": 118,
          "mapIds": [
            10004050,
            10004051,
            10004052,
            10004053,
            10004054,
            10004055,
            10004056,
            10004057
          ]
        },
        {
          "id": "WorldMap001-42",
          "name": "Rocky Road I",
          "type": 3,
          "x": 324,
          "y": 126,
          "mapIds": [
            10004060
          ]
        },
        {
          "id": "WorldMap001-43",
          "name": "Rocky Road II",
          "type": 3,
          "x": 340,
          "y": 147,
          "mapIds": [
            10004070
          ]
        },
        {
          "id": "WorldMap001-44",
          "name": "Rocky Road III",
          "type": 3,
          "x": 360,
          "y": 170,
          "mapIds": [
            10004080
          ]
        },
        {
          "id": "WorldMap001-45",
          "name": "East Domain of Perion",
          "type": 3,
          "x": 362,
          "y": 201,
          "mapIds": [
            10004090,
            10004091
          ]
        },
        {
          "id": "WorldMap001-46",
          "name": "Deep Valley I",
          "type": 3,
          "x": 239,
          "y": 137,
          "mapIds": [
            10004100,
            10004101,
            10004102
          ]
        },
        {
          "id": "WorldMap001-47",
          "name": "Deep Valley II",
          "type": 3,
          "x": 227,
          "y": 156,
          "mapIds": [
            10004110,
            10004111,
            10004112,
            10004113,
            10004114,
            10004115
          ]
        },
        {
          "id": "WorldMap001-48",
          "name": "Deep Valley III",
          "type": 3,
          "x": 217,
          "y": 187,
          "mapIds": [
            10004120
          ]
        },
        {
          "id": "WorldMap001-49",
          "name": "Perion Dungeon Entrance",
          "type": 3,
          "x": 236,
          "y": 207,
          "mapIds": [
            10004121
          ]
        },
        {
          "id": "WorldMap001-50",
          "name": "Forgotten Hollow",
          "type": 2,
          "x": 346,
          "y": 253,
          "mapIds": [
            10006000,
            10006001,
            10006002,
            10006003,
            10006010,
            10006020,
            10006022,
            10006030,
            10006031,
            10006040,
            10006050,
            10006060,
            10006070,
            10006071,
            10006072,
            10006080,
            10006090,
            10006100,
            10006110,
            10006120,
            10006121,
            10006130,
            10006140,
            10006150,
            10006152,
            10006160,
            10006161,
            10006162
          ]
        },
        {
          "id": "WorldMap001-51",
          "name": "Florina Beach",
          "type": 0,
          "x": 526,
          "y": 371,
          "mapIds": [
            10007000
          ]
        },
        {
          "id": "WorldMap001-52",
          "name": "A Look-Out Shed Around the Beach",
          "type": 3,
          "x": 551,
          "y": 365,
          "mapIds": [
            10007010
          ]
        },
        {
          "id": "WorldMap001-53",
          "name": "Lorang Lorang",
          "type": 3,
          "x": 568,
          "y": 349,
          "mapIds": [
            10007020,
            10007021
          ]
        },
        {
          "id": "WorldMap001-54",
          "name": "Lorang and Clang",
          "type": 3,
          "x": 564,
          "y": 323,
          "mapIds": [
            10007030,
            10007031
          ]
        },
        {
          "id": "WorldMap001-55",
          "name": "Hot Sand",
          "type": 3,
          "x": 538,
          "y": 319,
          "mapIds": [
            10007040
          ]
        },
        {
          "id": "WorldMap001-56",
          "name": "Excavation Site I",
          "type": 3,
          "x": 383,
          "y": 159,
          "mapIds": [
            10004130
          ]
        },
        {
          "id": "WorldMap001-57",
          "name": "Excavation Site II",
          "type": 3,
          "x": 406,
          "y": 149,
          "mapIds": [
            10004131
          ]
        },
        {
          "id": "WorldMap001-58",
          "name": "Excavation Site III",
          "type": 3,
          "x": 408,
          "y": 173,
          "mapIds": [
            10004132
          ]
        },
        {
          "id": "WorldMap001-59",
          "name": "Excavation Site <Camp>",
          "type": 3,
          "x": 399,
          "y": 202,
          "mapIds": [
            10004133
          ]
        },
        {
          "id": "WorldMap001-60",
          "name": "Remains <Tomb> I",
          "type": 3,
          "x": 414,
          "y": 214,
          "mapIds": [
            10004134
          ]
        },
        {
          "id": "WorldMap001-61",
          "name": "Remains <Tomb> II",
          "type": 3,
          "x": 437,
          "y": 203,
          "mapIds": [
            10004135
          ]
        },
        {
          "id": "WorldMap001-62",
          "name": "Remains <Tomb> III",
          "type": 3,
          "x": 448,
          "y": 182,
          "mapIds": [
            10004136
          ]
        },
        {
          "id": "WorldMap001-63",
          "name": "Remains <Tomb> IV",
          "type": 3,
          "x": 447,
          "y": 156,
          "mapIds": [
            10004137
          ]
        },
        {
          "id": "WorldMap001-64",
          "name": "Remains <Cliff>",
          "type": 3,
          "x": 440,
          "y": 135,
          "mapIds": [
            10004138
          ]
        }
      ]
    },
    {
      "id": "maple",
      "name": "Maple Island",
      "image": "assets/worldmaps/maple-island.png",
      "width": 634,
      "height": 446,
      "sourceImageUrl": "https://metacw.com/static/gd/world/WorldMap000.png",
      "sha256": "808232f0b00b35c639434032dcc2508eb527b03f200b1efe11d51bfbfdb77f9f",
      "spots": [
        {
          "id": "WorldMap000-0",
          "name": "Mushroom Town - West Entrance",
          "type": 1,
          "x": 137,
          "y": 149,
          "mapIds": [
            1
          ]
        },
        {
          "id": "WorldMap000-1",
          "name": "Mushroom Town",
          "type": 1,
          "x": 193,
          "y": 141,
          "mapIds": [
            10,
            20,
            21
          ]
        },
        {
          "id": "WorldMap000-2",
          "name": "East Entrance to Mushroom Town",
          "type": 1,
          "x": 202,
          "y": 178,
          "mapIds": [
            30
          ]
        },
        {
          "id": "WorldMap000-3",
          "name": "Snail Hunting Ground I",
          "type": 1,
          "x": 224,
          "y": 216,
          "mapIds": [
            40
          ]
        },
        {
          "id": "WorldMap000-4",
          "name": "Snail Hunting Ground II",
          "type": 1,
          "x": 269,
          "y": 226,
          "mapIds": [
            41
          ]
        },
        {
          "id": "WorldMap000-5",
          "name": "Snail Hunting Ground III",
          "type": 1,
          "x": 309,
          "y": 231,
          "mapIds": [
            42
          ]
        },
        {
          "id": "WorldMap000-6",
          "name": "A Split Road",
          "type": 1,
          "x": 350,
          "y": 253,
          "mapIds": [
            50
          ]
        },
        {
          "id": "WorldMap000-7",
          "name": "The Field West of Amherst",
          "type": 1,
          "x": 385,
          "y": 234,
          "mapIds": [
            1000,
            1001,
            1002,
            1003,
            1004,
            1005,
            1006
          ]
        },
        {
          "id": "WorldMap000-8",
          "name": "Amherst",
          "type": 0,
          "x": 453,
          "y": 222,
          "mapIds": [
            1010,
            1011,
            1012,
            1013,
            1014
          ]
        },
        {
          "id": "WorldMap000-9",
          "name": "The Field East of Amherst",
          "type": 1,
          "x": 475,
          "y": 264,
          "mapIds": [
            1020,
            1021
          ]
        },
        {
          "id": "WorldMap000-10",
          "name": "Southperry",
          "type": 0,
          "x": 380,
          "y": 295,
          "mapIds": [
            60,
            61
          ]
        }
      ]
    }
  ]
};
