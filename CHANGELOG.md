# Changelog

All notable changes to AzureGanttOps are documented in this file.

Note: Historical versions before `1.8.1` were reconstructed approximately from visible commit themes because the repository contains no release tags.

## [Unreleased]

### Added

- Failed Azure DevOps calls now produce structured terminal diagnostics with HTTP status, duration, request ID, sanitized Azure response, and a data-minimized JSON Patch context.
- The timeline context menu can change `Assigned To` to a person already used in the current query; the list is sorted by the number of assigned tasks.
- The visible application interface, dialogs, keyboard shortcut help, and in-app changelog are now consistently in English.
- The details panel is configurable: a gear button opens a field picker to show, hide and reorder any Azure DevOps field. Field widths adapt automatically to the field type and to the panel width, and the configuration is stored globally in the local user preferences.
- Story Points and other editable fields (numbers, single-line text, pick lists, Yes/No, Assigned To, HTML) can be edited directly in the details panel and are saved together in one Azure DevOps update.

### Changed

- The details panel shows all work item information in one field grid; the separate row list below the form was removed.
- Every configured details field is shown for every work item, regardless of its work item type, and every field is editable except Azure DevOps system fields (ID, Rev, created/changed metadata, Work Item Type, Dependencies). Newly editable: Start/End and other date fields, Area/Iteration Path, Tags, multi-line text and all person fields. Saved Start/End changes move the bar immediately.
- Rejected work item updates now show the Azure DevOps error message (with credentials redacted) instead of a generic failure code.

## [1.8.6] - 2026-07-10

### Changed

- `Include child items` in timeline filters now traverses the complete available child hierarchy recursively.

## [1.8.5] - 2026-07-10

### Added

- Timeline filters for tree queries can optionally include existing parents recursively and direct child items of hard-filtered matches; the selection appears to the right of the filters and is shared through URL parameters.

## [1.8.4] - 2026-06-28

### Added

- A keyboard icon next to the version number opens a compact overview of the most important timeline keyboard shortcuts in the shared header dialog.

## [1.8.3] - 2026-06-27

### Added

- Azure query refreshes check in the background whether a newer app version is available on GitHub.
- The version display shows a subtle exclamation mark when an update is available and opens the changelog with an update notice.
- A new local diagnostics endpoint, `GET /phase2/app-update-check`, provides the silent update check without HTTP caching.

### Changed

- The header now shows the changelog entry compactly as version number `v1.8.3` only.
- One-click startup now checks npm dependencies against `package.json` and `package-lock.json` so new packages are installed automatically after a pull.
- npm dependencies were updated so `npm audit` reports no known vulnerabilities.

## [1.8.2] - 2026-06-27

### Changed

- The changelog indicator in the header now opens the release notes in an accessible in-app dialog.
- The package version was increased to `1.8.2` for the changelog dialog improvement.

## [1.8.1] - 2026-06-26

### Added

- A visible changelog indicator in the header provides direct access to release notes.
- Central project metadata keeps the app version and changelog path consistent between the UI and local server.
- A read-only `GET /CHANGELOG.md` route serves Markdown with security headers and disabled HTTP caching.

### Changed

- The package version was explicitly set to `1.8.1`.

## [1.8.0] - 2026-06-26

### Added

- A first-run dialog connects an Azure DevOps query through its complete query URL.
- Local configuration can be reset from the status area.

### Changed

- The header status badge and theme switcher use a more compact layout.
- The initial query flow focuses more strongly on URL input.

## [1.7.0] - 2026-06-10

### Added

- PWA support with manifest, icons, and service worker.
- Improved guidance for expired Azure sessions.

### Changed

- Dependency writeback was corrected.
- Child work items inherit relevant fields such as assigned person, tags, and planning dates.
- Gantt target dates are set consistently to 17:00 locally.

## [1.6.0] - 2026-06-03

### Added

- Timeline filter groups and date-range filters.
- Work item context menus with keyboard operation and viewport constraints.
- Creation of child work items from the context menu with a restricted list of suitable planning types.
- Tree-level badges for visible query levels.

### Changed

- The child type menu remains stable across re-renders.
- The external Fontshare dependency was removed from the UI and CSP.

## [1.5.0] - 2026-05-27

### Added

- Optimistic duplication of work items.
- Performance logging for refresh paths.

### Changed

- Azure hydration was accelerated with greater concurrency and adjusted batch sizes.
- Duplicated work items inherit relevant system and planning fields.

## [1.4.0] - 2026-05-04

### Added

- A `Cmd+P` print view for the current Gantt snapshot.
- Automatic default field mapping on the first query run.
- Iteration-based date derivation for partially planned work items, including a notice in the details panel.

### Changed

- Node.js engine and lockfile declarations were clarified.
- Verbose logging configuration for Azure DevOps was corrected.

## [1.3.0] - 2026-04-21

### Added

- An edit mode that adopts planned dates per work item.
- Quarter and year zoom levels plus auto-scroll while dragging timeline bars.
- Warnings about unsaved timeline changes before refresh or tab close.

### Changed

- Iteration dates are loaded and cached through a dedicated port.
- Zoom and drag behavior were stabilized.

## [1.2.0] - 2026-04-13

### Added

- Tree and one-hop query support that preserves hierarchy and dependencies.
- Drag-and-drop reparenting.
- Improved dependency arrows and interactions.
- Saved queries can be opened directly in Azure DevOps from the header.

### Changed

- The query dropdown uses a denser visual layout and includes a link icon.

## [1.1.0] - 2026-03-19

### Added

- A local HTTP UI shell with one-click startup.
- Persistent timeline preferences for density, color coding, sidebar, details, labels, and viewport.
- Live-sync controls for timeline changes.
- Timeline sorting, field filters, selection highlighting, and overlay corrections.

### Changed

- The UI client and timeline interactions were modularized.
- Local server startup and build artifact checks were made more robust.

## [1.0.0] - 2026-03-09

### Added

- A query-driven Gantt foundation with Azure CLI preflight, Azure DevOps context, query execution, and work item hydration.
- Mapping validation, mapping persistence, and a canonical planning model.
- Timeline rendering with bars, unschedulable work items, dependency visualization, and trust/freshness states.
- A diagnostics tab, status surfaces, and structured runtime diagnostics.
- A read/write boundary with write operations initially disabled.

### Changed

- The phase 6 runtime, local UI, and quality gates were combined into an executable foundation.
