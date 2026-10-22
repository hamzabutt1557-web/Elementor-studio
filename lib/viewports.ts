/** The same sampled widths are used for capture and every preview. */
export const viewportWidths = {
  desktop: 1440,
  tablet: 820,
  mobile: 390,
} as const;
export type PreviewDevice = keyof typeof viewportWidths;
export function viewportWidth(device: string) {
  return viewportWidths[device as PreviewDevice] || viewportWidths.desktop;
}
