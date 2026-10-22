const DATABASE = 'elementor-studio';
const STORE = 'workspace';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
export async function loadDraft<T>(): Promise<T | undefined> {
  const db=await database();
  try {return await new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get('latest');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  finally{db.close();}
}
export async function saveDraft(value: unknown): Promise<void> {
  const db=await database();
  try {await new Promise<void>((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(value,'latest');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
  finally{db.close();}
}
