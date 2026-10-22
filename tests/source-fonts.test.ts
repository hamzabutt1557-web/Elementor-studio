import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDesign} from '../lib/design';
import {previewHtml,toElementor} from '../lib/elementor';
const base={title:'Fonts',source:'https://example.com',warnings:[],nodes:[{id:'abcdef12',kind:'text',text:'Custom face',style:{fontFamily:'"Jost*", Arial, sans-serif'},children:[]}]};
const font={family:'Jost*',url:'https://example.com/book.woff2',weight:'400',style:'normal'};
test('source font survives preview and native export',()=>{
 const d=validateDesign({...base,fontFaces:[font]});assert.match(previewHtml(d),/@font-face/);assert.match(previewHtml(d),/book\.woff2/);assert.deepEqual(toElementor(d).studio_source_fonts,[font]);
});
test('source font rejects CSS injection and non-HTTP URLs',()=>{
 for(const url of ['javascript:alert(1)','https://example.com/a");body{}','https://example.com/a b'])assert.throws(()=>validateDesign({...base,fontFaces:[{...font,url}]}));
});
