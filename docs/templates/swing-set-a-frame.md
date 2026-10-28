# Template: two-swing A-frame swing set

Status: Draft v0.1, for review before implementation

This is the geometry spec for the first template (`PRODUCT.md`, First template). The template code in `packages/core/src/templates/swing-set-a-frame/` implements exactly what is written here, and its tests use the worked example below. Structural checks (M2) and hangers and site layout (a later M1 change) build on it.

## Design covered by template version 1

- A top beam resting on two A-frames, one near each end.
- **Joinery A (legs meet at the top):** each leg's top has a plumb cut, where the two legs of a frame butt together on the frame's centerline, and a level cut (the seat) that the beam rests on. A gusset on each face of the frame ties the two legs together across the joint.
- **One crossbar per A-frame**, horizontal, fastened to the outside face of the legs (the face away from the swings), with its ends cut flush with the legs' outer edges.
- **Level foot cuts.** Each foot is cut level to sit on a level pad or footing, even on a slope.
- **Ground can slope** front to back, along the beam, or both. The beam stays level and each A-frame stays plumb, so legs on the downhill side are longer.

Not covered in version 1: metal A-frame brackets, crossed (X) legs, corner braces, and the connection that holds the beam down onto the seats. That connection goes on the confirmation checklist (`DOMAIN.md`, Checklist only) until a later version models it.

## Coordinates

- **x** runs along the beam, from the left end (x = 0) to the right end (x = L), looking at the swings from the front.
- **y** runs front to back. The beam's centerline is y = 0; the front (where the swings swing toward the viewer) is negative y.
- **z** is up. z = 0 is the ground directly under the middle of the beam (x = L/2, y = 0).
- Lengths in decimal inches, angles in degrees (`DOMAIN.md`, Units).

## Parameters

| Parameter | Symbol | Meaning |
|---|---|---|
| Beam length | L | Overall length of the beam |
| Beam height | H | Height of the underside of the beam above z = 0. This is the pivot height the hangers hang from. |
| Splay | α | Angle of each leg from vertical. Can be entered as an angle, or as a footprint depth (the plan-view distance between the outer edges of the front and back feet), from which α is solved. |
| Beam stock | bw × bd | Actual width (horizontal) and depth (vertical); the beam stands on edge |
| Leg stock | w × t | Actual dimensions; w (the larger) lies in the plane of the A-frame, t is the leg's thickness along the beam |
| Crossbar stock | cw × ct | cw is the crossbar's vertical depth, ct its thickness along the beam |
| Crossbar height | zc | Height of the crossbar's top edge above z = 0 |
| Gusset | gh, gt | Gusset height below the seat, and thickness (for example 3/4" exterior plywood) |
| Frame inset | e | Distance from each beam end to the outside face of that frame's legs |
| Ground slope | front drop, right drop | Inches the ground falls per foot of horizontal distance toward the front, and toward the right end. Either can be zero or negative. |

The ground is the plane z_g(x, y) = −(front drop / 12)·y − (right drop / 12)·(x − L/2), so moving toward the front (negative y) lowers the ground when front drop is positive.

## Derived geometry

Each A-frame is symmetric about y = 0 above the ground, so these formulas are given for the back leg (positive y). The front leg is the mirror image, except at the foot, where its own ground height applies.

### Top of the leg (joinery A)

The leg's outer edge passes through the seat's outer corner B = (bw/2, H). The seat runs from A = (0, H) to B, so each leg carries half the beam's width.

- **Seat (level cut) width:** bw/2.
- **Plumb cut height:** h_p = (w − (bw/2)·cos α) / sin α, from A down to C = (0, H − h_p).
- Valid only when w / cos α > bw/2 (the leg is wide enough to reach the centerline under the beam); otherwise validation rejects the combination.

### Foot

The leg's centerline passes through Q = (bw/2 − (w/2)·cos α, H − (w/2)·sin α) and runs downward along (sin α, −cos α). The foot's level cut is at the height z_f where the centerline meets the ground plane at that frame's x position (the middle of the leg's thickness). For the back leg with ground slope k = front drop / 12 and no side slope:

- s = (Q_z − k·Q_y) / (cos α + k·sin α), z_f = Q_z − s·cos α.
- For the front leg, replace k with −k. With a side slope, k picks up the side term at that frame's x.
- Outer edge at the foot: y_o = bw/2 + (H − z_f)·tan α. Inner edge: y_i = y_o − w / cos α.

### Leg length

- **Outer edge, seat to foot (B to D):** (H − z_f) / cos α. This is the measurement to mark along the outer edge.
- **Overall length (stock needed):** (H − z_f) / cos α + (bw/2)·sin α, because the seat's inner corner A sits that much farther up the board than B.

### Cut settings (miter-saw convention, `DOMAIN.md`)

| Cut | Setting | Angle to the edge |
|---|---|---|
| Seat (level) | α | 90° − α |
| Plumb | 90° − α | α |
| Foot (level) | α | 90° − α |
| Crossbar ends | α | 90° − α |
| Gusset sides | α | 90° − α |

The plumb cut is usually beyond a miter saw's range; the method step (M6) handles how to make it.

### Crossbar

Horizontal, ends flush with the legs' outer edges.

- Top edge length: bw + 2·(H − zc)·tan α.
- Bottom edge length (overall, stock needed): bw + 2·(H − zc + cw)·tan α.

### Gusset

A trapezoid with its top edge at the seat (z = H) and its sides flush with the legs' outer edges.

- Top width: bw. Bottom width: bw + 2·gh·tan α. Height: gh.
- Must extend below the plumb joint: gh > h_p.

### Positions along the beam

- Left frame legs occupy x from e to e + t; right frame legs from L − e − t to L − e.
- Outside gusset and crossbar sit on the outside face (x < e on the left frame), inside gusset on the inside face.
- Frame centerlines (the supports for the structural checks) are at x = e + t/2 and L − e − t/2.

## Validation

Rejected combinations, each with a message saying which values conflict:

- w / cos α ≤ bw/2 (the legs can't reach under the beam's centerline).
- gh ≤ h_p (the gusset doesn't cover the plumb joint).
- The crossbar overlaps the gusset (zc > H − gh) or sits below the highest foot.
- A foot height z_f at or above H (slope too steep for the frame).
- 2·(e + t + gt) ≥ L (the frames don't fit on the beam).
- Any length, stock dimension, or angle outside its range in the parameter schema.

## Worked example (hand-checked)

Inputs: L = 120, H = 96, α = 20°, beam 4x6 on edge (bw = 3.5, bd = 5.5), legs 2x6 (w = 5.5, t = 1.5), crossbar 2x6 (cw = 5.5) at zc = 40, gusset gh = 24, e = 6, front drop 1" per foot, right drop 0.

| Quantity | Value |
|---|---|
| sin α, cos α, tan α | 0.34202, 0.93969, 0.36397 |
| Seat width | 1.75 |
| Plumb cut height h_p | (5.5 − 1.75·0.93969) / 0.34202 = 11.273 |
| Q | (−0.8342, 95.0594) |
| Back (uphill) foot height z_f | s = (95.0594 + 0.0695) / (0.93969 + 0.02850) = 98.255; z_f = 95.0594 − 98.255·0.93969 = 2.731 |
| Back leg outer edge, seat to foot | (96 − 2.731) / 0.93969 = 99.255 |
| Back leg overall length | 99.255 + 1.75·0.34202 = 99.853 (99-7/8") |
| Front (downhill) foot height z_f | −2.902 |
| Front leg outer edge, seat to foot | 105.249 |
| Front leg overall length | 105.848 (105-7/8") |
| Footprint (outer edge of back foot to outer edge of front foot, plan view) | 35.697 + 37.747 = 73.445 |
| Crossbar top edge, bottom edge | 44.265, 48.268 |
| Gusset top, bottom, height | 3.5, 20.971, 24 |
| Cut settings | Seat, foot, crossbar, and gusset sides 20.0°; plumb 70.0° |

Tests compare template output with these values to within 0.001 inch and 0.01°.

## Open questions

- **Which way the slope runs.** The model handles slope front to back, along the beam, or both. The owner described the front legs as downhill and the frame as not perpendicular to the hill, which suggests some slope along the beam too. Measured drops for the actual site are needed before the plans are final.
- **Beam hold-down.** How the beam is fastened to the seats (for example through the gussets with a top cleat, or with straps) is not modeled in version 1 and goes on the confirmation checklist.
