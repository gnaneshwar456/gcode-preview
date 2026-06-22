# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



## [0.3.0] - 2026-06-22

### Added
- **Go-to-layer field**: numeric input next to the layer sliders that jumps directly to a typed layer number (Enter or button).
- **Playback speed control**: log-scaled `play-speed-slider` paired with a precise `play-speed-input` (layers/sec). Updates the running animation live without rewriting the field mid-keystroke.
- **Travel isolation toggle** (`toggle-travel-current-layer`): restricts rendered travel moves to only the currently displayed (top) layer, for spotting travel moves that cross through previously-printed geometry. Disabled/dimmed automatically when the master "Travel moves" toggle is off.
- **Move scrubber** (`layer-move-slider`): steps through individual commands (print/travel) of the top layer in gcode order, independent of the Start/End layer range. Live caption (`move-value-label`, `move-detail-label`) shows move index, move type, and XYZ coordinates.
- **Nozzle position marker**: cone mesh added to the scene during move-scrubbing, tip pinpointing the exact nozzle coordinate. Fixed tip-down orientation (not direction-of-travel-dependent) for consistent readability.
- `CHANGELOG-FOR-HUMANS.md`: plain-English companion to this changelog, organized by the same version numbers.

### Changed
- `src/webview/ui.ts`: substantial rework — speed control, move scrubber, and travel-isolation state wiring; goto/speed number fields no longer fight in-progress typing.
- `src/webview/renderer.ts`: `renderGCode` now accepts `travelCurrentLayerOnly` and `layerMoveIndex` params; the top layer can be partially rendered up to a given move index, and tracks a dirty-check cache to avoid unnecessary rebuilds.
- `src/extension.ts`: webview HTML/CSS reorganized — new playback-speed and move-scrubber panels; removed native number-input spinner styling.
- `src/webview/main.ts`: state now tracks `travelCurrentLayerOnly` and `layerMoveIndex`, threaded through every `renderGCode` call site.

## [0.2.0] - 2026-03-29

### Added
- **Print Recovery Tool**: new `recoverGCode` command that crops a GCode file at a user-selected layer and injects a safe recovery block (purge sequence + lift → XY → descend re-positioning) to allow resuming an interrupted print.
- `src/parser/recovery.ts`: dedicated module implementing the four-phase recovery pipeline (header extraction → setup block filtering → print body crop → recovery block injection).
- `src/parser/parserUtils.ts`: shared parsing utilities (`parseLine`, `isExtrudingMove`, `parseLayerComment`, `MOTION_COMMANDS`) extracted from `parser.ts` and reused by `recovery.ts`.
- **Dual Layer Range Slider**: the viewer panel now exposes independent Start and End layer sliders, letting users isolate any subset of layers for inspection.
- Z-height readouts (`layer-z-start`, `layer-z`) display the exact Z position of the selected start and end layers.
- `gcodePreview.recoveryPurgeGCode` setting: configurable GCode commands injected as the purge sequence before resuming a recovered print (default: `G1 E10 F300`).
- `.editorconfig`: enforces consistent indentation, charset, and line-ending rules across all editors and operating systems.
- `gcode_movement_extrusion.md`: internal reference document describing motion and extrusion command conventions used by the parser.

### Changed
- Refactored `src/parser/parser.ts` to delegate shared logic to `parserUtils.ts`, reducing code duplication with the recovery module.
- Refactored `src/webview/ui.ts`: replaced the single `layer-slider` with `layer-slider-start` / `layer-slider-end` dual sliders; added recovery layer display and Z-height readout elements.
- Refactored `src/webview/main.ts`: updated event handling for the dual-slider controls and new display elements.
- Refactored `src/extension.ts`: wired up the `recoverGCode` command and exposes active preview session context so the recovery module can identify the correct source GCode file.
- Minor cleanups in `src/webview/renderer.ts` and `src/webview/scene.ts` aligned with updated scene and UI initialization.

## [0.1.0] - 2026-03-21

### Added
- Real-time 3D simulation of GCode files within VSCode Webview.
- Advanced rendering using Three.js `InstancedMesh` for 3D extrusion tubes with shadow and depth.
- `G0` / `G1` generic parsing with exact z-height layer separation.
- Support for absolute (`G90`) and relative (`G91`) axes positioning.
- Support for relative (`M83`) and absolute (`M82`) extruder coordinates.
- User customization settings in VSCode for Bed Size, Theme (dark/light), and Print Color.
- Automatic live re-render when the original GCode file is modified in the active editor.
- Strict security boundaries for Webviews with CSP nonces.
