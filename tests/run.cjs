'use strict';
// Execute the real app in Node VM contexts with focused DOM-contract stubs.
// These checks do not launch a browser or verify rendered layout.
const {spawnSync}=require('node:child_process');
const {join}=require('node:path');
const suites=[
  ['preferences.cjs','Language, appearance and translation coverage'],
  ['explorer.cjs','Command palette, nearby maps and current location'],
  ['map-search.cjs','Unified Hebrew map lookup'],
  ['atlas-routing.cjs','Directed routing and original data'],
  ['v3-route-tools.cjs','Detours, prefetch, keyboard and share boundaries'],
  ['v3-routing.cjs','Weighted routes, exclusions and reachability'],
  ['journey.cjs','Multi-stop planning and confirmed arrival portals'],
  ['atlas-behavior.cjs','Search, portal actions and entity scenes'],
  ['atlas-graph.cjs','Graph, selection and region filters'],
  ['hunt.cjs','Item, monster and NPC catalog behavior'],
  ['personal.cjs','Saved journeys, sharing and personal map library'],
  ['library-store.cjs','Local backup boundaries and safe merging'],
  ['library-ui.cjs','Notes, route drafts and backup controller'],
  ['map-info.cjs','Map occupants, exact markers and availability'],
  ['experience.cjs','Welcome, reading, layout and motion preferences'],
];
let total=0,failed=0;
for(const [file,label] of suites){
  const result=spawnSync(process.execPath,[join(__dirname,file)],{
    encoding:'utf8',timeout:30000,windowsHide:true,
  });
  let report;
  try{report=JSON.parse(result.stdout.trim());}catch{}
  if(result.error||!report||result.status!==0){
    failed+=report?.failed||1;
    total+=report?.checks||0;
    console.error(`FAIL ${label}`);
    if(report?.failures?.length)console.error(JSON.stringify(report.failures,null,2));
    else console.error(result.stderr||result.stdout||result.error?.message||'Runner failed');
    continue;
  }
  total+=report.checks;
  failed+=report.failed;
  console.log(`PASS ${label}: ${report.checks} checks`);
}
console.log(`${total} checks, ${failed} failures. Node VM/DOM contracts only; no browser or live-game assertions.`);
process.exitCode=failed?1:0;
