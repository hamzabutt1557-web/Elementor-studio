import type { DesignNode, Style } from './design';
import type { LayoutBox } from './layout-audit';
type CaptureGeometry = Partial<Record<'desktop'|'tablet'|'mobile',Record<string,LayoutBox>>>;

function difference(base: Style, next: Style): Style {
  return Object.fromEntries(Object.entries(next).filter(([key,value]) => JSON.stringify(base[key as keyof Style]) !== JSON.stringify(value))) as Style;
}

/** Preserve breakpoint-only nodes, including separate mobile navigation. */
export function mergeResponsive(desktop: DesignNode[], tablet: DesignNode[], mobile: DesignNode[], geometry?: CaptureGeometry): DesignNode[] {
  const merged: DesignNode[] = [];
  const ids = [...new Set([...desktop, ...tablet, ...mobile].map(n => n.id))];
  for (const id of ids) {
    const d = desktop.find(n => n.id === id);
    const t = tablet.find(n => n.id === id);
    const m = mobile.find(n => n.id === id);
    const base = d || t || m!;
    // Artwork/picture sources can differ across breakpoints; styling alone
    // cannot switch Elementor's image URL. Keep native responsive variants.
    const variantKey = (n: DesignNode) => n.kind === 'image' ? n.kind + ':' + n.url : n.kind;
    const kinds = [...new Set([d,t,m].filter(Boolean).map(n=>variantKey(n!)))];
    if (kinds.length > 1) {
      // A source element can change from a text leaf to a structured container
      // across breakpoints. Keep both native representations, never attach
      // container children to a text/image widget (which invalidates export).
      for (const kind of kinds) {
        let hash = 2166136261;
        for (const c of id + ":" + kind) hash = Math.imul(hash ^ c.charCodeAt(0),16777619);
        const variantId = kind === variantKey(base) ? id : (hash >>> 0).toString(16).padStart(8,"0");
        if (variantId !== id && geometry) {
          for (const [device,node] of [['desktop',d],['tablet',t],['mobile',m]] as const) {
            const boxes=geometry[device];
            if(node && variantKey(node)===kind && boxes?.[id]) {boxes[variantId]=boxes[id];delete boxes[id];}
          }
        }
        const variant = (n: DesignNode | undefined) => n && variantKey(n) === kind ? [{...n,id:variantId}] : [];
        merged.push(...mergeResponsive(variant(d),variant(t),variant(m),geometry));
      }
      continue;
    }
    const ds: Style = d ? { ...d.style, hidden: false } : { ...base.style, hidden: true };
    const ts: Style = t ? { ...t.style, hidden: false } : { hidden: true };
    const ms: Style = m ? { ...m.style, hidden: false } : { hidden: true };
    merged.push({ ...base,
      style: ds,
      tablet: difference(ds, ts),
      mobile: difference({...ds,...ts}, ms),
      children: mergeResponsive(d?.children || [], t?.children || [], m?.children || [],geometry),
    });
  }
  return merged;
}
