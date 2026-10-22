/** Match robots wildcards without treating everything before `*` as a block. */
export function robotsAllows(text: string, url: URL, agent = "ElementorStudio") {
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };
  const groups: Group[] = [];
  let group: Group | undefined;
  let directives = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!group || directives) {
        group = { agents: [], rules: [] };
        groups.push(group);
        directives = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group && (key === "allow" || key === "disallow")) {
      directives = true;
      if (value) group.rules.push({ allow: key === "allow", path: value });
    }
  }
  const token = agent.toLowerCase();
  const specificity = (g: Group) => Math.max(-1, ...g.agents.map(a =>
    a === "*" ? 0 : token.includes(a) ? a.length : -1));
  const best = Math.max(-1, ...groups.map(specificity));
  const path = url.pathname + url.search;
  let length = -1;
  let allowed = true;
  for (const g of groups.filter(g => specificity(g) === best && best >= 0)) {
    for (const rule of g.rules) {
      const anchored = rule.path.endsWith("$");
      const pattern = anchored ? rule.path.slice(0, -1) : rule.path;
      const expression = pattern.split("*").map(part =>
        part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
      if (!new RegExp("^" + expression + (anchored ? "$" : "")).test(path)) continue;
      const size = pattern.replace(/\*/g, "").length;
      if (size > length || (size === length && rule.allow)) {
        length = size;
        allowed = rule.allow;
      }
    }
  }
  return allowed;
}
