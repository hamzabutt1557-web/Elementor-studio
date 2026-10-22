import type { Design } from './design';
export async function createShareLink(design: Design): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(design));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = ''; for(const byte of packed) binary += String.fromCharCode(byte);
  const hash = btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(hash.length > 60000) throw new Error('This page is too large for a portable preview link. Export the ZIP instead.');
  return location.origin + '/share#v1.' + hash;
}
export async function readShareLink(hash: string): Promise<unknown> {
  if(!hash.startsWith('#v1.') || hash.length > 60005) throw new Error('Invalid or oversized preview link.');
  const text = atob(hash.slice(4).replace(/-/g,'+').replace(/_/g,'/'));
  const bytes = Uint8Array.from(text, c=>c.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  let size=0; const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3500000){await reader.cancel();throw new Error('Preview exceeds the size limit.');}chunks.push(value);}
  return JSON.parse(await new Blob(chunks as BlobPart[]).text());
}
