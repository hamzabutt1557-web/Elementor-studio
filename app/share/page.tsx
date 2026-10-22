"use client";
import { useEffect, useState } from 'react';
import {readShareLink} from '@/lib/share-link';
export default function SharedPreview(){
  const [html,setHtml]=useState('');const [error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();
    async function load(){try{const design=await readShareLink(location.hash);const res=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({design}),signal:controller.signal});const data=await res.json();if(!res.ok)throw new Error(data.error);if(!controller.signal.aborted)setHtml(data.preview);}catch(e){if(!controller.signal.aborted)setError((e as Error).message);}}
    void load();return()=>controller.abort();
  },[]);
  return html ? <iframe title="Client website preview" srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" style={{position:'fixed',inset:0,width:'100%',height:'100%',border:0,background:'white'}}/> : <div style={{padding:40}} role="status">{error || 'Opening website preview…'}</div>;
}
