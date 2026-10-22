// Uploaded files stay inside the saved draft; no public hosting credentials needed.
export const uploadPrefix = "https://studio-upload.invalid/";
export function isUpload(url: string) {
  return url.startsWith(uploadPrefix);
}
export function assetSource(url: string, assets?: Record<string, string>) {
  return assets?.[url] || url;
}
