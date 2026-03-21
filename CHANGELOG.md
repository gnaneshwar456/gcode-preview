# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
