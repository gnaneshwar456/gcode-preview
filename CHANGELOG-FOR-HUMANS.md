# What's New (Plain English Version)

This file explains the same updates as `CHANGELOG.md`, but without the
code-speak. If you just want to *use* the extension and don't care about
file names or function names, read this one instead.

---

## Resume a print that failed partway through

If your print fails or gets interrupted, you used to have to start the
whole thing over from scratch. Now there's a **"Crop & Recover"** button.
Pick the layer where things went wrong, click it, and it generates a new
GCode file that picks up from that layer — with a safe purge-and-reposition
sequence built in so the nozzle doesn't just crash into your part.

## Look at just a slice of your print

There are two sliders now instead of one: **Start** and **End**. This lets
you hide everything below a certain layer and everything above another,
so you can inspect just the middle section of a tall print instead of
always seeing it build up from the bed.

Right next to the sliders, you'll see the exact **Z height** (in mm) of
whichever layer each slider is sitting on.

## Jump straight to a layer by typing the number

Instead of dragging the slider all the way across a 2000-layer print,
there's now a **"Go to"** box. Type the layer number, hit Enter, and it
jumps straight there.

## Control how fast the playback animates

Hitting "Play" steps through your layers automatically, like a flipbook.
Now you can control exactly how fast that happens — drag the **Speed**
slider for a quick adjustment, or type an exact number (like "23.5") if
you want precise control, e.g. for recording a smooth timelapse-style
video of the print building up.

## See only this layer's travel moves

"Travel moves" are the move the nozzle makes when it's *not* printing —
just repositioning. Normally you see every travel move stacked up across
all visible layers, which gets messy. Flip on **"This layer only"** (under
the Travel moves toggle) and you'll see *just* the travel moves that
belong to the layer you're currently looking at. This is especially handy
on non-planar prints, where you want to double check a rapid move isn't
clipping through a wall it shouldn't be near.

## Scrub through a single layer move-by-move

This is the big one if you're debugging a tricky layer. Instead of only
being able to jump between whole layers, there's now a **"Move"** slider
that steps through a layer one toolpath move at a time — every individual
line the nozzle draws, in the exact order it happens.

As you drag it, a small **red pin marker** shows up in the 3D view at the
nozzle's exact position for that step, with its sharp tip marking the
precise spot. This makes it much easier to tell whether the nozzle is
genuinely passing through previously-printed material (a problem) or just
sitting right at the surface (fine) — something that's nearly impossible
to judge from the path lines alone.

Underneath the slider, a small caption tells you exactly what's happening
at that step — whether it's printing or traveling, and the X/Y/Z
coordinates — so you don't have to guess from the picture alone.

---

### TL;DR — what can you actually do now that you couldn't before?

- Recover a failed print instead of starting over
- Look at only part of a print, not just "from the bottom up"
- Jump to any layer instantly by typing its number
- Control exactly how fast the layer-by-layer playback runs
- See just one layer's travel moves, to catch the nozzle clipping through earlier layers
- Step through a single layer one move at a time, with a marker showing exactly where the nozzle is
