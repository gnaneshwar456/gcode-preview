# GCode Preview for VSCode

A professional, high-performance real-time 3D GCode visualization extension for Visual Studio Code, powered by **Three.js**.

![GCode Preview Demo](media/recorder.gif)

## Features

- **Real-Time 3D Rendering**: True 3D tube geometry (using InstancedMesh) showing depth, volume, and shading. Far superior to basic flat line renders.
- **Accurate Layer Analysis**: Correctly separates toolpaths into discrete layers, even ignoring complex `Z-Hops`.
- **Live Reload**: Edit your `.gcode` script manually and watch the 3D model update seamlessly on the fly.
- **Support for Slicer Standards**: Out of the box support for absolute (`G90`) / relative (`G91`) positioning, and extruder modes (`M82` / `M83`).
- **Webview Architecture**: Zero native binaries required. Everything runs blazingly fast in the native VSCode Webview.
- **Adjustable Aesthetics**: Simulate the bed of your exact printer directly from VSCode Settings (e.g., Bed size, Base Theme, Extrusion Color).

## Usage

1. Open any `.gcode` file.
2. Click the **"Open GCode Preview"** button located at the top right of your Editor Title bar (the Eye/Preview icon).
3. Alternatively, open the VSCode Command Palette (`Ctrl+Shift+P` ou `Cmd+Shift+P`) and type `GCode Viewer: Open Preview`.

## Configuration Options

This extension contributes the following variables to your VSCode settings:
- `gcodePreview.bedSize`: Default bed size in mm (e.g. `220`).
- `gcodePreview.theme`: Set to `dark` or `light` background style.
- `gcodePreview.extrusionColor`: The hex color for printed lines (e.g. `#ff7a00`).

## Security and Performance

GCode Preview is heavily optimized out-of-the-box. We leverage raw WebGL arrays (`InstancedMesh`) to minimize Draw Calls, completely preventing memory leaks with garbage-collected buffers. Strict Content Security Policy (CSP) is implemented to keep your VSCode workspace rock solid.

## Issues and Feedback

If you find a bug or have a suggestion, please open an issue in the [repository](https://github.com/GleisonPauloC/gcode-preview/issues).

---

**Enjoy your prints!**
