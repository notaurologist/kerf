# Cut optimization benchmark

260 instances. Feet are buyable lengths bought; time is one run on the machine that wrote this.

The best lower bound totals 17760 ft. An instance is open when a method buys more than its best bound: either the method could do better or the bound is not tight.

| Method | Feet | Boards | Time (ms) | Proven | Over best bound (ft) | Instances open |
|---|---|---|---|---|---|---|
| first-fit decreasing | 18137 | 1879 | 9.1 |  | 377 | 74 |
| branch-and-bound | 17800 | 1928 | 75166.8 | 249 of 260 | 40 | 11 |

## Open instances (74)

| Instance | Pieces | material bound (ft) | linear relaxation bound (ft) | first-fit decreasing (ft / boards) | branch-and-bound (ft / boards) |
|---|---|---|---|---|---|
| swing-set-a-frame / sweep 6, 2x6 | 4 | 18 | 18 | 24 / 2 | 18 / 2 (proven) |
| swing-set-a-frame / sweep 101, 2x6 | 4 | 20 | 20 | 24 / 2 | 20 / 2 (proven) |
| swing-set-a-frame / sweep 128, 4x6 | 4 | 28 | 28 | 30 / 2 | 28 / 2 (proven) |
| swing-set-a-frame / sweep 170, 2x8 | 4 | 18 | 20 | 24 / 2 | 20 / 2 (proven) |
| swing-set-a-frame / sweep 196, 2x6 | 4 | 18 | 20 | 24 / 2 | 20 / 2 (proven) |
| record-cabinet / Worked example, every input entered, 13/16" x 5-1/2" | 45 | 94 | 94 | 100 / 13 | 94 / 14 (proven) |
| record-cabinet / Edge of range: two bays, 1" walnut panels, 1-1/16" x 5-1/2" | 23 | 42 | 42 | 44 / 6 | 42 / 7 (proven) |
| record-cabinet / sweep 1, 1-3/16" x 3-1/2" | 34 | 106 | 110 | 116 / 15 | 110 / 16 (proven) |
| record-cabinet / sweep 1, 2-3/4" x 2-3/4" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 5, 1-3/16" x 5-1/4" | 28 | 68 | 70 | 72 / 9 | 70 / 10 (proven) |
| record-cabinet / sweep 23, 1-1/8" x 5-7/16" | 43 | 86 | 86 | 88 / 11 | 86 / 11 (proven) |
| record-cabinet / sweep 24, 3/4" x 6-13/16" | 23 | 48 | 50 | 52 / 7 | 50 / 7 (proven) |
| record-cabinet / sweep 24, 1-15/16" x 1-15/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 34, 7/8" x 7-3/16" | 23 | 58 | 60 | 62 / 8 | 60 / 9 (proven) |
| record-cabinet / sweep 36, 1" x 5-11/16" | 33 | 94 | 100 | 102 / 13 | 100 / 15 (proven) |
| record-cabinet / sweep 41, 1-1/16" x 6-7/8" | 31 | 72 | 74 | 76 / 10 | 74 / 11 (proven) |
| record-cabinet / sweep 44, 1-1/8" x 4-9/16" | 42 | 102 | 102 | 104 / 13 | 102 / 14 (proven) |
| record-cabinet / sweep 44, 2-1/16" x 2-1/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 56, 7/8" x 4-1/16" | 45 | 80 | 80 | 84 / 11 | 80 / 15 (proven) |
| record-cabinet / sweep 62, 1-1/8" x 7" | 41 | 70 | 70 | 72 / 9 | 70 / 9 (proven) |
| record-cabinet / sweep 68, 15/16" x 4-3/8" | 37 | 68 | 68 | 72 / 9 | 68 / 9 (proven) |
| record-cabinet / sweep 70, 1" x 6-5/8" | 32 | 72 | 74 | 78 / 10 | 74 / 13 (proven) |
| record-cabinet / sweep 72, 15/16" x 6-9/16" | 27 | 74 | 74 | 76 / 10 | 74 / 12 (proven) |
| record-cabinet / sweep 74, 15/16" x 5-13/16" | 36 | 60 | 60 | 62 / 8 | 60 / 8 (proven) |
| record-cabinet / sweep 74, 1-7/8" x 1-7/8" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 80, 1-1/8" x 6-15/16" | 41 | 88 | 90 | 92 / 12 | 90 / 12 (proven) |
| record-cabinet / sweep 85, 3/4" x 4-1/16" | 53 | 100 | 102 | 104 / 13 | 102 / 14 (proven) |
| record-cabinet / sweep 85, 1-7/16" x 1-7/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 94, 1-1/16" x 6-5/8" | 23 | 68 | 70 | 72 / 9 | 70 / 10 (proven) |
| record-cabinet / sweep 94, 1-5/8" x 1-5/8" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 104, 1-1/16" x 6-9/16" | 45 | 104 | 106 | 108 / 14 | 106 / 16 (proven) |
| record-cabinet / sweep 104, 2-13/16" x 2-13/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 107, 1-1/8" x 4" | 34 | 72 | 72 | 76 / 10 | 72 / 9 (proven) |
| record-cabinet / sweep 114, 7/8" x 6-5/8" | 31 | 52 | 54 | 56 / 7 | 54 / 10 (proven) |
| record-cabinet / sweep 114, 1-5/16" x 1-5/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 118, 1" x 4-7/8" | 38 | 74 | 74 | 76 / 10 | 74 / 10 (proven) |
| record-cabinet / sweep 120, 1-1/16" x 7-3/16" | 41 | 88 | 88 | 92 / 12 | 88 / 12 (proven) |
| record-cabinet / sweep 139, 7/8" x 3-9/16" | 71 | 130 | 130 | 134 / 17 | 130 / 17 (proven) |
| record-cabinet / sweep 139, 2-3/8" x 2-3/8" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 149, 7/8" x 4" | 46 | 114 | 118 | 126 / 16 | 118 / 16 (proven) |
| record-cabinet / sweep 152, 15/16" x 4-1/16" | 34 | 92 | 94 | 100 / 13 | 94 / 13 (proven) |
| record-cabinet / sweep 153, 1-15/16" x 1-15/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 154, 1-3/16" x 5-13/16" | 33 | 76 | 78 | 84 / 11 | 78 / 12 (proven) |
| record-cabinet / sweep 166, 1-1/16" x 3-15/16" | 45 | 116 | 122 | 124 / 16 | 122 / 16 (proven) |
| record-cabinet / sweep 167, 1-1/8" x 6-1/4" | 24 | 72 | 74 | 76 / 10 | 74 / 11 (proven) |
| record-cabinet / sweep 179, 1" x 7" | 23 | 52 | 52 | 56 / 7 | 52 / 8 (proven) |
| record-cabinet / sweep 179, 1-3/4" x 1-3/4" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 182, 1-1/8" x 6-7/8" | 23 | 44 | 44 | 46 / 6 | 44 / 7 (proven) |
| record-cabinet / sweep 183, 13/16" x 6-7/8" | 27 | 56 | 58 | 60 / 8 | 58 / 9 (proven) |
| record-cabinet / sweep 185, 1-1/16" x 5-7/8" | 27 | 64 | 66 | 68 / 9 | 66 / 10 (proven) |
| record-cabinet / sweep 190, 13/16" x 4-5/16" | 32 | 98 | 102 | 104 / 13 | 102 / 14 (proven) |
| record-cabinet / sweep 195, 1-1/4" x 3-15/16" | 34 | 76 | 80 | 86 / 11 | 80 / 12 (proven) |
| workbench / Worked example, every input entered, 13/16" x 5-1/2" | 164 | 376 | 376 | 386 / 39 | 376 / 38 (proven) |
| workbench / Edge of range: the tallest bench, with a 4" top, 13/16" x 5-1/2" | 176 | 466 | 466 | 476 / 48 | 470 / 50 (stopped) |
| workbench / sweep 2, 13/16" x 5-1/2" | 181 | 584 | 590 | 606 / 61 | 590 / 68 (proven) |
| workbench / sweep 40, 13/16" x 5-1/2" | 249 | 766 | 774 | 796 / 80 | 778 / 78 (stopped) |
| workbench / sweep 68, 13/16" x 5-1/2" | 225 | 482 | 482 | 496 / 50 | 482 / 49 (proven) |
| workbench / sweep 70, 13/16" x 5-1/2" | 170 | 364 | 364 | 370 / 37 | 364 / 37 (proven) |
| workbench / sweep 85, 13/16" x 5-1/2" | 164 | 424 | 426 | 436 / 44 | 426 / 45 (proven) |
| workbench / sweep 94, 13/16" x 5-1/2" | 203 | 620 | 624 | 630 / 63 | 624 / 67 (proven) |
| workbench / sweep 95, 13/16" x 5-1/2" | 174 | 326 | 326 | 336 / 34 | 328 / 34 (stopped) |
| workbench / sweep 117, 13/16" x 5-1/2" | 188 | 350 | 352 | 358 / 36 | 358 / 36 (stopped) |
| workbench / sweep 118, 13/16" x 5-1/2" | 188 | 406 | 406 | 416 / 42 | 408 / 42 (stopped) |
| workbench / sweep 129, 13/16" x 5-1/2" | 183 | 302 | 302 | 306 / 31 | 306 / 31 (stopped) |
| workbench / sweep 137, 13/16" x 5-1/2" | 182 | 558 | 558 | 568 / 57 | 560 / 57 (stopped) |
| workbench / sweep 138, 13/16" x 5-1/2" | 188 | 494 | 494 | 506 / 51 | 496 / 53 (stopped) |
| workbench / sweep 142, 13/16" x 5-1/2" | 170 | 380 | 380 | 390 / 39 | 380 / 39 (proven) |
| workbench / sweep 149, 13/16" x 5-1/2" | 226 | 742 | 750 | 766 / 77 | 750 / 83 (proven) |
| workbench / sweep 157, 13/16" x 5-1/2" | 248 | 786 | 790 | 806 / 81 | 790 / 79 (proven) |
| workbench / sweep 158, 13/16" x 5-1/2" | 173 | 396 | 396 | 408 / 41 | 398 / 40 (stopped) |
| workbench / sweep 166, 13/16" x 5-1/2" | 184 | 484 | 484 | 496 / 50 | 484 / 51 (proven) |
| workbench / sweep 168, 13/16" x 5-1/2" | 172 | 298 | 298 | 306 / 31 | 306 / 31 (stopped) |
| workbench / sweep 170, 13/16" x 5-1/2" | 176 | 284 | 284 | 288 / 29 | 288 / 29 (stopped) |
| workbench / sweep 197, 13/16" x 5-1/2" | 183 | 386 | 386 | 396 / 40 | 386 / 41 (proven) |

## Every instance

| Instance | Pieces | material bound (ft) | linear relaxation bound (ft) | first-fit decreasing (ft / boards) | branch-and-bound (ft / boards) |
|---|---|---|---|---|---|
| swing-set-a-frame / Worked example, every input entered, 4x6 | 1 | 12 | 12 | 12 / 1 | 12 / 1 (proven) |
| swing-set-a-frame / Worked example, every input entered, 4x4 | 4 | 46 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / Worked example, every input entered, 2x6 | 2 | 10 | 10 | 10 / 1 | 10 / 1 (proven) |
| swing-set-a-frame / Worked example, every input entered, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / Two-ply 2x6 beam on pads, level ground, footprint depth, 2x6 | 4 | 30 | 32 | 32 / 2 | 32 / 2 (proven) |
| swing-set-a-frame / Two-ply 2x6 beam on pads, level ground, footprint depth, 4x4 | 4 | 38 | 40 | 40 / 4 | 40 / 4 (proven) |
| swing-set-a-frame / Two-ply 2x6 beam on pads, level ground, footprint depth, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 6, 2x8 | 3 | 28 | 30 | 30 / 3 | 30 / 3 (proven) |
| swing-set-a-frame / sweep 6, 4x6 | 4 | 48 | 52 | 52 / 4 | 52 / 4 (proven) |
| swing-set-a-frame / sweep 6, 2x6 | 4 | 18 | 18 | 24 / 2 | 18 / 2 (proven) |
| swing-set-a-frame / sweep 14, 4x8 | 1 | 12 | 12 | 12 / 1 | 12 / 1 (proven) |
| swing-set-a-frame / sweep 14, 4x6 | 4 | 38 | 40 | 40 / 4 | 40 / 4 (proven) |
| swing-set-a-frame / sweep 14, 2x6 | 4 | 16 | 16 | 16 / 1 | 16 / 1 (proven) |
| swing-set-a-frame / sweep 16, 4x6 | 1 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 16, 6x6 | 4 | 44 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / sweep 16, 2x4 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 16, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 21, 2x6 | 3 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 21, 4x4 | 4 | 48 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / sweep 21, 2x8 | 4 | 10 | 10 | 10 / 1 | 10 / 1 (proven) |
| swing-set-a-frame / sweep 24, 2x8 | 4 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 24, 4x6 | 4 | 52 | 52 | 52 / 4 | 52 / 4 (proven) |
| swing-set-a-frame / sweep 24, 2x4 | 2 | 10 | 10 | 10 / 1 | 10 / 1 (proven) |
| swing-set-a-frame / sweep 29, 6x6 | 5 | 54 | 60 | 60 / 5 | 60 / 5 (proven) |
| swing-set-a-frame / sweep 29, 2x4 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 29, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 34, 2x8 | 3 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 34, 4x6 | 4 | 54 | 56 | 56 / 4 | 56 / 4 (proven) |
| swing-set-a-frame / sweep 34, 2x6 | 4 | 12 | 12 | 12 / 1 | 12 / 1 (proven) |
| swing-set-a-frame / sweep 39, 4x6 | 5 | 42 | 44 | 44 / 3 | 44 / 3 (proven) |
| swing-set-a-frame / sweep 39, 2x6 | 4 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 42, 2x6 | 4 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 42, 6x6 | 4 | 42 | 44 | 44 / 4 | 44 / 4 (proven) |
| swing-set-a-frame / sweep 42, 2x8 | 2 | 10 | 10 | 10 / 1 | 10 / 1 (proven) |
| swing-set-a-frame / sweep 57, 4x6 | 5 | 68 | 76 | 76 / 5 | 76 / 5 (proven) |
| swing-set-a-frame / sweep 57, 2x4 | 2 | 26 | 28 | 28 / 2 | 28 / 2 (proven) |
| swing-set-a-frame / sweep 57, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 66, 6x6 | 5 | 50 | 54 | 54 / 5 | 54 / 5 (proven) |
| swing-set-a-frame / sweep 66, 2x8 | 4 | 12 | 12 | 12 / 1 | 12 / 1 (proven) |
| swing-set-a-frame / sweep 70, 4x6 | 1 | 14 | 14 | 14 / 1 | 14 / 1 (proven) |
| swing-set-a-frame / sweep 70, 6x6 | 4 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 70, 2x8 | 2 | 30 | 32 | 32 / 2 | 32 / 2 (proven) |
| swing-set-a-frame / sweep 70, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 76, 2x8 | 4 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 76, 4x4 | 4 | 32 | 32 | 32 / 2 | 32 / 2 (proven) |
| swing-set-a-frame / sweep 76, 2x4 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 84, 2x6 | 4 | 26 | 28 | 28 / 2 | 28 / 2 (proven) |
| swing-set-a-frame / sweep 84, 6x6 | 4 | 58 | 60 | 60 / 4 | 60 / 4 (proven) |
| swing-set-a-frame / sweep 84, 2x4 | 2 | 14 | 14 | 14 / 1 | 14 / 1 (proven) |
| swing-set-a-frame / sweep 91, 4x6 | 5 | 30 | 30 | 30 / 2 | 30 / 2 (proven) |
| swing-set-a-frame / sweep 91, 2x4 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 91, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 93, 4x8 | 1 | 14 | 14 | 14 / 1 | 14 / 1 (proven) |
| swing-set-a-frame / sweep 93, 4x4 | 4 | 38 | 40 | 40 / 4 | 40 / 4 (proven) |
| swing-set-a-frame / sweep 93, 2x8 | 4 | 12 | 12 | 12 / 1 | 12 / 1 (proven) |
| swing-set-a-frame / sweep 98, 4x6 | 1 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 98, 6x6 | 4 | 60 | 64 | 64 / 4 | 64 / 4 (proven) |
| swing-set-a-frame / sweep 98, 2x6 | 2 | 12 | 12 | 12 / 1 | 12 / 1 (proven) |
| swing-set-a-frame / sweep 98, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 100, 2x8 | 2 | 28 | 28 | 28 / 2 | 28 / 2 (proven) |
| swing-set-a-frame / sweep 100, 4x4 | 4 | 58 | 60 | 60 / 4 | 60 / 4 (proven) |
| swing-set-a-frame / sweep 100, 2x6 | 4 | 10 | 10 | 10 / 1 | 10 / 1 (proven) |
| swing-set-a-frame / sweep 101, 4x8 | 1 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 101, 6x6 | 4 | 60 | 60 | 60 / 4 | 60 / 4 (proven) |
| swing-set-a-frame / sweep 101, 2x6 | 4 | 20 | 20 | 24 / 2 | 20 / 2 (proven) |
| swing-set-a-frame / sweep 103, 4x6 | 5 | 40 | 44 | 44 / 3 | 44 / 3 (proven) |
| swing-set-a-frame / sweep 103, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 103, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 106, 6x6 | 5 | 52 | 56 | 56 / 5 | 56 / 5 (proven) |
| swing-set-a-frame / sweep 106, 2x6 | 4 | 14 | 14 | 14 / 1 | 14 / 1 (proven) |
| swing-set-a-frame / sweep 109, 2x8 | 6 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 109, 4x4 | 4 | 42 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / sweep 113, 2x6 | 6 | 46 | 48 | 48 / 3 | 48 / 3 (proven) |
| swing-set-a-frame / sweep 113, 4x4 | 4 | 46 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / sweep 115, 4x6 | 1 | 16 | 16 | 16 / 1 | 16 / 1 (proven) |
| swing-set-a-frame / sweep 115, 6x6 | 4 | 50 | 52 | 52 / 4 | 52 / 4 (proven) |
| swing-set-a-frame / sweep 115, 2x4 | 2 | 22 | 24 | 24 / 2 | 24 / 2 (proven) |
| swing-set-a-frame / sweep 115, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 117, 6x6 | 1 | 14 | 14 | 14 / 1 | 14 / 1 (proven) |
| swing-set-a-frame / sweep 117, 4x6 | 4 | 44 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / sweep 117, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 117, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 118, 6x6 | 5 | 70 | 74 | 74 / 5 | 74 / 5 (proven) |
| swing-set-a-frame / sweep 118, 2x6 | 2 | 14 | 14 | 14 / 1 | 14 / 1 (proven) |
| swing-set-a-frame / sweep 118, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 121, 4x8 | 1 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 121, 4x4 | 4 | 36 | 40 | 40 / 4 | 40 / 4 (proven) |
| swing-set-a-frame / sweep 121, 2x6 | 4 | 12 | 12 | 12 / 1 | 12 / 1 (proven) |
| swing-set-a-frame / sweep 124, 4x8 | 1 | 16 | 16 | 16 / 1 | 16 / 1 (proven) |
| swing-set-a-frame / sweep 124, 4x6 | 4 | 28 | 28 | 28 / 2 | 28 / 2 (proven) |
| swing-set-a-frame / sweep 124, 2x6 | 2 | 24 | 24 | 24 / 2 | 24 / 2 (proven) |
| swing-set-a-frame / sweep 124, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 125, 2x6 | 7 | 64 | 70 | 70 / 5 | 70 / 5 (proven) |
| swing-set-a-frame / sweep 125, 4x4 | 4 | 60 | 64 | 64 / 4 | 64 / 4 (proven) |
| swing-set-a-frame / sweep 127, 4x8 | 1 | 16 | 16 | 16 / 1 | 16 / 1 (proven) |
| swing-set-a-frame / sweep 127, 4x6 | 4 | 54 | 56 | 56 / 4 | 56 / 4 (proven) |
| swing-set-a-frame / sweep 127, 2x6 | 2 | 18 | 20 | 20 / 2 | 20 / 2 (proven) |
| swing-set-a-frame / sweep 127, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 128, 2x8 | 4 | 28 | 28 | 28 / 2 | 28 / 2 (proven) |
| swing-set-a-frame / sweep 128, 4x6 | 4 | 28 | 28 | 30 / 2 | 28 / 2 (proven) |
| swing-set-a-frame / sweep 128, 2x6 | 2 | 12 | 12 | 12 / 1 | 12 / 1 (proven) |
| swing-set-a-frame / sweep 129, 4x6 | 5 | 40 | 42 | 42 / 3 | 42 / 3 (proven) |
| swing-set-a-frame / sweep 129, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 129, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 131, 2x6 | 7 | 52 | 56 | 56 / 4 | 56 / 4 (proven) |
| swing-set-a-frame / sweep 131, 4x6 | 4 | 32 | 32 | 32 / 2 | 32 / 2 (proven) |
| swing-set-a-frame / sweep 136, 4x6 | 5 | 52 | 56 | 56 / 5 | 56 / 5 (proven) |
| swing-set-a-frame / sweep 136, 2x6 | 4 | 16 | 16 | 16 / 1 | 16 / 1 (proven) |
| swing-set-a-frame / sweep 138, 2x8 | 4 | 26 | 28 | 28 / 2 | 28 / 2 (proven) |
| swing-set-a-frame / sweep 138, 4x4 | 4 | 44 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / sweep 138, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 139, 6x6 | 1 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 139, 4x4 | 4 | 44 | 44 | 44 / 4 | 44 / 4 (proven) |
| swing-set-a-frame / sweep 139, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 139, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 141, 4x8 | 1 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 141, 6x6 | 4 | 42 | 44 | 44 / 4 | 44 / 4 (proven) |
| swing-set-a-frame / sweep 141, 2x4 | 2 | 10 | 10 | 10 / 1 | 10 / 1 (proven) |
| swing-set-a-frame / sweep 141, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 148, 6x6 | 5 | 60 | 64 | 64 / 4 | 64 / 4 (proven) |
| swing-set-a-frame / sweep 148, 2x6 | 4 | 10 | 10 | 10 / 1 | 10 / 1 (proven) |
| swing-set-a-frame / sweep 151, 6x6 | 1 | 14 | 14 | 14 / 1 | 14 / 1 (proven) |
| swing-set-a-frame / sweep 151, 4x4 | 4 | 46 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / sweep 151, 2x6 | 4 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 153, 2x8 | 3 | 48 | 48 | 48 / 3 | 48 / 3 (proven) |
| swing-set-a-frame / sweep 153, 6x6 | 4 | 46 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / sweep 153, 2x4 | 2 | 10 | 10 | 10 / 1 | 10 / 1 (proven) |
| swing-set-a-frame / sweep 153, 2x6 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 164, 4x8 | 1 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 164, 4x6 | 4 | 46 | 48 | 48 / 4 | 48 / 4 (proven) |
| swing-set-a-frame / sweep 164, 2x8 | 4 | 22 | 24 | 24 / 2 | 24 / 2 (proven) |
| swing-set-a-frame / sweep 170, 2x6 | 3 | 40 | 42 | 42 / 3 | 42 / 3 (proven) |
| swing-set-a-frame / sweep 170, 6x6 | 4 | 56 | 60 | 60 / 4 | 60 / 4 (proven) |
| swing-set-a-frame / sweep 170, 2x8 | 4 | 18 | 20 | 24 / 2 | 20 / 2 (proven) |
| swing-set-a-frame / sweep 171, 2x6 | 4 | 32 | 32 | 32 / 2 | 32 / 2 (proven) |
| swing-set-a-frame / sweep 171, 4x4 | 4 | 48 | 52 | 52 / 4 | 52 / 4 (proven) |
| swing-set-a-frame / sweep 171, 2x8 | 2 | 16 | 16 | 16 / 1 | 16 / 1 (proven) |
| swing-set-a-frame / sweep 175, 2x6 | 3 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 175, 4x6 | 4 | 34 | 36 | 36 / 3 | 36 / 3 (proven) |
| swing-set-a-frame / sweep 175, 2x4 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 175, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 181, 2x6 | 5 | 50 | 56 | 56 / 4 | 56 / 4 (proven) |
| swing-set-a-frame / sweep 181, 6x6 | 4 | 30 | 32 | 32 / 2 | 32 / 2 (proven) |
| swing-set-a-frame / sweep 181, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 184, 2x6 | 3 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 184, 4x4 | 4 | 54 | 56 | 56 / 4 | 56 / 4 (proven) |
| swing-set-a-frame / sweep 184, 2x4 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 184, 2x8 | 2 | 8 | 8 | 8 / 1 | 8 / 1 (proven) |
| swing-set-a-frame / sweep 194, 2x6 | 3 | 36 | 36 | 36 / 3 | 36 / 3 (proven) |
| swing-set-a-frame / sweep 194, 4x6 | 4 | 50 | 56 | 56 / 4 | 56 / 4 (proven) |
| swing-set-a-frame / sweep 194, 2x8 | 4 | 10 | 10 | 10 / 1 | 10 / 1 (proven) |
| swing-set-a-frame / sweep 196, 4x6 | 1 | 0 | 0 | 0 / 0 | 0 / 0 (proven) |
| swing-set-a-frame / sweep 196, 6x6 | 4 | 54 | 56 | 56 / 4 | 56 / 4 (proven) |
| swing-set-a-frame / sweep 196, 2x6 | 4 | 18 | 20 | 24 / 2 | 20 / 2 (proven) |
| record-cabinet / Worked example, every input entered, 13/16" x 5-1/2" | 45 | 94 | 94 | 100 / 13 | 94 / 14 (proven) |
| record-cabinet / Worked example, every input entered, 1-1/2" x 1-1/2" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / Edge of range: two bays, 1" walnut panels, 1-1/16" x 5-1/2" | 23 | 42 | 42 | 44 / 6 | 42 / 7 (proven) |
| record-cabinet / Edge of range: two bays, 1" walnut panels, 1-3/4" x 1-3/4" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 1, 1-3/16" x 3-1/2" | 34 | 106 | 110 | 116 / 15 | 110 / 16 (proven) |
| record-cabinet / sweep 1, 2-3/4" x 2-3/4" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 3, 3/4" x 5-13/16" | 38 | 74 | 76 | 76 / 10 | 76 / 10 (proven) |
| record-cabinet / sweep 3, 3" x 3" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 5, 1-3/16" x 5-1/4" | 28 | 68 | 70 | 72 / 9 | 70 / 10 (proven) |
| record-cabinet / sweep 5, 2-5/16" x 2-5/16" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 23, 1-1/8" x 5-7/16" | 43 | 86 | 86 | 88 / 11 | 86 / 11 (proven) |
| record-cabinet / sweep 23, 2-15/16" x 2-15/16" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 24, 3/4" x 6-13/16" | 23 | 48 | 50 | 52 / 7 | 50 / 7 (proven) |
| record-cabinet / sweep 24, 1-15/16" x 1-15/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 34, 7/8" x 7-3/16" | 23 | 58 | 60 | 62 / 8 | 60 / 9 (proven) |
| record-cabinet / sweep 34, 2-1/4" x 2-1/4" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 36, 1" x 5-11/16" | 33 | 94 | 100 | 102 / 13 | 100 / 15 (proven) |
| record-cabinet / sweep 36, 2-9/16" x 2-9/16" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 41, 1-1/16" x 6-7/8" | 31 | 72 | 74 | 76 / 10 | 74 / 11 (proven) |
| record-cabinet / sweep 41, 3" x 3" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 44, 1-1/8" x 4-9/16" | 42 | 102 | 102 | 104 / 13 | 102 / 14 (proven) |
| record-cabinet / sweep 44, 2-1/16" x 2-1/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 47, 1-1/4" x 6" | 33 | 86 | 94 | 94 / 12 | 94 / 12 (proven) |
| record-cabinet / sweep 47, 2-13/16" x 2-13/16" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 56, 7/8" x 4-1/16" | 45 | 80 | 80 | 84 / 11 | 80 / 15 (proven) |
| record-cabinet / sweep 56, 2-7/8" x 2-7/8" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 62, 1-1/8" x 7" | 41 | 70 | 70 | 72 / 9 | 70 / 9 (proven) |
| record-cabinet / sweep 62, 2" x 2" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 68, 15/16" x 4-3/8" | 37 | 68 | 68 | 72 / 9 | 68 / 9 (proven) |
| record-cabinet / sweep 68, 1-5/8" x 1-5/8" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 70, 1" x 6-5/8" | 32 | 72 | 74 | 78 / 10 | 74 / 13 (proven) |
| record-cabinet / sweep 70, 1-13/16" x 1-13/16" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 72, 15/16" x 6-9/16" | 27 | 74 | 74 | 76 / 10 | 74 / 12 (proven) |
| record-cabinet / sweep 72, 2-1/8" x 2-1/8" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 74, 15/16" x 5-13/16" | 36 | 60 | 60 | 62 / 8 | 60 / 8 (proven) |
| record-cabinet / sweep 74, 1-7/8" x 1-7/8" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 80, 1-1/8" x 6-15/16" | 41 | 88 | 90 | 92 / 12 | 90 / 12 (proven) |
| record-cabinet / sweep 80, 2-3/16" x 2-3/16" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 85, 3/4" x 4-1/16" | 53 | 100 | 102 | 104 / 13 | 102 / 14 (proven) |
| record-cabinet / sweep 85, 1-7/16" x 1-7/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 94, 1-1/16" x 6-5/8" | 23 | 68 | 70 | 72 / 9 | 70 / 10 (proven) |
| record-cabinet / sweep 94, 1-5/8" x 1-5/8" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 104, 1-1/16" x 6-9/16" | 45 | 104 | 106 | 108 / 14 | 106 / 16 (proven) |
| record-cabinet / sweep 104, 2-13/16" x 2-13/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 107, 1-1/8" x 4" | 34 | 72 | 72 | 76 / 10 | 72 / 9 (proven) |
| record-cabinet / sweep 107, 2-15/16" x 2-15/16" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 113, 1-1/4" x 5-15/16" | 38 | 88 | 92 | 92 / 12 | 92 / 12 (proven) |
| record-cabinet / sweep 113, 1-1/16" x 1-1/16" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 114, 7/8" x 6-5/8" | 31 | 52 | 54 | 56 / 7 | 54 / 10 (proven) |
| record-cabinet / sweep 114, 1-5/16" x 1-5/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 118, 1" x 4-7/8" | 38 | 74 | 74 | 76 / 10 | 74 / 10 (proven) |
| record-cabinet / sweep 118, 2-5/8" x 2-5/8" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 120, 1-1/16" x 7-3/16" | 41 | 88 | 88 | 92 / 12 | 88 / 12 (proven) |
| record-cabinet / sweep 120, 2-1/8" x 2-1/8" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 139, 7/8" x 3-9/16" | 71 | 130 | 130 | 134 / 17 | 130 / 17 (proven) |
| record-cabinet / sweep 139, 2-3/8" x 2-3/8" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 146, 3/4" x 6-3/16" | 23 | 54 | 56 | 56 / 7 | 56 / 7 (proven) |
| record-cabinet / sweep 146, 1-7/8" x 1-7/8" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 149, 7/8" x 4" | 46 | 114 | 118 | 126 / 16 | 118 / 16 (proven) |
| record-cabinet / sweep 149, 2-3/16" x 2-3/16" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 152, 15/16" x 4-1/16" | 34 | 92 | 94 | 100 / 13 | 94 / 13 (proven) |
| record-cabinet / sweep 152, 2-7/8" x 2-7/8" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 153, 7/8" x 6-1/8" | 38 | 94 | 100 | 100 / 13 | 100 / 13 (proven) |
| record-cabinet / sweep 153, 1-15/16" x 1-15/16" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 154, 1-3/16" x 5-13/16" | 33 | 76 | 78 | 84 / 11 | 78 / 12 (proven) |
| record-cabinet / sweep 154, 2-1/4" x 2-1/4" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 166, 1-1/16" x 3-15/16" | 45 | 116 | 122 | 124 / 16 | 122 / 16 (proven) |
| record-cabinet / sweep 166, 2-13/16" x 2-13/16" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 167, 1-1/8" x 6-1/4" | 24 | 72 | 74 | 76 / 10 | 74 / 11 (proven) |
| record-cabinet / sweep 167, 2-7/16" x 2-7/16" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 172, 1-3/16" x 3-15/16" | 39 | 76 | 78 | 78 / 10 | 78 / 10 (proven) |
| record-cabinet / sweep 172, 2-13/16" x 2-13/16" | 4 | 4 | 4 | 4 / 1 | 4 / 1 (proven) |
| record-cabinet / sweep 179, 1" x 7" | 23 | 52 | 52 | 56 / 7 | 52 / 8 (proven) |
| record-cabinet / sweep 179, 1-3/4" x 1-3/4" | 4 | 6 | 6 | 7 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 182, 1-1/8" x 6-7/8" | 23 | 44 | 44 | 46 / 6 | 44 / 7 (proven) |
| record-cabinet / sweep 182, 2-1/8" x 2-1/8" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 183, 13/16" x 6-7/8" | 27 | 56 | 58 | 60 / 8 | 58 / 9 (proven) |
| record-cabinet / sweep 183, 2-3/8" x 2-3/8" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 185, 1-1/16" x 5-7/8" | 27 | 64 | 66 | 68 / 9 | 66 / 10 (proven) |
| record-cabinet / sweep 185, 1-3/4" x 1-3/4" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| record-cabinet / sweep 190, 13/16" x 4-5/16" | 32 | 98 | 102 | 104 / 13 | 102 / 14 (proven) |
| record-cabinet / sweep 190, 2-5/8" x 2-5/8" | 4 | 6 | 6 | 6 / 2 | 6 / 2 (proven) |
| record-cabinet / sweep 195, 1-1/4" x 3-15/16" | 34 | 76 | 80 | 86 / 11 | 80 / 12 (proven) |
| record-cabinet / sweep 195, 2-9/16" x 2-9/16" | 4 | 3 | 3 | 3 / 1 | 3 / 1 (proven) |
| workbench / Worked example, every input entered, 13/16" x 5-1/2" | 164 | 376 | 376 | 386 / 39 | 376 / 38 (proven) |
| workbench / Edge of range: the tallest bench, with a 4" top, 13/16" x 5-1/2" | 176 | 466 | 466 | 476 / 48 | 470 / 50 (stopped) |
| workbench / sweep 2, 13/16" x 5-1/2" | 181 | 584 | 590 | 606 / 61 | 590 / 68 (proven) |
| workbench / sweep 40, 13/16" x 5-1/2" | 249 | 766 | 774 | 796 / 80 | 778 / 78 (stopped) |
| workbench / sweep 68, 13/16" x 5-1/2" | 225 | 482 | 482 | 496 / 50 | 482 / 49 (proven) |
| workbench / sweep 70, 13/16" x 5-1/2" | 170 | 364 | 364 | 370 / 37 | 364 / 37 (proven) |
| workbench / sweep 85, 13/16" x 5-1/2" | 164 | 424 | 426 | 436 / 44 | 426 / 45 (proven) |
| workbench / sweep 94, 13/16" x 5-1/2" | 203 | 620 | 624 | 630 / 63 | 624 / 67 (proven) |
| workbench / sweep 95, 13/16" x 5-1/2" | 174 | 326 | 326 | 336 / 34 | 328 / 34 (stopped) |
| workbench / sweep 117, 13/16" x 5-1/2" | 188 | 350 | 352 | 358 / 36 | 358 / 36 (stopped) |
| workbench / sweep 118, 13/16" x 5-1/2" | 188 | 406 | 406 | 416 / 42 | 408 / 42 (stopped) |
| workbench / sweep 129, 13/16" x 5-1/2" | 183 | 302 | 302 | 306 / 31 | 306 / 31 (stopped) |
| workbench / sweep 137, 13/16" x 5-1/2" | 182 | 558 | 558 | 568 / 57 | 560 / 57 (stopped) |
| workbench / sweep 138, 13/16" x 5-1/2" | 188 | 494 | 494 | 506 / 51 | 496 / 53 (stopped) |
| workbench / sweep 142, 13/16" x 5-1/2" | 170 | 380 | 380 | 390 / 39 | 380 / 39 (proven) |
| workbench / sweep 149, 13/16" x 5-1/2" | 226 | 742 | 750 | 766 / 77 | 750 / 83 (proven) |
| workbench / sweep 157, 13/16" x 5-1/2" | 248 | 786 | 790 | 806 / 81 | 790 / 79 (proven) |
| workbench / sweep 158, 13/16" x 5-1/2" | 173 | 396 | 396 | 408 / 41 | 398 / 40 (stopped) |
| workbench / sweep 166, 13/16" x 5-1/2" | 184 | 484 | 484 | 496 / 50 | 484 / 51 (proven) |
| workbench / sweep 168, 13/16" x 5-1/2" | 172 | 298 | 298 | 306 / 31 | 306 / 31 (stopped) |
| workbench / sweep 170, 13/16" x 5-1/2" | 176 | 284 | 284 | 288 / 29 | 288 / 29 (stopped) |
| workbench / sweep 197, 13/16" x 5-1/2" | 183 | 386 | 386 | 396 / 40 | 386 / 41 (proven) |
