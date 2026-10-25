# SaaS upgrade acceptance plan

The target is a reliable editable-site conversion product. Market leadership is not established by feature count or a small set of internal tests.

## Delivered in 0.4.12

- Bounded worker admission, short FIFO waiting queue, overload messages.
- Cancellation through browser, network and AI request stages; completed batch drafts retained.
- Bounded source-asset concurrency and cached response bytes.
- Stream heartbeat and deadline.
- Content delivery checklist in the app and exported report.
- Controlled burst, cancellation and route integration tests.

## Delivered in 0.4.13

Recognised search inputs are editable Studio Site Search widgets backed by local WordPress search. Source-form conversion and store-specific search/filter integrations remain pending.

## Delivered in 0.4.14

Manually added native contact widget with editable labels, required Name/Email/Message validation and private administrator-only WordPress inbox. Basic nonce/honeypot/per-address throttling and inline success/error states tested. Source forms are not automatically mapped; arbitrary field builders, email delivery, advanced abuse prevention and automatic data retention remain pending.

## Required before a public multi-customer launch

| Area | Required implementation | Acceptance evidence |
| --- | --- | --- |
| Capture quality | Fix residual source text/line-box, pseudo-element, icon and responsive drift | A licensed/authorized reference set covering stores, agencies, blogs and portfolios; browser and real Elementor screenshots at all three breakpoints |
| Forms and search | Native editable fields, validation, spam protection and explicit backend mapping | A test submission reaches the selected destination; errors and empty states work; no captured secrets or customer values |
| Commerce | WooCommerce product mapping, categories, variants, stock, cart and checkout | Staging purchase and refund tests using test payments; screenshots alone do not count |
| Shared site structure | Reusable header/footer and linked navigation with target-site URL rewriting | Multi-page import and subsequent shared-component edit |
| Editor | Searchable layers, dependable undo/redo, reusable components and accessibility review | Keyboard and mobile interaction checks, editing/export round trips |
| Jobs and capacity | Durable queue, tenant quotas, idempotency, worker leases, restart recovery and stored job status | Worker-kill recovery, duplicate-paid-request prevention, measured concurrency and memory tests |
| Customer accounts | Tenant isolation, cloud project storage, roles and quotas | Cross-account denial tests and restore/export/delete workflows |
| Operations | Error telemetry, failure-rate dashboards, retention and backups | Restore drill and fault-injection tests |
| Billing | Plan entitlements, usage ledger and webhook verification | Test-mode lifecycle and retry/idempotency tests |

## Current boundaries

The service still uses private-owner access. Local draft storage and per-worker admission do not constitute a multi-tenant SaaS. No new paid services or payment accounts were provisioned. An arbitrary source website's private commerce or form backend cannot be cloned from its visible page.

## Comparative evaluation

Use the same authorized source pages, fonts, viewport sizes and destination Elementor installation for each candidate. Record geometry drift, missing content, interaction completion, editability after import, elapsed time, memory and cost. Publish the measured results before claiming superiority.

References reviewed:
- https://softlite.io/docs/clonewebx/requirements/
- https://elementor.com/help/import-and-export-elementor-website-templates/
