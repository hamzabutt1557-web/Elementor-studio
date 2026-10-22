# 0.4.9 — editing and import reliability update

- Added a searchable, nested Layers panel to the live editor. Select parent/child elements from the layer tree, collapse sections, and hide/show an element at the selected viewport. Existing direct text editing, drag/reorder, resize, alignment, spacing controls and native Elementor export remain available.
- The WordPress importer now clears Elementor's generated CSS cache after saving each imported page so Elementor rebuilds stylesheet output from the imported native widget settings.
- Form controls remain labelled visual placeholders because native form submission requires a WordPress form integration. The importer does not create nonfunctional submit forms or claim that submissions work.
- Automated verification: 80 tests passed, TypeScript passed, and the production Next.js build passed. The isolated PHP cache-hook test was added but could not be run here because PHP is not installed in this environment.
- Full import and visual acceptance on the user's WordPress site still requires testing that site's Elementor/theme combination.
