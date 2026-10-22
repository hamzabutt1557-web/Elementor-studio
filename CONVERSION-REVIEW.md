## Alignment correction — 0.4.7

Preserves computed minimum heights for headers and footers. Product ratio wrappers now retain their measured image slot and image dimensions/position instead of switching images to natural-size static flow. Centered block containers retain measured centering when browser computed margins report zero.

Regression: a three-product ratio-grid with header/footer minimum heights failed before the change. It now passes at 1440, 820 and 390px (p90 drift 0, 0 and 5px). All 24 controlled geometry cases and 77 unit tests pass. These checks do not establish public-site fidelity or WordPress visual acceptance. Earlier live-site layout gaps below remain unverified after this correction.

# Conversion engine review — 0.4.6

Goal: reuse an authorized reference page as an editable starting point, then change branding and content with minimal layout repair.

## Fixed in this pass

- Canonicalize complete CSS font stacks; an unterminated quoted fallback family was swallowing subsequent stylesheet rules and producing text-only output.
- Force instant scroll during capture so source smooth-scrolling cannot leave fixed headers measured at a lower-page offset. A browser regression verifies 390px/scrollY=0 after screenshotting an 820px-wide offscreen SVG.
- Reapply the requested viewport after element screenshots, omit off-canvas slider copies and report that only the visible scroll/slider state is captured. Fully clipped overflow wrappers are excluded from geometry metrics, while their visible descendants are still measured.
- Reset scroll after inline-artwork screenshots, and wait for preview font stylesheets before measuring layout.
- Collapse source HTML indentation using computed whitespace rules while preserving explicit BR line breaks.
- Capture body-level spacing, text around block children, inline emphasis/links and empty decorative boxes instead of silently losing them.
- Keep visible desktop navigation when its mobile-only toggle is hidden; mobile drawers still become editable panels.
- Keep flex reverse directions native; reversing the source child array broke layouts that changed direction on mobile.
- Explicitly clear desktop background images, borders, relative offsets, min-height and width limits when source CSS removes them at a smaller breakpoint.
- Export bounded widths through Elementor's native width slider with its custom unit. Importer data-contract checks preserve these values; a new interactive Elementor frontend/editor acceptance session is still required.
- Make added local product controls opt-in. The previous runtime inserted its own search/sort bar and quick-preview buttons into every detected catalogue, changing source layout. Existing source store functionality is not recreated by disabling or enabling this option.
- Reject AI output that changes source content, links, media, node order or parent-child structure. Optional AI can adjust layout styles; no claim that it can visually correct arbitrary pages is made.
- Run an initial geometry comparison at 1440/820/390px when capture time permits. Report element drift and missing/hidden elements. These are DOM measurements, not pixel similarity, not a fidelity percentage and not WordPress acceptance. Reports remain tied to the initial capture after edits or AI changes.

## Validation

- 77 automated tests; typecheck and production build.
- Seven controlled browser fixtures (desktop/mobile navigation, clipped slider state, long font stacks, formatted markup, business, catalogue, responsive), each at three viewport widths. Gate: no missing comparable elements and 90th-percentile box drift at most 24 CSS pixels.
- Anonymous text fragments are preserved as widgets but excluded from element-box metrics because a text range and a block widget do not have comparable widths. Unsupported/dropped content still needs the separate capture warnings.
- PHP 7.4 and 8.3: importer globals, fonts, bounded native widths, responsive resets and optional product marker.
- Browser UI check covers layout report rendering and toggling optional product tools via the preview API on desktop and mobile.

## Still needs work / delivery acceptance

- Controlled fixtures do not establish broad public-site fidelity. Complex Shopify themes, layered gradients, pseudo-elements, sliders, sticky states, interactions and breakpoint-specific content can still differ.
- Complete WordPress admin ZIP upload, actual imported frontend appearance and interactive Elementor editing for this release remain unverified.
- Forms, search backed by a real catalogue, inventory, cart, checkout and payments require a connected backend. Source links are retained; multi-page destination remapping is not automated.
- Email login awaits its provider connection. Existing private password access remains active. No real paid AI provider call is tested in this pass.
- Source fonts/images can remain dependent on external hosts and export budgets. Review the media report.

Use the initial report to find repair work, then compare and verify the imported draft before client delivery. This is an improved editable conversion draft workflow; it is not a guaranteed finished clone of any URL.

## Final live check

The Morris Travel Co. Hostinger reference returned a browser capture in 56.1 seconds, 381 native elements, native JSON HTTP 200 and a one-page ZIP HTTP 200 with the importer. The measured initial layout still fails the controlled 24px tolerance: desktop/tablet/mobile p90 drift was 181/159/228px; one comparable element was missing/hidden in each device. This result is explicitly NEEDS REVIEW, not finished-output acceptance. Actual WordPress visual/editor acceptance is also pending. Source viewport mismatch and nonzero-scroll warnings were absent after the final fixes.
