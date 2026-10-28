# Template: two-swing A-frame swing set

Status: Draft v0.2, for review before implementation

This is the geometry spec for the first template (`PRODUCT.md`, First template). The template code in `packages/core/src/templates/swing-set-a-frame/` implements exactly what is written here, and its tests use the worked example below. Structural checks (M2) and hangers and site layout (a later M1 change) build on it.

## Design covered by template version 1

- A top beam resting on two A-frames, one near each end. The beam may overhang the frames.
- **Joinery A (legs meet at the top):** each leg's top has a plumb cut, where the two legs of a frame butt together on the frame's centerline, and a level cut (the seat) that the beam rests on. A gusset on each face of the frame ties the two legs together across the joint.
- **One crossbar per A-frame**, horizontal, fastened to the outside face of the legs (the face away from the swings), with its ends cut flush with the legs' outer edges.
- **Ground that slopes front to back.** The ground is level along the beam, so the beam is the same height above the ground everywhere. The front legs are downhill. The beam stays level and each A-frame stays plumb, so the front legs are longer.
- **Feet either buried or on pads.** A burial depth of 0 means each foot sits on a level pad or footing with ground anchors. A depth greater than 0 means each leg continues that far below grade. Either way, each foot gets a level cut.

Not covered in version 1: metal A-frame brackets, crossed (X) legs, corner braces, ground that slopes along the beam, and the connection that holds the beam down onto the seats. That connection goes on the confirmation checklist (`DOMAIN.md`, Checklist only) until a later version models it.

## Coordinates

- **x** runs along the beam, from the left end (x = 0) to the right end (x = L), looking at the swings from the front.
- **y** runs front to back. The beam's centerline is y = 0; the front (downhill, where the swings swing toward the viewer) is negative y.
- **z** is up. z = 0 is the ground directly under the beam (y = 0). Because the ground is level along the beam, this holds at every x.
- Lengths in decimal inches, angles in degrees (`DOMAIN.md`, Units).

## Parameters

| Parameter | Symbol | Meaning |
|---|---|---|
| Beam length | L | Overall length of the beam |
| Beam height | H | Height of the underside of the beam above the ground directly under it. This is the pivot height the hangers hang from. |
| Splay | α | Angle of each leg from vertical. Can be entered as an angle, or as a footprint depth (the plan-view distance between the outer edges of the front and back legs where they meet the ground), from which α is solved. |
| Beam stock | bw × bd | Actual width (horizontal) and depth (vertical); the beam stands on edge |
| Leg stock | w × t | Actual dimensions; w (the larger) lies in the plane of the A-frame, t is the leg's thickness along the beam |
| Crossbar stock | cw × ct | cw is the crossbar's vertical depth, ct its thickness along the beam |
| Crossbar height | zc | Height of the crossbar's top edge above z = 0 |
| Gusset | gh, gt | Gusset height below the seat, and thickness |
| Frame inset | e | Distance from each beam end to the outside face of that frame's legs |
| Ground slope | g | Inches the ground falls per foot of horizontal distance toward the front. 0 is level ground; negative means the front is uphill. |
| Burial depth | d | How far each leg extends below grade, measured vertically. 0 for pads. |

The ground is the line z_g(y) = k·y with k = g / 12, the same at every x.

## Derived geometry

Each A-frame is symmetric about y = 0 above the ground, so these formulas are given for the back leg (positive y). The front leg is the mirror image, except at the foot, where its own ground height applies: replace k with −k.

### Top of the leg (joinery A)

The leg's outer edge passes through the seat's outer corner B = (bw/2, H). The seat runs from A = (0, H) to B, so each leg carries half the beam's width.

- **Seat (level cut) width:** bw/2.
- **Plumb cut height:** h_p = (w − (bw/2)·cos α) / sin α, from A down to C = (0, H − h_p).
- Valid only when w / cos α > bw/2 (the leg is wide enough to reach the centerline under the beam); otherwise validation rejects the combination.

### Where the leg meets the ground

The leg's centerline passes through Q = (bw/2 − (w/2)·cos α, H − (w/2)·sin α) and runs downward along (sin α, −cos α). It meets the ground at height z_g:

- s = (Q_z − k·Q_y) / (cos α + k·sin α), z_g = Q_z − s·cos α.

### Foot

The foot's level cut is at z_b = z_g − d: at grade for pads, or d below grade for buried legs.

- Outer edge at the foot: y_o = bw/2 + (H − z_b)·tan α. Inner edge: y_i = y_o − w / cos α.
- Length of leg below grade, along the leg: d / cos α.

### Leg length

- **Outer edge, seat to foot (B to D):** (H − z_b) / cos α. This is the measurement to mark along the outer edge.
- **Overall length (stock needed):** (H − z_b) / cos α + (bw/2)·sin α, because the seat's inner corner A sits that much farther up the board than B.

### Footprint at grade

Where each leg's outer edge meets the ground: y = (bw/2 + H·tan α) / (1 + k·tan α) for the back leg, and the same with −k for the front leg. The footprint depth is the sum of the two distances from y = 0. This is the layout to mark on the ground, and the value solved against when splay is entered as a footprint.

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
- The crossbar overlaps the gusset (zc > H − gh), or its bottom edge is at or below grade at the back (uphill) leg.
- Ground so steep that a leg meets the ground at or above the seat.
- 2·(e + t + gt) ≥ L (the frames don't fit on the beam).
- Any length, stock dimension, or angle outside its range in the parameter schema.

## Flags

- Buried legs (d > 0): **expert check** on burial depth, and on lumber rated for ground contact, since decay is fastest at the ground line.
- Pads (d = 0): **expert check** on ground anchors (`DOMAIN.md`, Tipping and anchoring).

## Worked example (hand-checked)

Inputs: L = 120, H = 96, α = 20°, beam 4x6 on edge (bw = 3.5, bd = 5.5), legs 2x6 (w = 5.5, t = 1.5), crossbar 2x6 (cw = 5.5) at zc = 40, gusset gh = 24, e = 6, ground falling g = 1" per foot toward the front (k = 1/12), burial depth d = 24.

| Quantity | Value |
|---|---|
| sin α, cos α, tan α | 0.34202, 0.93969, 0.36397 |
| Seat width | 1.75 |
| Plumb cut height h_p | (5.5 − 1.75·0.93969) / 0.34202 = 11.273 |
| Q | (−0.8342, 95.0594) |
| Back (uphill) leg meets ground | s = (95.0594 + 0.0695) / (0.93969 + 0.02850) = 98.255; z_g = 95.0594 − 98.255·0.93969 = 2.731 |
| Back foot cut height z_b | 2.731 − 24 = −21.269 |
| Back leg outer edge, seat to foot | (96 + 21.269) / 0.93969 = 124.795 |
| Back leg overall length | 124.795 + 1.75·0.34202 = 125.394 (125-3/8") |
| Front (downhill) leg meets ground | z_g = −2.902 |
| Front foot cut height z_b | −26.902 |
| Front leg outer edge, seat to foot | 130.789 |
| Front leg overall length | 131.388 (131-3/8") |
| Leg length below grade | 24 / 0.93969 = 25.540 |
| Footprint at grade | 35.611 + 37.839 = 73.450 |
| Crossbar top edge, bottom edge | 44.265, 48.268 |
| Gusset top, bottom, height | 3.5, 20.971, 24 |
| Cut settings | Seat, foot, crossbar, and gusset sides 20.0°; plumb 70.0° |

With d = 0 (pads), the same inputs give back legs of 99.853 (99-7/8") and front legs of 105.848 (105-7/8"). Tests cover both.

Tests compare template output with these values to within 0.001 inch and 0.01°.

## Open questions

- **Gussets:** one on each face, as specified, or only on the outside face? The owner's earlier build shows one on the outside face, made from 2x lumber.
- **Crossbar ends:** flush with the legs and cut at the splay angle, as specified, or overhanging the legs with square cuts, as the owner's earlier build appears to have?
- **Leg stock** for the actual build (2x6 or 4x4).
- **Beam hold-down.** How the beam is fastened to the seats is not modeled in version 1 and goes on the confirmation checklist.
- The site's measured slope and the burial depth, chosen with an experienced builder.
