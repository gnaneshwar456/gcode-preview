## About This Fork

I'm not a professional developer — I'm a mechanical engineering
student building a 5-axis non-planar FDM printer, and I started
customizing this extension today (June 2026) to better understand the
G-code my own non-planar slicer produces. I'm vibecoding this with
Claude since I'm a complete beginner to programming, learning as I go.

I'll keep adding to and changing this fork over the next few months as I
run into things I need while working on my slicer. That's also why this
repo includes `CHANGELOG-FOR-HUMANS.md` (for a noob like me) alongside the regular `CHANGELOG.md` in plain-English notes for anyone who just wants to understand this fork without reading code.

If you run into something or want to talk shop, open an issue, happy to
chat.

All credit for the original extension goes to [Gleison Paulo Caldeira
Oliveira](https://github.com/GleisonPauloC), this is a personal fork
built on top of his excellent work.

# GCode Preview for VSCode

A professional, high-performance real-time 3D GCode visualization extension for Visual Studio Code, powered by **Three.js**.

## Current Features in addition to original features
These are the complete features of this tool at this point including original ones by [Gleison Paulo Caldeira
Oliveira](https://github.com/GleisonPauloC), this section will be updated after any new changes. Check `CHANGELOG.md` for complete tracking. 

- **Real-Time 3D Rendering**: True 3D tube geometry (using InstancedMesh) showing depth, volume, and shading. Far superior to basic flat line renders.
- **Accurate Layer Analysis**: Correctly separates toolpaths into discrete layers, even ignoring complex `Z-Hops`. Supports explicit slicer layer markers (`;LAYER:N`).
- **Dual Layer Range Slider**: Independently control the start and end layer to isolate any slice of the print for inspection, plus a **Go to** field to jump straight to a specific layer number.
- **Move-by-Move Scrubber**: Step through a single layer one toolpath move at a time, with a live caption showing move type and exact XYZ coordinates, and a marker pinpointing the nozzle's precise position — built for catching travel moves that clip through earlier layers on non-planar prints.
- **Travel Move Isolation**: Toggle to show only the current layer's travel (non-printing) moves, instead of every travel move across the visible range.
- **Adjustable Playback Speed**: Control how fast the layer-by-layer animation plays, with both a quick slider and a precise numeric input (layers/sec).
- **Print Recovery Tool**: Generate a resumable GCode file from an interrupted print — select the recovery layer with the slider, click **Recover**, and save a cropped file with a safe purge and re-positioning sequence injected automatically.
- **Live Reload**: Edit your `.gcode` script manually and watch the 3D model update seamlessly on the fly.
- **Support for Slicer Standards**: Out of the box support for absolute (`G90`) / relative (`G91`) positioning, and extruder modes (`M82` / `M83`).
- **Webview Architecture**: Zero native binaries required. Everything runs blazingly fast in the native VSCode Webview.
- **Adjustable Aesthetics**: Simulate the bed of your exact printer directly from VSCode Settings (e.g., Bed size, Base Theme, Extrusion Color).

## Usage

### Inspecting a Layer Move-by-Move

1. Open the GCode preview and use the **Start/End** sliders (or the **Go to** field) to bring the layer you want to inspect to the top.
2. Drag the **Move** slider under "Current Layer — Move Scrubber" to step through that layer's toolpath one move at a time.
3. Watch the red pin marker in the 3D view — its sharp tip sits at the nozzle's exact position for whichever move you're on, so you can tell at a glance whether it's touching existing geometry or actually plunging into it.
4. Toggle **Travel moves → This layer only** to isolate just the current layer's rapid (non-printing) moves, useful for catching ones that clip through earlier layers on non-planar prints.
5. Use **Play** with the **Speed** control to animate through layers automatically once you're done inspecting the details.

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

If you find a bug or have a suggestion, please open an issue in the [original repository](https://github.com/GleisonPauloC/gcode-preview/issues) or mine .

---

**Enjoy your prints!**
