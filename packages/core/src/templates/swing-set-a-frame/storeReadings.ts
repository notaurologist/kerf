import type { StoreReading } from '../../model/storeReadings.ts';
import { ANCHORS, HANGERS } from './hardware.ts';

// What the swing set asks for at the store (#390; Stage 13 of docs/design/README.md): the values
// only the boards and hardware bought can say, beside the shopping lines they are read from. Each
// says where to look and what it looks like.

export const STORE_READINGS: readonly StoreReading[] = [
  {
    from: 'structuralInputs',
    path: 'beamSpeciesGrade',
    beside: { part: 'beam' },
    prompt: 'Read the grade stamp on the beam boards.',
    how: 'The grade stamp is inked on a face of each board. Choose the species and the grade it shows, such as No.\u00a02. If the list does not have them, the checks have no design values for these boards: choose boards whose stamp the list has, or ask an experienced builder whether these will do.',
    illustration: 'grade-stamp',
  },
  {
    from: 'structuralInputs',
    path: 'beamIncised',
    beside: { part: 'beam' },
    prompt: "Do the beam boards' faces have rows of small slits?",
    how: 'Incised boards have short slits pressed into their faces in rows, so the treatment goes deeper. Yes if you see them on the beam boards, no if the faces are smooth.',
  },
  {
    from: 'structuralInputs',
    path: 'hangerRating',
    beside: { hardware: HANGERS },
    prompt: 'Read the rated load on the swing hanger package.',
    how: "The package or the maker's instructions give the load in pounds. Enter the rating for one hanger; if it is given for a pair, ask the maker for one hanger's.",
  },
  {
    from: 'params',
    path: 'hardware.hangerMounting.kind',
    beside: { hardware: HANGERS },
    prompt: 'Read how the swing hangers fasten to the beam.',
    how: "The package or the maker's instructions show it: one bolt down through the beam, bolts sideways through a bracket around it, or screws.",
  },
  {
    from: 'params',
    path: 'hardware.hangerMounting.diameter',
    beside: { hardware: HANGERS },
    prompt: "Read the hanger bolts' diameter.",
    how: 'The package or instructions give the bolt size, such as 1/2"; or read it on the bolts that come with the hangers.',
  },
  {
    from: 'params',
    path: 'hardware.hangerMounting.perHanger',
    beside: { hardware: HANGERS },
    prompt: "Count the bolt holes in one side of a hanger's bracket.",
    how: 'Each hole takes one bolt across the beam.',
  },
  {
    from: 'params',
    path: 'hardware.hangerMounting.holeHeight',
    beside: { hardware: HANGERS },
    prompt: "Measure how high the bracket's bolt holes are.",
    how: "From the bracket's bottom, which sits against the beam's underside, to the center of its holes.",
  },
  {
    from: 'params',
    path: 'hardware.anchorsPerFoot',
    beside: { hardware: ANCHORS },
    prompt: 'Read how many anchors the maker calls for at each leg.',
    how: "The anchor package or the maker's instructions say how many to set at each post or leg. Enter that number for each leg foot.",
  },
];
