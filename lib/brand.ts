import { safeFontFamily } from "./font-types";
import { z } from "zod";
import { validateDesign, DesignNode } from "./design";
export const brandSchema = z.object({
  name: z.string().trim().max(100),
  oldName: z.string().trim().max(100),
  font: z
    .string()
    .trim()
    .max(100)
    .refine(
      (v) => v === "Original" || safeFontFamily(v),
      "Enter a valid font family name.",
    ),
  colours: z
    .object({
      primary: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .optional(),
      secondary: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .optional(),
      background: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .optional(),
      header: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .optional(),
      footer: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .optional(),
      button: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .optional(),
      buttonText: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .optional(),
    })
    .strict()
    .optional(),
  accent: z.string().regex(/^#[a-fA-F0-9]{6}$/),
});
export function rebrand(input: unknown, brand: z.infer<typeof brandSchema>) {
  const d = structuredClone(validateDesign(input));
  if (brand.name) d.title = brand.name;
  const walk = (n: DesignNode) => {
    if (brand.oldName && brand.name && n.text)
      n.text = n.text.split(brand.oldName).join(brand.name);
    for (const s of [n.style, n.tablet, n.mobile]) {
      if (!s) continue;
      if (brand.font !== "Original") {
        s.fontFamily = brand.font;
        if (n.runs) n.runs = n.runs.map(({ fontFamily, ...run }) => run);
      }
      if (n.kind === "button") {
        s.background = brand.colours?.button || brand.accent;
        if (brand.colours?.buttonText) s.color = brand.colours.buttonText;
      }
      if (n.kind === "heading" && brand.colours?.primary)
        s.color = brand.colours.primary;
      if (n.kind === "text" && brand.colours?.secondary)
        s.color = brand.colours.secondary;
      if (n.region === "header" && brand.colours?.header)
        s.background = brand.colours.header;
      if (n.region === "footer" && brand.colours?.footer)
        s.background = brand.colours.footer;
      if (
        n.kind === "container" &&
        d.nodes.some((root) => root.id === n.id) &&
        !n.region &&
        brand.colours?.background
      )
        s.background = brand.colours.background;
    }
    n.children.forEach(walk);
  };
  d.nodes.forEach(walk);
  return validateDesign(d);
}
