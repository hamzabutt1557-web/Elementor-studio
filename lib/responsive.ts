import type { DesignNode, Style } from './design';

function difference(base: Style, next: Style): Style {
  return Object.fromEntries(Object.entries(next).filter(([key,value]) => JSON.stringify(base[key as keyof Style]) !== JSON.stringify(value))) as Style;
}

/** Preserve breakpoint-only nodes, including separate mobile navigation. */
export function mergeResponsive(desktop: DesignNode[], tablet: DesignNode[], mobile: DesignNode[]): DesignNode[] {
  const merged: DesignNode[] = [];
  const ids = [...new Set([...desktop, ...tablet, ...mobile].map(n => n.id))];
  for (const id of ids) {
    const d = desktop.find(n => n.id === id);
    const t = tablet.find(n => n.id === id);
    const m = mobile.find(n => n.id === id);
    const base = d || t || m!;
    const ds: Style = d ? { ...d.style, hidden: false } : { hidden: true };
    const ts: Style = t ? { ...t.style, hidden: false } : { hidden: true };
    const ms: Style = m ? { ...m.style, hidden: false } : { hidden: true };
    merged.push({ ...base,
      style: ds,
      tablet: difference(ds, ts),
      mobile: difference({...ds,...ts}, ms),
      children: mergeResponsive(d?.children || [], t?.children || [], m?.children || []),
    });
  }
  return merged;
}
