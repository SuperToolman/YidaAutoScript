# Services layout

The project treats `services` as the boundary for reusable behavior. Page and component files should import services instead of reaching into implementation-specific helper folders.

- `ScriptService.js`: userscript bootstrap and global runtime initialization.
- `InterfaceService.js`: Yida HTTP API adapter. Keep raw endpoint calls here.
- `ProcessService.js`: workflow and migration orchestration built on top of `InterfaceService`.
- `FormFillService.js`: DOM automation for integration automation rule filling.
- `shared/`: browser utilities, runtime state, and injected style/icon configuration.
- `ui/`: React mounting and editor UI integration helpers.
- `schema/`: schema, payload, and template-code conversion logic.
- `datasource/`: data-source selection and field-panel helpers.
- `dataset/`: dataset export metadata enrichment.

When adding a feature, prefer keeping direct network calls in `InterfaceService`, cross-step business flows in a domain service, and DOM-only helpers in the service folder that owns that page behavior.
