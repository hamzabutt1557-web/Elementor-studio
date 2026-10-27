import type { Metadata } from "next";
import "./globals.css";
import "./studio-editor.css";
export const metadata: Metadata = {
  title: "Elementor Studio — From reference to editable",
  description:
    "Create editable Elementor page drafts from authorized websites or client briefs.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
