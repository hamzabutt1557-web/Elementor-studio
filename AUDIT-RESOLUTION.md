# Supplied review — resolution status (0.4.0)

| Finding | Change / evidence | Remaining acceptance |
| --- | --- | --- |
| Four widget types; SVG/video dropped | Added native video widget; bounded SVG raster image capture; explicit warning for unsupported embeds/canvas | Browser capture QA across owned sites; vector paths are not editable |
| Silent form fields | Both capture paths preserve labelled editable placeholders and explicit backend warning | Operational forms need a WordPress form plugin; no form submission backend |
| Bold and inline links flattened | Structured escaped runs in capture, preview, native heading/text editor; regression tests | Inline arbitrary CSS is not reproduced |
| Linked image/cards lost | Container links and image links export to native controls; linked-card fixture tested | Native frontend rendering passed; interactive editor acceptance pending |
| Tablet at 1024 | Capture moved to 820px | Different site breakpoints still need review |
| Theme-specific heuristics | Generic path retained, hero detection broadened, limitations documented honestly | No cross-site fidelity percentage established |
| Global styles absent | Optional additive native Kit import with global references and rollback | Native Kit colours/font + frontend passed; full admin ZIP/editor flow pending; manual JSON uses direct styles |
| Defaults bloat | Removed meaningless desktop transparency after breakpoint merging | Zero spacing/radius retained to override native theme defaults safely |
| Drawer overlay on manual JSON/editor | Manual JSON emits inline navigation; fixed positioning only in trusted frontend runtime; editor query/body detection | Full WordPress visual editor acceptance |
| isInner / auto margins / custom grid | isInner false per official modern docs; mixed custom auto margins use px; grid control confirmed against upstream source; tests | Grid and custom auto-margin CSS verified in real Elementor frontend; UI-authored user-version export fixture still absent |
| Stale docs/tests/version | App/plugin/config/docs unified at 0.4.0; test count/evidence updated | Elementor schema version remains 0.4 by design |
| Public Chromium / paid API | Production server endpoints fail closed without password; direct URL capture in the private workspace; server-enforced per-request AI cap; public share route isolated | Single-user gate; multi-user SaaS needs real auth/distributed quotas |
| Source authorization/legal | Domain registration removed at the owner’s explicit request; robots/challenge/private-network checks retained | No software setting proves ownership or transfers source rights; use authorized sources |

No guarantee of arbitrary-site exact cloning, complete operational forms/stores, or production WordPress acceptance is made. These are explicit remaining capabilities, not hidden successful checks.
