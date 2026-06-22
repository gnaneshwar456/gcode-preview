# What's New (Plain English)

Same updates as `CHANGELOG.md`, just without the code-speak. The version
numbers match up — if a line here makes you go "wait, how?", look up the
same version number in `CHANGELOG.md` for the technical specifics.

---

## v0.3.0 — Move-by-move inspection tools

- **Go to layer** — type a layer number, jump straight there.
- **Speed control** — drag a slider or type an exact number to set how fast the Play animation runs.
- **"This layer only" (travel)** — only show the nozzle's non-printing moves for the layer you're on, so you can catch it clipping through earlier layers.
- **Move scrubber** — step through a single layer one move at a time, not just whole layers at once.
- **Position marker** — a sharp red pin shows exactly where the nozzle is at each step, so you can tell if it's touching material or punching through it.

## v0.2.0 — Recovery + layer range

- **Crop & Recover** — pick a layer, get a new file that resumes the print from there instead of starting over.
- **Start / End sliders** — view just a slice of the print, not only "from the bed up."
- **Z height readout** — see the exact height (mm) of whichever layer you're looking at.

## v0.1.0 — First release

- Real-time 3D preview of your GCode, right inside VS Code.
- Smooth rendering of the print path, layer by layer.
- Works with both absolute and relative positioning GCode.
- Customize bed size, color, and light/dark theme in settings.
- Auto-refreshes the preview when you edit the GCode file.