import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDesign} from '../lib/design';
import {exportZip} from '../lib/export';
import JSZip from 'jszip';
const node=(i:number)=>({id:i.toString(16).padStart(8,'0'),kind:'text',text:'Catalog item',style:{},children:[]});
test('large catalogs retain their footer in bounded compact export',async()=>{
 const nodes=Array.from({length:1500},(_,i)=>node(i));nodes[1499].text='Catalog footer';
 const d=validateDesign({title:'Catalog',source:'https://example.com',nodes,warnings:[]});
 const z=await JSZip.loadAsync(await exportZip([d],false));
 const content=await z.file(/templates\/.*\.json$/)[0].async('string');
 assert.ok(content.includes('Catalog footer'));assert.ok(Buffer.byteLength(content)<=3_000_000);
});
test('excessive nodes and depth fail before recursive validation',()=>{
 const input={title:'Limits',source:'https://example.com',warnings:[],nodes:Array.from({length:3001},(_,i)=>node(i))};
 assert.throws(()=>validateDesign(input),/3,000-element/);
 let nested:any=node(0);for(let i=1;i<10000;i++)nested={...node(i),kind:'container',children:[nested]};
 assert.throws(()=>validateDesign({...input,nodes:[nested]}),/24-level/);
});
