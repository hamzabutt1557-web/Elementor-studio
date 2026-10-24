import test from "node:test";
import assert from "node:assert/strict";
import { briefDesign } from "../lib/design";
import { qualityReport } from "../lib/quality-report";
test("delivery review separates broken actions, form placeholders and decorative-image review",()=>{
 const d=briefDesign("Test","Test","business");
 d.nodes=[
  {id:"aaaaaaa1",kind:"image",style:{},children:[]},
  {id:"aaaaaaa2",kind:"button",text:"Submit",url:"#",style:{},children:[]},
  {id:"aaaaaaa3",kind:"text",text:"[Form field: email]",style:{},children:[]},
 ];
 const report=qualityReport(d);
 assert.equal(report.status,"needs-work");
 assert.equal(report.actionItems,3);
 assert.equal(report.issues.find(i=>i.code==="image-alt")?.severity,"review");
 assert.equal(report.issues.find(i=>i.code==="form-placeholder")?.nodeIds[0],"aaaaaaa3");
});
test("toggle actions are not marked as missing links and no untested page is called ready",()=>{
 const d=briefDesign("Test","Test","business");
 d.nodes=[{id:"aaaaaaa1",kind:"button",text:"Menu",url:"#",interaction:{action:"toggle",target:"aaaaaaa2"},style:{},children:[]}];
 const report=qualityReport(d);
 assert.equal(report.issues.some(i=>i.code==="unassigned-link"),false);
 assert.equal(report.status,"review-required");
});
