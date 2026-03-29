# GCode Preview for VSCode

A professional, high-performance real-time 3D GCode visualization extension for Visual Studio Code, powered by **Three.js**.

![GCode Preview Demo](media/recorder.gif)

## Features

- **Real-Time 3D Rendering**: True 3D tube geometry (using InstancedMesh) showing depth, volume, and shading. Far superior to basic flat line renders.
- **Accurate Layer Analysis**: Correctly separates toolpaths into discrete layers, even ignoring complex `Z-Hops`. Supports explicit slicer layer markers (`;LAYER:N`).
- **Dual Layer Range Slider**: Independently control the start and end layer to isolate any slice of the print for inspection.
- **Print Recovery Tool**: Generate a resumable GCode file from an interrupted print — select the recovery layer with the slider, click **Recover**, and save a cropped file with a safe purge and re-positioning sequence injected automatically.
- **Live Reload**: Edit your `.gcode` script manually and watch the 3D model update seamlessly on the fly.
- **Support for Slicer Standards**: Out of the box support for absolute (`G90`) / relative (`G91`) positioning, and extruder modes (`M82` / `M83`).
- **Webview Architecture**: Zero native binaries required. Everything runs blazingly fast in the native VSCode Webview.
- **Adjustable Aesthetics**: Simulate the bed of your exact printer directly from VSCode Settings (e.g., Bed size, Base Theme, Extrusion Color).

## Usage

### Previewing a GCode File

1. Open any `.gcode` file.
2. Click the **"Open GCode Preview"** button located at the top right of your Editor Title bar (the Eye/Preview icon).
3. Alternatively, open the VSCode Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and type `GCode Viewer: Open Preview`.

### Recovering an Interrupted Print

1. Open the GCode file for the failed print and open its 3D preview.
2. Use the **Start Layer** slider to select the layer where you want to resume printing.
3. Click the **Recover** button in the panel.
4. A new `.recovered.gcode` file will be saved next to the original.
5. The recovery file contains the original startup/setup sequence (with Z-movement stripped to preserve your manually set Z-offset), followed by a purge sequence and safe XY re-positioning block, and then the print body from your chosen layer onward.

## Configuration Options

This extension contributes the following variables to your VSCode settings:

| Setting | Type | Default | Description |
|---|---|---|---|
| `gcodePreview.bedSize` | `number` | `220` | Size of the print bed in mm (X and Y). |
| `gcodePreview.theme` | `string` | `"dark"` | Background theme of the 3D viewer (`dark` or `light`). |
| `gcodePreview.extrusionColor` | `string` | `"#ff7a00"` | Hex color for printed extrusion lines. |
| `gcodePreview.recoveryPurgeGCode` | `string` | `"G1 E10 F300\n"` | GCode commands executed for purging filament before resuming a recovered print. |

## Security and Performance

GCode Preview is heavily optimized out-of-the-box. We leverage raw WebGL arrays (`InstancedMesh`) to minimize Draw Calls, completely preventing memory leaks with garbage-collected buffers. Strict Content Security Policy (CSP) is implemented to keep your VSCode workspace rock solid.

## Issues and Feedback

If you find a bug or have a suggestion, please open an issue in the [repository](https://github.com/GleisonPauloC/gcode-preview/issues).

---

**Enjoy your prints!**
