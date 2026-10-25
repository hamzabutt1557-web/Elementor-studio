# Elementor Studio 0.4.13

URL or client brief → editable draft → live edit/compare → native Elementor JSON or WordPress ZIP package.
This is a page draft generator for owned/authorized sources. No similarity percentage or arbitrary-site functional clone is promised.

## Run locally

1. Install Node.js 24 and run `npm ci`.
2. Copy `.env.example` to `.env.local` and fill owner settings as needed.
3. Run `npm run dev` and open http://localhost:3000.
4. Build a client brief without an AI key; edit, preview and export.
5. On Windows set `CHROMIUM_EXECUTABLE_PATH` to Chrome. A browser failure produces a labelled HTML-only fallback.

## Production setup

- Start with `APP_PASSWORD` in Vercel for private password access (any username). Alternatively connect verified email login below. With `AUTH_MODE=email`, all private routes require the verified owner session and the old password is ignored. Missing access configuration returns 503; unauthenticated API requests return 401. `/share` stays public so client links do not expose the private editor.
- Paste a public source URL directly; no domain registration or owner approval list is required. Capture still requires the private workspace in production. DNS-pinned public-address checks, robots policies, challenge detection and request/size limits still apply.
- `AI_MAX_REQUEST_USD` defaults to 0.25 USD per request and caps the client budget. Server-funded AI additionally requires private app access. Provider rates must be verified by the owner. No automatic paid retry occurs.
- Deploy with standard Next.js build settings. Chromium runs on the server; WordPress hosting is required separately for the generated site.

## Verified owner-email login (one-time connection required)

Email → verification code → private workspace. Supabase verifies the session on the server using `getUser()`. Every private API and the workspace page checks the confirmed email against `OWNER_EMAIL`. Other accounts, anonymous users, and unsigned client email headers never grant access. Client `/share` previews remain public. Once `AUTH_MODE=email` is enabled, the old app password cannot bypass it.

Works with the existing Vercel URL; no custom app domain is required. No database tables or service-role key are needed. See `EMAIL-LOGIN-SETUP.md` for the one-time Supabase project, confirmation/OTP template and connection steps. Use only a publishable/anon key. Keep email confirmation enabled. Supabase's default email sender is restricted to project-team addresses and has a small sending quota; an independent production mail rollout requires custom SMTP.

**Current release status:** code/test integration ready; Supabase project connection and a delivered email/session acceptance test are pending. Existing password mode remains active until that setup is finished. No activation email has been sent.

## Capture and content

- Computed layout capture at desktop 1440px, tablet **820px**, mobile 390px. The tablet sample is inside common 768–1023px ranges; one sample cannot represent every breakpoint. Preview uses Elementor's default 1024/767px boundaries.
- Limits: 3,000 captured elements/depth 22; merged/exported design up to 3,000 elements/depth 24. Responsive-only nodes may increase the merged count.
- Native containers, heading, text-editor, button, image and **video** widgets. Text emphasis and safe inline links are preserved as escaped structured runs. Plain text edits replace stale rich formatting.
- Linked image/card containers retain destination links. Inline SVG artwork is rasterized into bounded image widgets (up to 20 embedded assets); SVG paths are not vector-editable. Unsupported artwork is reported.
- Direct MP4/WebM/OGG and known YouTube/Vimeo embeds are captured as video widgets. Video remains remotely hosted. Arbitrary iframe/canvas content is reported for replacement.
- Form fields become labelled editable placeholders with explicit warnings. They are not operational forms. Connect a WordPress form plugin and validate submissions before delivery. No source form is submitted by capture.
- Generic HTML/CSS rules are the main path. Theme-specific hero, ratio, drawer and marquee adapters remain supplemental heuristics. Quality on other sites requires visual review; there is no broad fidelity benchmark yet.
- Transparent desktop background defaults are omitted after responsive merging; explicit breakpoint overrides remain. Zero spacing/radius is retained where native widget/theme defaults could otherwise change the layout.

## Editor and export

- Direct move, corner resize, six alignment actions, Shift+click multi-selection, snap, Undo, searchable nested Layers with per-viewport visibility, images, colours, font and spacing controls.
- Projects are saved locally in this browser. This is not cross-device cloud storage. Share links contain a compressed snapshot and can exceed the size limit with large images; use ZIP instead.
- Native page JSON is portable and keeps direct styles. It does not install scripts, media or site-wide globals. Drawer content falls back to inline navigation instead of a fixed overlay.
- ZIP includes the importer plugin, page templates, preview files, reports and bounded optimized media. The importer clears Elementor's generated CSS cache after saving page data so the new native styles are rebuilt. Uploaded assets must use ZIP for media remapping. Remote media can remain linked if unavailable or over budget.
- Install the importer, then Tools → Elementor Studio → import the ZIP as draft pages. Keep it active for drawer/FAQ/catalogue runtime. Editor mode bypasses that runtime.
- Optional **Add imported colours and fonts as new Elementor Global Styles** appends custom styles to the active Kit and maps imported widgets through `__globals__`. Existing global styles are preserved. A failed import restores the previous Kit settings. Manual JSON keeps direct values to avoid dangling global references.
- Containers/widgets use `isInner:false`, matching the published modern container schema. Mixed auto margins include px on numeric vertical sides. Custom grid columns use the native custom-unit control. Native frontend rendering, global styles, custom grid CSS and auto-margin CSS passed on WordPress 7.1.3 + Elementor 4.3.5 in isolated Playground. Full admin ZIP upload and interactive editor visual acceptance remain required.
- Products/search/sorting/quick preview operate only on captured cards. WooCommerce database, full catalogue filters, cart, checkout, payment, shared theme header/footer and source-site scripts are not installed.

## Verification

Run `npm test`, `npm run typecheck`, `npm run build`. Run `npm run sync:importer` after editing the canonical PHP importer or trusted runtime. Tests check plugin parity to prevent stale embedded copies.
See `VALIDATION.json` for evidence and `AUDIT-RESOLUTION.md` for the supplied review's issue-by-issue status. 72 unit/API tests, live authenticated build/ZIP checks and isolated native WordPress frontend checks passed. These do not prove visual similarity, a real AI-provider call, or interactive WordPress editor behavior.

Official schema references: https://developers.elementor.com/docs/data-structure/widget-element and https://developers.elementor.com/docs/data-structure/global-styles . These are documentation fixtures, not an export from your WordPress installation.

## Optional AI configuration

Copy `.env.example` to `.env.local`. Configure only on the server:

- `AI_API_KEY`: provider key.
- `AI_BASE_URL`: HTTPS OpenAI-compatible base URL ending in `/v1/` or the provider's compatible root. Endpoint must accept `chat/completions`.
- `AI_MODEL`: supported text-model identifier.
- `AI_INPUT_RATE` / `AI_OUTPUT_RATE`: verified USD per million tokens. Use zero only for a genuinely free configuration.
- `APP_PASSWORD`: private app password.
- `CHROMIUM_EXECUTABLE_PATH`: optional system Chrome override.

The adapter sends the design tree as text, no screenshots. It expects JSON output, `response_format: json_object`, `max_tokens`, and standard `choices`/`usage`. Compatibility is provider-specific. Never use a `NEXT_PUBLIC_` variable for secrets. No keys are returned by `/api/config` or saved in browser storage.

## Validation

Run `npm run test`, `npm run typecheck`, `npm run build`.

Acceptance cases implemented as offline fixtures: static landing page extraction, independent multi-page packaging, WooCommerce-shaped page remaining static. Direct no-AI build route tested. Safety, escaping, duplicate IDs, budget prevention and failed-provider metering tested. These do not substitute for live acceptance on three owned websites and a WordPress staging installation.

## Structure

- `app/page.tsx`: builder interface and session state.
- `app/api`: discovery, build, configuration and ZIP endpoints.
- `lib/network.ts`: URL safety, DNS pinning, bounded redirects/downloads.
- `lib/crawler.ts`: robots policy check, discovery, browser/HTML capture.
- `lib/design.ts`: intermediate design tree, validation, deterministic brief engine.
- `lib/elementor.ts`: native-widget JSON mapping and safe draft renderer.
- `lib/provider.ts`: optional AI adapter and budget/usage accounting.
- `lib/export.ts`: JSON, media, setup and report packaging.
- `tests/core.test.ts`: automated acceptance/safety checks.

## Documentation used (checked 11 October 2026)

- Elementor JSON envelope and documented example: https://developers.elementor.com/docs/data-structure/general-structure
- Container structure: https://developers.elementor.com/docs/data-structure/container-element
- Page settings: https://developers.elementor.com/docs/data-structure/page-settings
- Next.js App Router installation: https://nextjs.org/docs/app/getting-started/installation
- Verify deployment duration for your plan: https://vercel.com/docs/functions/configuring-functions/duration

No provider prices or free quota are asserted. Verify them with the provider before configuring AI mode.

## Reproduce isolated WordPress checks

`tests/wordpress-native-check.php` expects WordPress + Elementor and the current importer at `/wordpress/`. It reads the controlled template from `/qa/template.json` and writes its result and native HTML to `/qa/`. A Playground setup can supply these using `writeFile` and `runPHP` Blueprint steps. The pinned check used @wp-playground/cli 3.1.58, PHP 8.3, WordPress 7.1.3 and Elementor 4.3.5. The stored result is in `tests/fixtures/wordpress-native-result.json`. This controlled generated fixture is not an export authored through the user's Elementor UI.

For isolated importer logic without WordPress, run `php tests/php-global-styles.php` (verified with PHP 7.4 and 8.3). It uses explicit stubs and is not full WordPress integration.

## Project setup and settings refresh (0.4.1)

Project creation now uses a compact source form, optional expandable AI connection and a sticky drawer action area. Mobile fields stack, use readable input sizes and safe-area spacing; the drawer has one bounded scroll region and resets its scroll position on open. Settings reuses the same functional session connection controls, plus light/dark appearance choices. Placeholder roadmap cards were removed.

Load available models retrieves the provider's model IDs through the fixed provider endpoint. No guessed model name is prefilled. Keys remain session-only, and stale connection responses cannot overwrite feedback after key/provider/model changes. Paid mode exposes pricing and budget controls. Live provider discovery/generation requires the user's own key; tests use isolated provider responses.

Design references: https://linear.app/changelog/2026-03-12-ui-refresh and https://docs.lovable.dev/features/projects/settings .

## Direct URL capture (0.4.2)

Per-domain registration was removed at the owner’s request. Custom domains and public Shopify URLs use the same direct capture path. The obsolete CAPTURE_ALLOWED_HOSTS environment variable is ignored. Private app authentication, private-network/credentialed URL rejection, robots policy checks, challenge detection and bounded crawls remain in place. Capturing a Shopify page produces an editable layout draft, not an operational Shopify cart/checkout backend.

## 0.4.4 workflow improvements

- Capture, draft preview and live editor now share 1440 / 820 / 390 px samples. Elementor CSS breakpoint boundaries remain 1024/767px.
- Login expiry, permissions, throttling, large uploads, gateway timeouts, network failure and malformed responses have readable recovery messages across builds, edits and exports. Browser requests use bounded header waits and no automatic retry, including paid builds.
- Configuration responses are checked before use; an authentication error cannot be mistaken for a valid configuration. Settings shows active password/email mode and pending email connection explicitly.
- 63 automated checks, typecheck and production build passed. Cloud-browser visual inspection was blocked by ERR_BLOCKED_BY_CLIENT; interactive UI acceptance is not claimed.

## Fonts and text editing (0.4.5)

- Search the bundled **1,950-family Google Fonts catalog**, filter by category or Arabic/Urdu, and choose a different font for each heading, paragraph or button. Brand font replacement uses the same full catalog. Font names are fetched lazily; only the fonts actually used by the page load external stylesheets.
- The Text editor supports selected-range **bold, italic, underline and mixed font families**. Typing preserves adjacent rich formatting. Original safe links remain intact. No raw HTML editing is required. Button labels stay native plain text; their font/weight controls apply to the whole button.
- Preview URLs request the styles actually available in each family, including italic variants. Inline font names are validated and escaped.
- Export ZIP includes selected-font metadata. Importer **0.4.5** registers imported Google families with native Elementor, stores page-specific metadata and loads stylesheets from the fixed Google CSS API. Keep the importer active. Manual JSON retains native family settings and inline formatting, but newer families may need the ZIP importer to register/load on older Elementor installations.
- Custom/installed family names are supported as names only: the font must already be available on the device and WordPress site. **Custom font-file upload and paid/proprietary font libraries are not included.** This is the Google Fonts catalog, not every font in existence.
- Catalog is a dated snapshot, available even if Google's metadata service is down. Run `npm run sync:fonts` to refresh it deliberately. Source: https://fonts.google.com/metadata/fonts . Font CSS API: https://developers.google.com/fonts/docs/css2 .
- New typography paths passed automated tests and isolated PHP 7.4/8.3 logic checks. Interactive font selection and a full new-font WordPress editor session still require visual acceptance; they are not claimed tested by the automated checks.

### Direct canvas text editing

In Preview & edit, double-click a heading or paragraph to type directly on the canvas. On touch screens, double-tap. Click outside the text or press Ctrl/Cmd + Enter to save; Escape cancels the current edit. Undo restores the previous saved draft. Text editor opens the content and font inspector; Design inspector toggles the panel. The canvas remains selectable while the inspector is closed. Inline text changes preserve surrounding rich text runs through the shared text replacement function.

## Conversion-first update (0.4.6)

Reference capture now preserves body spacing, mixed text and decorative boxes, resets desktop-only styles at smaller screens, retains reverse flex directions and carries native width limits into export. Extra local product tools are off by default; enable them in review notes only when wanted. New URL builds include an initial element-geometry layout check when capture time allows. This is not a pixel similarity score or WordPress validation. Rebuild existing saved drafts to use these converter changes. See CONVERSION-REVIEW.md for test scope and outstanding delivery checks.

## 0.4.13 — editable WordPress site search

- Recognised search inputs become a Studio Site Search Elementor widget instead of a text placeholder. Search-type fields, search roles and search-form actions are recognised.
- The widget can be added from the editor; its placeholder and typography are editable. The importer registers it for free Elementor, so keep the plugin active.
- Queries go to the destination WordPress search endpoint. Source-site form actions and typed search values are not copied.
- Preview shows the field; querying content starts after WordPress import. Source-specific product filters and contact-form submissions remain separate integrations.
- Local acceptance includes ZIP import, 21-element geometry at three widths, Elementor edit/save, search results and the empty-results case.

## 0.4.12 — conversion capacity and delivery review

- Stop conversion from the progress bar or conversion dialog. Cancellation propagates to queued jobs, Chromium, source downloads and AI fetches. A provider can still bill a request it already accepted.
- Each warm worker admits two conversions and queues at most six for up to 15 seconds. Excess work is rejected rather than retaining unbounded browser processes. This is not an account-wide quota or durable distributed queue.
- Source asset downloads are limited to four concurrent requests; cached response bodies are capped at 24 MB. There is a 110-second build deadline and stream heartbeats.
- Delivery checklist highlights missing images, unassigned buttons, source links, form placeholders, product backend connections and initial layout drift. ZIP reports include a fresh content checklist.
- 95 automated checks, including a 100-caller admission test and actual route streaming/cancellation. These are controlled tests, not a measured 100-user production capacity claim.
- See [SAAS-UPGRADE.md](SAAS-UPGRADE.md) for remaining production acceptance work.

## 0.4.11 — native import layout corrections

- Patched Next.js to 16.4.3 and refreshed vulnerable transitive dependencies; npm audit reported zero known vulnerabilities.
- Responsive grid and width settings now resolve inherited desktop/tablet context before export.
- Source block/inline/flex/grid flow, floats, clearing, shrink behaviour and asymmetric borders have editable responsive controls in the importer.
- Image wrappers retain their captured width. Native buttons and paragraphs no longer add a second layer of default padding or margins.
- Local WordPress 7.1.3 / Elementor 4.3.5 test: ZIP imported as a draft, all four packaged images loaded locally, and 20 elements matched preview geometry at 1440/820/390px. A heading was changed through the Elementor editor model, saved as a draft and verified on the frontend.
- Live BLS source comparison still has material drift; this release is not a pixel-perfect cloning guarantee. Forms and store backend connections still require manual implementation.

## 0.4.10 — repository recovery and capture fidelity

Complete application folders are restored alongside the 0.4.9 Layers editor and importer CSS refresh. Capture now retains negative-margin row widths above 100%, reserved media slots, and accessible source font faces. Original comparison starts on the captured desktop reference when available. The node budget is 3,000 and incomplete browser captures fail explicitly. Templates use compact JSON and enforce the importer's 3 MB limit.

Custom source font URLs remain external, including after ZIP import. Install the included importer to load them in WordPress; manual JSON does not register this metadata. These fixes do not establish universal visual equivalence. Header/filter fidelity and end-to-end visual acceptance on the target WordPress installation remain open.
