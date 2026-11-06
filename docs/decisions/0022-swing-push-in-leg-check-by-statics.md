# 0022: The leg check takes the swing's push by statics, and the frame analysis stays an exploration

Status: Accepted (owner, November 6, 2026, #741 and #744).

## Context
The swing set's leg check (#468) took each frame's load as shared equally by its two legs, P = (C·R_s + R_w) / (2·cos α), and left out the swing's push toward the front and back.

The frame analysis exploration (#545, `docs/explorations/frame-analysis.md` on `explore/frame-analysis`) analyzed the whole swing set as a 3D frame, with pinned and with rigid joints. Where it overlaps the checks, it agrees with them: the legs at the bottom of the arc are within 0.71% of P, and uplift is within 3.491 lb of #467's check. It also found two things the checks did not cover:

- **The push loads one leg more than P:** 26% more in the worked example, up to 215.56% more across the 243 instances analyzed, and a median of 85.87% more in the narrowest quarter of splays. Pinned and rigid joints give the same picture.
- **Along the beam, the joint assumption dominates.** Buried, pinned joints sway 1.36 to 4.13 times as far as rigid ones. On pads with pinned joints the frame is a mechanism. No source gives a load along the beam or a sway limit, so no margin can be reported for it.

#741 asked whether to adopt any of this. Before adopting the push, it was checked whether statics reproduce the frame's numbers. The statics treat each A-frame as a rigid body on its feet, with the uplift check's loads and lever arms, and the loaded leg carries its foot's reaction along its axis. At the uplift check's chain angle, the larger of P and the statics' load read at most 3.2% under the frame for buried legs with pinned joints and 4.7% with rigid joints, and up to 9.65% under it on pads with rigid joints (the comment on #741 gives the table). The owner accepted statics that read up to about 10% low on pads. Run again at the leg check's own chain angle, where the push loads the leg most, they read at most 1.65% under the frame buried with pinned joints, 2.17% with rigid joints, and 4.52% on pads with rigid joints (#744).

## Decision
- **The leg check takes the larger of P and the push's load,** by statics, with the chain angle searched for the largest load on the leg. On sloped ground both legs are checked, since the push can load the shorter one more.
- **The check states its assumptions and how close they are:** the frame is taken as a rigid body on its feet, and the leg as carrying its foot's reaction along its axis. A frame analysis gave buried legs up to 2.2% more. On pads the leg check is not computed.
- **The checklist's racking item says what holds the frames along the beam** (#742), with no number.
- **The frame analysis does not come to `main`.** `packages/frame` stays on `explore/frame-analysis`, and its sweep is the statics' cross-check. The app does not show a frame analysis, since it cannot give a margin (hard rule 2) and its joint range is too wide to read.

## Consequences
- The swing set's template version goes up (0008). No worked example computes the leg check, so their stored outputs are unchanged. The sweep's draws change: across the sweep's computed leg checks, the governing load is 1.24 to 3.50 times P.
- A plan whose leg check was computed before version 43 shows a margin that leaves the push out until it is regenerated.
- If the leg check is ever computed on pads, for example once an end condition along the beam is sourced, the statics read up to 4.52% under a frame analysis there, and the check should state it.
- A frame analysis in core would be a new decision.
