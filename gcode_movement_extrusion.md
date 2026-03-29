# G-code Movement and Extrusion Commands

## Movement Commands (X, Y, Z Axes)

| Code | Description | Example |
|------|-------------|---------|
| **G0** | Rapid movement (no cutting/extrusion) | `G0 X10 Y20` |
| **G1** | Controlled linear movement (with feedrate F) | `G1 X10 Y20 F300` |
| **G2** | Clockwise circular interpolation | `G2 X10 Y10 I5 J0` |
| **G3** | Counter-clockwise circular interpolation | `G3 X10 Y10 I5 J0` |

*Notes:*
- I and J parameters define the relative center offset for arcs (G2/G3)
- Feedrate (F) is specified in units per minute (typically mm/min)

## Extrusion Commands (E Axis - 3D Printing Specific)

| Code | Description | Example |
|------|-------------|---------|
| **E** | Extrusion amount (filament length to push) | `G1 X10 Y10 E2.0` |
| **G92 E0** | Reset extruder position (sets E=0 at current position) | `G92 E0` |
| **M221 S<percent>** | Set flow rate override | `M221 S95` (95% flow) |

*Important Notes:*
- In traditional CNC machining, there is no E-axis (extrusion) - only movement codes (G0/G1/G2/G3) are used for cutting tool motion.
- In 3D printing, the E-axis controls extrusion, and movement commands (G1/G2/G3) are combined with E values to deposit material during motion.
- Feedrate (F) affects both movement speed and extrusion rate (lower F = more material deposited per mm traveled).