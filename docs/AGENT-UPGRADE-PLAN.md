# Elementor Studio: agent upgrade plan

Status: implementation specification, not a released feature.
Updated: 2026-10-21.

## Product decision

Build a personal, owner-only website-building agent within Elementor Studio.
Use MyClaw.ai as a reference for goal-driven work, persistent projects, visible
task progress, and a simple chat interface. Do not assume MyClaw's private code,
hosting, or API is available to embed.

The existing capture, editor, preview, and Elementor exporter become tools
available to the agent. Repair their fidelity defects before describing the
agent as a reliable replacement for manual site building.

The intended outcome is: give a reference URL or brief, supply branding/content,
review a working site, edit it, then export or publish. Arbitrary-site 100%
cloning is not an acceptance claim.

## First release scope

- Single owner account and existing access controls.
- Website URL and client brief as two project starting points.
- Text instructions, source assets, brand colors, and font preferences.
- Model/provider connection settings with server-side credential storage.
- Project history, saved files, build checkpoints, cancel, and resume.
- Agent-driven capture, implementation, validation, and bounded repair.
- Direct editing and Elementor export retained from the existing product.
- Shareable preview with explicit publication state.
- No billing, multi-tenant agent hosting, email automation, or messaging-channel
  integrations in the initial release. Those were not required for personal use.

## Workspace interface

Desktop:
- Left: projects and recent tasks.
- Center: chat, task status, concise action history, and requested input.
- Right: working preview and contextual editing tools.
- Top actions: New project, Preview, Compare, Share, Export.
- Settings in a side panel: appearance, model connections, budget, brand defaults.

Mobile:
- Switch between Chat, Preview, and Projects rather than squeezing three columns.
- Keep the active task and primary action visible.
- Use full-screen preview with device-width controls and a close action.

Comparison:
- Original, Output, Split, and Overlay views.
- Render both versions at the same virtual viewport width; scale the canvases to
  fit the panes. Do not compare a narrow desktop iframe to a full-width reference.
- Synchronized scroll, zoom, device presets, and per-region mismatch markers.
- Display the source capture time and output revision.
- If the original disallows embedding, use an explicitly labelled captured
  reference. Do not call a screenshot an interactive live original.
- Progress must come from actual job events, not simulated timers.

Editing:
- Double-click text to edit.
- Contextual text formatting, font selection, color hex input, and link editing.
- Direct image upload plus image URL.
- Alignment, spacing measurements, resize handles, and drag-and-drop.
- Preserve responsive constraints; free placement must not silently destroy
  mobile layout.
- Undo/redo and revision history.
- Agent changes must not overwrite newer manual edits.

## Execution flow

1. Create the project and persist its input revision.
2. Validate the source URL and fetch through the existing network safety layer.
3. Capture layout, assets, fonts, text, links, and supported interactive states.
4. Record unsupported features and any incomplete capture explicitly.
5. Build the editable representation and render an output preview.
6. Compare source and output at matching desktop, tablet, and mobile widths.
7. Repair identified differences within the server-enforced attempt/cost budget.
8. Return a reviewable result, including unresolved differences.
9. Apply requested edits to a new revision and rerun affected checks.
10. Generate the chosen export or publish the reviewed revision.

A successful browser render alone does not prove a correct Elementor import.

## Architecture

### Existing application

Retain the Next.js frontend, owner access, editor, and export endpoints after
restoring and reviewing the source. Do not replace the working app with an
unconnected demo.

### Agent coordinator

Expose narrow, typed tools: inspect source, capture page, read project files,
apply a patch, render preview, compare layout, validate export, and produce
artifacts. Keep permissions and credentials outside model-generated content.

OpenClaw is a candidate runtime behind an adapter, not an assumed drop-in fix.
Before adopting it, verify its tool integration, checkpoint behavior, isolation,
and operation cost against the existing app. Keep browser/capture and Elementor
conversion code reusable regardless of the selected runtime.

### Durable jobs

Use a durable database/job queue for project and job state, and object storage
for assets, capture evidence, previews, and export archives. Store source changes
in Git. Do not keep the only project copy in an ephemeral execution directory.

State transitions:
- queued -> running
- running -> waiting_for_input, completed, failed, or canceled
- waiting_for_input -> queued or canceled
- failed -> queued only through an explicit retry with the failure retained
- completed/canceled jobs are immutable; further work creates a new job/revision

Each step has an input revision, idempotency key, attempt count, execution lease,
heartbeat, and output artifact IDs. Mark a step complete only after its output
is durably stored. Recover an expired lease without repeating non-idempotent
external writes. A deployment retry must reconcile the prior deployment ID.

Closing a tab must not cancel a submitted server job. Resuming after a crash
must use the last valid persisted checkpoint, not claim a process kept running.

### Execution worker

Run browser and generated-code tasks in an isolated worker. Keep the UI/API
separate from long-running browser execution. Use bounded resources, timeouts,
concurrency, and explicit network rules. Capture fetched source content as data;
instructions found on a page must not override the task or tool permissions.

### Model connection and budget

Verify a provider connection before using it. Discover or validate model IDs
against the provider rather than hardcoding unverified names.
Enforce request/repair/cost limits on the server. Never accept a client-provided
budget as authority to spend without a configured server cap.
Keep API keys out of source, browser storage, logs, previews, and exports.
Expose failure and retry states clearly.

## Fidelity work required before agent integration is accepted

### Capture completeness

Unify capture, normalized design, export, and WordPress importer limits.
A practical tested target from the pending work is 3,000 design nodes, capture
depth 22, and validated design depth 24. Preserve explicit payload and execution
budgets. Stop with an actionable incomplete-capture result when limits are hit;
never silently drop the footer and report success.

### Media layout

Preserve image slots whose height comes from pseudo-elements or aspect-ratio
rules while their actual images are absolutely positioned. Retain measured
responsive geometry and verify intermediate widths. Keep image fit, crop, link,
and hover behavior where supported.

### Typography

Capture used custom font faces, resolve font URLs, preserve quoted family names
such as Jost*, and package allowed font assets with bounded downloads and binary
validation. The importer must remap packaged fonts to local upload URLs.
A missing font must be reported rather than silently called a visual match.

### Structure and interaction

Preserve semantic header/main/footer regions, rich text, linked cards, SVG,
responsive ordering, and container spacing. Forms, drawers, sort/filter controls,
and other interactive elements require explicit supported mappings or declared
fallbacks. Do not leave a label and submit button after silently dropping inputs.

A storefront's visual product grid is not a migrated commerce backend. Product
data, search, cart, checkout, and account behavior need separate integration and
acceptance tests when requested.

## Comparison and release gates

- Use identical virtual viewport widths and settled font/image loading.
- Compare header, product/content grid, and footer independently.
- Keep both pixel evidence and DOM geometry measurements; one score is not proof.
- Separate structural/layout failures from content and interaction failures.
- Declare thresholds before evaluating a release and retain failed measurements.
- Check desktop, tablet, mobile, and at least one intermediate width.
- Exercise hover, mobile navigation, and supported form/filter interactions.
- Import into real WordPress + Elementor and compare its frontend render.
- Verify the exported page remains editable, not merely a full-page screenshot.
- Run source tests, PHP compatibility checks, type checking, and the production build.
- Test the staged deployment and retain rollback information before production.
- Report unsupported behavior and unverified cases with the delivered version.

## Initial acceptance case

Reference: https://bls.uk.com/collections/panties

The earlier capture identified 48 product cards. A fresh reference capture must
record the current count rather than assume the live catalog never changes.

Required evidence:
- Header, all reference product cards, and footer are present on every viewport.
- Product media slots do not collapse.
- Captured fonts load or a specific missing-font warning is shown.
- Grid geometry and footer placement are compared after rendering.
- Native Elementor import is checked separately from the app preview.
- Source and output revision identifiers accompany the results.

## Implementation order

1. Restore the existing source into this repository without publishing secrets.
2. Recover/reapply the pending completeness, media, and typography fixes.
3. Complete real-page comparison and native Elementor validation.
4. Add durable projects, revisions, artifacts, and resumable job state.
5. Add the bounded agent coordinator around the proven tools.
6. Integrate chat, job events, and the split comparison/editor workspace.
7. Verify the end-to-end owner workflow and release with source and rollback data.

## Current recovery checkpoint

Verified during this session:
- The GitHub repository was empty before this document was added.
- The coding execution environment is unavailable.
- The saved archive record exists as elementor-studio-v0.4.8-source.zip, version 10,
  226,491 bytes, modified 2026-10-19.
- Archive materialization fails because its execution container is unavailable.

Previous-session findings, not fresh validation of a new release:
- The original 1,000-node capture budget dropped products and the footer.
- Enlarged capture produced all 48 cards and a footer, but geometry was still poor.
- Collapsed pseudo-element media slots and missing custom fonts were identified.
- Candidate fixes were written in the unavailable workspace.
- PHP 7.4 and 8.3 checks passed there.
- The final visual comparison, full updated checks, and deployment were not completed.

The v0.4.8 saved archive does NOT include those unpublished candidate fixes.
This document is a recovery and implementation plan, not a restored application.
Do not mark the new features shipped or the fidelity problems resolved from this
document alone.

## References

- MyClaw product reference: https://myclaw.ai/
- OpenClaw workspace: https://docs.openclaw.ai/concepts/agent-workspace
- OpenClaw sandboxing: https://docs.openclaw.ai/gateway/sandboxing
- OpenClaw tool permissions: https://docs.openclaw.ai/gateway/security/tool-permissions

Provider descriptions are references, not independent verification of their
uptime, performance, or marketing claims.
