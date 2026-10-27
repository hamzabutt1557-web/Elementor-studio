import { alignmentDeltas } from "./canvas-geometry";
// Preview-only bridge. Measurements never modify the native design or WordPress runtime.
export const editorScript = `(()=>{
 let editing=false,measuring=false,selected=null,reference=null,layer=null,scheduled=false,busy=false,freeMove=true,tools=null,gesture=null,selection=[],snap=false,zoom=1,suppressClick=false;
 const inlineStyle=document.createElement('style');inlineStyle.textContent='[data-inline-editing]{outline:2px solid #6366f1!important;outline-offset:6px;cursor:text!important;user-select:text!important;min-width:12px;caret-color:#6366f1}[data-estudio-id]:hover{cursor:default}';document.head.append(inlineStyle);
 let inline=null,lastTap={id:'',time:0};
 function finishInline(cancel=false){
  if(!inline)return;const current=inline;inline=null;
  const text=(current.node.innerText||'').split(String.fromCharCode(13)).join('').slice(0,12000);
  current.node.removeAttribute('contenteditable');current.node.removeAttribute('data-inline-editing');current.node.innerHTML=current.html;
  parent.postMessage({type:cancel?'estudio-text-cancel':'estudio-text-save',id:current.node.dataset.estudioId,text},'*');
  document.body.style.userSelect=inline?'text':editing?'none':'';schedule();
 }
 function beginInline(n){
  if(busy||!n||!/^H[1-6]$|^P$/.test(n.tagName))return;
  if(inline?.node===n)return;if(inline)finishInline();cancel();choose(n);
  inline={node:n,html:n.innerHTML};n.textContent=n.innerText;n.contentEditable='plaintext-only';n.dataset.inlineEditing='true';
  document.body.style.userSelect='text';if(tools){tools.remove();tools=null;}
  n.focus();const range=document.createRange();range.selectNodeContents(n);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  parent.postMessage({type:'estudio-text-start',id:n.dataset.estudioId},'*');
 }
 document.addEventListener('dblclick',e=>{const n=e.target.closest('[data-estudio-id]');if(!n||!/^H[1-6]$|^P$/.test(n.tagName))return;e.preventDefault();e.stopImmediatePropagation();beginInline(n);},true);
 document.addEventListener('focusout',e=>{if(inline&&e.target===inline.node)finishInline();});
 document.addEventListener('keydown',e=>{if(!inline)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finishInline(true);}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishInline();}},true);
 const send=(type,id,metrics)=>parent.postMessage({type,id,metrics},'*');
 const round=n=>Math.round(n*10)/10;
 const box=node=>{const r=node.getBoundingClientRect();return{width:round(r.width),height:round(r.height),x:round(r.left+scrollX),y:round(r.top+scrollY)};};
 const sides=(s,p)=>['Top','Right','Bottom','Left'].map(side=>round(parseFloat(s[p+side])||0));
 const gap=(a,b)=>({horizontal:round(Math.max(0,b.left-a.right,a.left-b.right)),vertical:round(Math.max(0,b.top-a.bottom,a.top-b.bottom)),deltaX:round(b.left-a.left),deltaY:round(b.top-a.top)});
 function draw(){scheduled=false;drawTools();if(layer)layer.remove();layer=null;if(!measuring||!selected||!document.contains(selected))return;
  const r=selected.getBoundingClientRect(),s=getComputedStyle(selected),p=selected.parentElement?.getBoundingClientRect();
  const metrics={...box(selected),padding:sides(s,'padding'),margin:sides(s,'margin'),parent:p?{top:round(r.top-p.top),right:round(p.right-r.right),bottom:round(p.bottom-r.bottom),left:round(r.left-p.left)}:null,reference:reference&&document.contains(reference)?{id:reference.dataset.estudioId,...box(reference),...gap(r,reference.getBoundingClientRect())}:null};
  send('estudio-measure',selected.dataset.estudioId,metrics);
  layer=document.createElement('div');layer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647;font:12px Arial;color:#fff;';
  const rect=(left,top,width,height,color,border)=>{const el=document.createElement('div');el.style.cssText='position:absolute;box-sizing:border-box;left:'+left+'px;top:'+top+'px;width:'+Math.max(0,width)+'px;height:'+Math.max(0,height)+'px;background:'+color+';border:'+border+';';layer.append(el);return el;};
  const label=(text,x,y)=>{const el=rect(Math.max(22,Math.min(innerWidth-220,x)),Math.max(22,Math.min(innerHeight-30,y)),210,24,'#12382b','0');el.style.padding='5px';el.textContent=text;};
  rect(r.left,r.top,r.width,r.height,'transparent','2px solid #10b981');
  const pad=metrics.padding;rect(r.left,r.top,r.width,pad[0],'#10b98144','0');rect(r.left,r.bottom-pad[2],r.width,pad[2],'#10b98144','0');rect(r.left,r.top,pad[3],r.height,'#10b98144','0');rect(r.right-pad[1],r.top,pad[1],r.height,'#10b98144','0');
  const margin=metrics.margin;rect(r.left,r.top-Math.max(0,margin[0]),r.width,Math.max(0,margin[0]),'#f59e0b44','0');rect(r.left,r.bottom,r.width,Math.max(0,margin[2]),'#f59e0b44','0');rect(r.left-Math.max(0,margin[3]),r.top,Math.max(0,margin[3]),r.height,'#f59e0b44','0');rect(r.right,r.top,Math.max(0,margin[1]),r.height,'#f59e0b44','0');
  label(metrics.width+' × '+metrics.height+' px',r.left,r.top-28);
  rect(0,0,innerWidth,20,'#12382bee','0');rect(0,20,20,innerHeight-20,'#12382bee','0');
  for(let x=0;x<innerWidth;x+=50){rect(x,12,1,8,'#fff','0');const t=document.createElement('span');t.style.cssText='position:absolute;left:'+(x+2)+'px;top:1px;font-size:9px;';t.textContent=String(round(x+scrollX));layer.append(t);}
  for(let y=50;y<innerHeight;y+=50){rect(12,y,8,1,'#fff','0');const t=document.createElement('span');t.style.cssText='position:absolute;left:1px;top:'+y+'px;font-size:9px;writing-mode:vertical-rl';t.textContent=String(round(y+scrollY));layer.append(t);}
  if(metrics.reference){const b=reference.getBoundingClientRect();rect(b.left,b.top,b.width,b.height,'transparent','2px solid #a855f7');const ax=r.left+r.width/2,ay=r.top+r.height/2,bx=b.left+b.width/2,by=b.top+b.height/2;rect(Math.min(ax,bx),ay,Math.abs(ax-bx),1,'#a855f7','0');rect(bx,Math.min(ay,by),1,Math.abs(ay-by),'#a855f7','0');label('Gap X '+metrics.reference.horizontal+' / Y '+metrics.reference.vertical+' px',bx,by);}
  document.body.append(layer);
 }
 const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(draw);}};

 const parentWindowSend=data=>parent.postMessage(data,'*');
 const alignBoxes=${alignmentDeltas.toString()};
 const find=id=>document.querySelector('[data-estudio-id="'+String(id).replace(/[^a-f0-9]/g,'')+'"]');
 const notifySelection=()=>parentWindowSend({type:'estudio-select',id:selected?.dataset.estudioId||'',ids:selection.map(n=>n.dataset.estudioId)});
 function choose(n,extend=false){
  if(!extend){selection=[n];selected=n;}
  else if(selection.includes(n)){selection=selection.filter(x=>x!==n);selected=selection.at(-1)||null;}
  else {selection=selection.filter(x=>!x.contains(n)&&!n.contains(x));selection.push(n);selected=n;}
  reference=null;notifySelection();schedule();
 }
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const read=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return{node:n,id:n.dataset.estudioId,x:r.left,y:r.top,width:r.width,height:r.height,left:parseFloat(s.left)||0,top:parseFloat(s.top)||0,position:['absolute','fixed'].includes(s.position)?s.position:'relative',old:n.getAttribute('style')||''};};
 const offset=(item,dx,dy)=>({position:item.position,left:Math.round(clamp(item.left+dx,-5000,10000)),top:Math.round(clamp(item.top+dy,-5000,10000))});
 const apply=(n,style)=>{for(const [key,value]of Object.entries(style))n.style[key]=key==='position'?value:value+'px';};
 function commit(changes){if(!changes.length)return;busy=true;parentWindowSend({type:'estudio-transforms',id:changes[0].id,changes});schedule();}
 function align(action){
  if(!editing||busy||!selection.length)return;
  const items=selection.map(read),p=items[0].node.parentElement,r=p.getBoundingClientRect(),st=getComputedStyle(p);
  const pl=parseFloat(st.paddingLeft)||0,pr=parseFloat(st.paddingRight)||0,pt=parseFloat(st.paddingTop)||0,pb=parseFloat(st.paddingBottom)||0;
  const bounds={id:'parent',x:r.left+p.clientLeft+pl,y:r.top+p.clientTop+pt,width:p.clientWidth-pl-pr,height:p.clientHeight-pt-pb};
  const deltas=alignBoxes(items,action,bounds);
  commit(items.map((item,i)=>({id:item.id,style:offset(item,deltas[i].dx,deltas[i].dy)})));
 }
 window.addEventListener('message',e=>{
  if(e.source!==parent)return;
  if(e.data?.type==='estudio-align'&&['left','center','right','top','middle','bottom'].includes(e.data.action)){align(e.data.action);return;}
  if(e.data?.type!=='estudio-edit-mode')return;
  editing=!!e.data.enabled;busy=!!e.data.busy;freeMove=!!e.data.freeMove;measuring=!!e.data.measuring;snap=!!e.data.snap;zoom=Math.max(.25,Number(e.data.zoom)||1);
  document.querySelectorAll('[data-estudio-id]').forEach(n=>{n.draggable=false;n.style.touchAction=editing?'none':'';});
  if(!gesture){selection=(e.data.ids?.length?e.data.ids:e.data.id?[e.data.id]:[]).map(find).filter(Boolean);selected=selection.find(n=>n.dataset.estudioId===e.data.id)||selection.at(-1)||null;}
  document.body.classList.toggle('estudio-edit-mode',editing);document.body.style.userSelect=inline?'text':editing?'none':'';schedule();
 });
 document.addEventListener('click',e=>{
  if(inline&&inline.node.contains(e.target))return;if(e.target.closest('[data-editor-tools]'))return;if(!editing&&!measuring)return;
  const n=e.target.closest('[data-estudio-id]');if(!n)return;e.preventDefault();e.stopImmediatePropagation();
  if(suppressClick){suppressClick=false;return;}
  if(measuring&&e.shiftKey&&selected){reference=n;schedule();return;}
  if(!editing){choose(n);return;}
 },true);
 function drawTools(){
  if(tools)tools.remove();tools=null;
  if(!editing||inline||!selection.length)return;
  tools=document.createElement('div');tools.dataset.editorTools='true';tools.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483646';
  const size=9/zoom;
  for(const n of selection){const r=n.getBoundingClientRect();const outline=document.createElement('div');outline.style.cssText='position:absolute;box-sizing:border-box;border:'+1/zoom+'px solid #2563eb;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;';tools.append(outline);}
  if(selection.length===1&&!busy){const n=selection[0],r=n.getBoundingClientRect();
    for(const dir of ['nw','n','ne','e','se','s','sw','w']){
      if((dir==='n'||dir==='s')&&n.tagName!=='IMG'&&n.tagName!=='SECTION')continue;
      const x=dir.includes('w')?r.left:dir.includes('e')?r.right:r.left+r.width/2;
      const y=dir.includes('n')?r.top:dir.includes('s')?r.bottom:r.top+r.height/2;
      const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Resize '+dir);b.title='Resize '+dir.toUpperCase();
      b.style.cssText='position:absolute;pointer-events:auto;touch-action:none;box-sizing:border-box;padding:0;background:white;border:'+1/zoom+'px solid #2563eb;width:'+size+'px;height:'+size+'px;left:'+(x-size/2)+'px;top:'+(y-size/2)+'px;cursor:'+dir+'-resize;';
      b.onpointerdown=e=>{e.preventDefault();e.stopPropagation();start(e,n,dir);};tools.append(b);
    }
  }
  document.body.append(tools);
 }
 function start(e,n,mode){
   gesture={mode,x:e.clientX,y:e.clientY,items:(mode==='move'?selection:[n]).map(read),active:false,changes:[]};
   n.setPointerCapture(e.pointerId);
 }
 let pointerDrag=null,dropHighlight=null;
 const clearDrop=()=>{if(dropHighlight){dropHighlight.node.style.outline=dropHighlight.old;dropHighlight=null;}};
 document.addEventListener('dragstart',e=>{if(editing)e.preventDefault();},true);
 document.addEventListener('pointerdown',e=>{
  if(inline){if(inline.node.contains(e.target))return;finishInline();return;}
  if(!editing||busy||e.button!==0||e.target.closest('[data-editor-tools]'))return;
  if(e.pointerType==='touch'){const target=e.target.closest('[data-estudio-id]');const now=Date.now();if(target&&target.dataset.estudioId===lastTap.id&&now-lastTap.time<400){e.preventDefault();lastTap={id:'',time:0};beginInline(target);return;}lastTap={id:target?.dataset.estudioId||'',time:now};}
  const n=e.target.closest('[data-estudio-id]');if(!n){selection=[];selected=null;notifySelection();schedule();return;}
  if(measuring&&e.shiftKey)return;
  e.preventDefault();
  if(e.shiftKey){choose(n,true);return;}
  if(!selection.includes(n))choose(n);
  if(freeMove)start(e,n,'move');
  else{pointerDrag={node:n,x:e.clientX,y:e.clientY,active:false};n.setPointerCapture(e.pointerId);}
 });
 document.addEventListener('pointermove',e=>{
  if(gesture){
    const g=gesture;let dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(Math.hypot(dx,dy)<3&&!g.active)return;g.active=true;e.preventDefault();
    if(e.shiftKey&&g.mode==='move'){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
    if(snap){dx=Math.round(dx/8)*8;dy=Math.round(dy/8)*8;}
    g.changes=g.items.map(item=>{
      if(g.mode==='move'){const style=offset(item,dx,dy);apply(item.node,style);return{id:item.id,style};}
      const west=g.mode.includes('w'),east=g.mode.includes('e'),north=g.mode.includes('n'),south=g.mode.includes('s');
      const p=item.node.parentElement,ps=getComputedStyle(p),pw=Math.max(1,p.clientWidth-(parseFloat(ps.paddingLeft)||0)-(parseFloat(ps.paddingRight)||0));
      const w=clamp(item.width+(west?-dx:east?dx:0),Math.min(12,pw),pw);
      const h=clamp(item.height+(north?-dy:south?dy:0),12,item.node.tagName==='IMG'?10000:2500);
      const style={width:Math.max(1,Math.min(100,w/pw*100)),maxWidth:w,...offset(item,west?item.width-w:0,north&&(item.node.tagName==='IMG'||item.node.tagName==='SECTION')?item.height-h:0)};
      if(item.node.tagName==='IMG')style.height=h;else if(item.node.tagName==='SECTION')style.minHeight=h;
      apply(item.node,{...style,width:w});return{id:item.id,style};
    });drawTools();return;
  }
  if(!pointerDrag)return;if(Math.hypot(e.clientX-pointerDrag.x,e.clientY-pointerDrag.y)<8&&!pointerDrag.active)return;
  pointerDrag.active=true;e.preventDefault();clearDrop();const n=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-estudio-id]');
  if(n&&n!==pointerDrag.node&&!pointerDrag.node.contains(n)){dropHighlight={node:n,old:n.style.outline};n.style.outline='3px dashed #2563eb';}
 },{passive:false});
 document.addEventListener('pointerup',e=>{
  if(gesture){const g=gesture;gesture=null;g.items.forEach(item=>item.node.setAttribute('style',item.old));if(g.active){suppressClick=true;commit(g.changes);}schedule();return;}
  if(!pointerDrag)return;const current=pointerDrag;pointerDrag=null;clearDrop();if(!current.active)return;
  suppressClick=true;e.preventDefault();const n=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-estudio-id]');
  if(n&&n!==current.node&&!current.node.contains(n)){const r=n.getBoundingClientRect(),ratio=(e.clientY-r.top)/Math.max(1,r.height);const placement=n.tagName==='SECTION'&&ratio>.25&&ratio<.75?'inside':ratio<.5?'before':'after';busy=true;parentWindowSend({type:'estudio-drop',id:current.node.dataset.estudioId,target:n.dataset.estudioId,placement});}
 },true);
 function cancel(){if(gesture){gesture.items.forEach(item=>item.node.setAttribute('style',item.old));gesture=null;}pointerDrag=null;clearDrop();schedule();}
 document.addEventListener('pointercancel',cancel);
 document.addEventListener('keydown',e=>{
  if(inline||busy||e.target.closest('input,textarea,select,[contenteditable]'))return;
  const key=e.key.toLowerCase(),modifier=e.ctrlKey||e.metaKey;
  if((modifier&&(key==='z'||key==='y'))||(!modifier&&key==='v')){e.preventDefault();parentWindowSend({type:'estudio-shortcut',key,modifier,shift:e.shiftKey});}
 });
 document.addEventListener('keydown',e=>{
  if(inline||!editing||busy||!selection.length||e.target.closest('input,textarea,select,[contenteditable]'))return;
  if(e.key==='Escape'){cancel();return;}
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(!delta)return;e.preventDefault();const step=e.shiftKey?10:1;
  commit(selection.map(read).map(item=>({id:item.id,style:offset(item,delta[0]*step,delta[1]*step)})));
 });
 addEventListener('scroll',schedule,true);addEventListener('resize',schedule);document.fonts?.ready.then(schedule);document.addEventListener('load',schedule,true);
 send('estudio-preview-ready','');
})();`;
