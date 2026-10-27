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
test('complete native catalogs above 3 MB export within the bounded 8 MB importer limit',async()=>{
 const nodes=Array.from({length:1800},(_,i)=>({...node(i),text:'Detailed editable product description. '.repeat(50)}));
 nodes[nodes.length-1].text='Final catalog footer';
 const z=await JSZip.loadAsync(await exportZip([{title:'Full catalog',source:'https://example.com',nodes,warnings:[]}],false));
 const content=await z.file(/templates\/.*\.json$/)[0].async('string');
 assert.ok(Buffer.byteLength(content)>3_000_000);assert.ok(Buffer.byteLength(content)<8_000_000);assert.ok(content.includes('Final catalog footer'));
});
