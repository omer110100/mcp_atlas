'use strict';
// Execute the real app in Node VM contexts with focused DOM-contract stubs.
// These checks do not launch a browser or verify rendered layout.
const {spawnSync}=require('node:child_process');
const {join}=require('node:path');
const suites=[
  ['atlas-routing.cjs','Directed routing and original data'],
  ['atlas-behavior.cjs','Search, portal actions and entity scenes'],
  ['atlas-graph.cjs','Graph, selection and region filters'],
  ['hunt.cjs','Item, monster and NPC catalog behavior'],
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
