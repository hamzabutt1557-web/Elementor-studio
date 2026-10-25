import type { Design, DesignNode } from "./design";
export type TreeAction = "up" | "down" | "duplicate" | "delete";
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);
export function editTree(
  design: Design,
  target: string,
  action: TreeAction,
): Design {
  const draft = structuredClone(design);
  function visit(nodes: DesignNode[]): boolean {
    const index = nodes.findIndex((n) => n.id === target);
    if (index < 0) return nodes.some((n) => visit(n.children));
    if (action === "up" && index > 0)
      [nodes[index - 1], nodes[index]] = [nodes[index], nodes[index - 1]];
    if (action === "down" && index < nodes.length - 1)
      [nodes[index + 1], nodes[index]] = [nodes[index], nodes[index + 1]];
    if (action === "delete") {
      const removed = new Set<string>();
      const collect = (n: DesignNode) => {
        removed.add(n.id);
        n.children.forEach(collect);
      };
      collect(nodes[index]);
      nodes.splice(index, 1);
      const clean = (n: DesignNode) => {
        if (n.interaction && removed.has(n.interaction.target))
          delete n.interaction;
        n.children.forEach(clean);
      };
      draft.nodes.forEach(clean);
    }
    if (action === "duplicate") {
      const copy = structuredClone(nodes[index]);
      const ids = new Map<string, string>();
      const assign = (n: DesignNode) => {
        const old = n.id;
        n.id = newId();
        ids.set(old, n.id);
        n.children.forEach(assign);
      };
      assign(copy);
      const remap = (n: DesignNode) => {
        if (n.interaction && ids.has(n.interaction.target))
          n.interaction.target = ids.get(n.interaction.target)!;
        n.children.forEach(remap);
      };
      remap(copy);
      nodes.splice(index + 1, 0, copy);
    }
    return true;
  }
  visit(draft.nodes);
  if (!draft.nodes.length)
    throw new Error("Keep at least one section in the page.");
  return draft;
}
export function addSection(design: Design, parent?: string): Design {
  const draft = structuredClone(design);
  const section: DesignNode = {
    id: newId(),
    kind: "container",
    style: { direction: "column", padding: 32, gap: 16, background: "#ffffff" },
    children: [
      {
        id: newId(),
        kind: "heading",
        text: "New section",
        style: { fontSize: 32 },
        children: [],
      },
      {
        id: newId(),
        kind: "text",
        text: "Click to edit your content.",
        style: { fontSize: 16 },
        children: [],
      },
    ],
  };
  const find = (nodes: DesignNode[]): DesignNode | undefined => {
    for (const n of nodes) {
      if (n.id === parent) return n;
      const result = find(n.children);
      if (result) return result;
    }
  };
  const container = parent ? find(draft.nodes) : undefined;
  if (container?.kind === "container") container.children.push(section);
  else draft.nodes.push(section);
  return draft;
}
export function addWidget(
  design: Design,
  parent: string,
  kind: "heading" | "text" | "button" | "image" | "search" | "contact",
): Design {
  const draft = structuredClone(design);
  const find = (nodes: DesignNode[]): DesignNode | undefined => {
    for (const n of nodes) {
      if (n.id === parent) return n;
      const child = find(n.children);
      if (child) return child;
    }
  };
  const target = find(draft.nodes);
  if (!target || target.kind !== "container")
    throw new Error("Select a section before adding an element.");
  target.children.push({
    id: newId(),
    kind,
    ...(kind === "image" ? { alt: "New image" } : {}),
    text:
      kind === "contact" ? "Send message" : kind === "search" ? "Search this site" : kind === "image"
        ? undefined
        : kind === "heading"
          ? "New heading"
          : kind === "button"
            ? "Contact us"
            : "Add your text here",
    ...(kind === "button" ? { url: "#contact" } : {}),
    style:
      kind === "button"
        ? { background: "#147d68", color: "#ffffff", padding: 12, radius: 6 }
        : kind === "heading"
          ? { fontSize: 32 }
          : { fontSize: 16 },
    children: [],
  });
  return draft;
}

export function moveNode(
  design: Design,
  id: string,
  target: string,
  placement: "before" | "after" | "inside",
): Design {
  const draft = structuredClone(design);
  const locate = (
    nodes: DesignNode[],
  ): { nodes: DesignNode[]; index: number } | undefined => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return { nodes, index: i };
      const result = locate(nodes[i].children);
      if (result) return result;
    }
  };
  const source = locate(draft.nodes);
  if (!source || id === target)
    throw new Error("Choose another element to drop onto.");
  const moved = source.nodes[source.index];
  const contains = (n: DesignNode): boolean =>
    n.id === target || n.children.some(contains);
  if (contains(moved))
    throw new Error("A section cannot be moved inside itself.");
  source.nodes.splice(source.index, 1);
  let inserted = false;
  const insert = (nodes: DesignNode[]) => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === target) {
        if (placement === "inside") {
          if (nodes[i].kind !== "container")
            throw new Error("Drop inside a section.");
          nodes[i].children.push(moved);
        } else nodes.splice(i + (placement === "after" ? 1 : 0), 0, moved);
        inserted = true;
        return;
      }
      insert(nodes[i].children);
      if (inserted) return;
    }
  };
  insert(draft.nodes);
  if (!inserted) throw new Error("Drop target no longer exists.");
  return draft;
}
