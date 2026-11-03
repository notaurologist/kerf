import type { StoreReading } from '../../model/storeReadings.ts';
import { ANCHORS, HANGERS } from './hardware.ts';
import { LEG_IDS } from './validate.ts';

// What the swing set asks for at the store (#390; Stage 13 of docs/design/README.md): the values
// only the boards and hardware bought can say, beside the shopping lines they are read from. Each
// says where to look and what it looks like.

export const STORE_READINGS: readonly StoreReading[] = [
  {
    from: 'structuralInputs',
    path: 'beamSpeciesGrade',
    beside: { parts: ['beam'] },
    prompt: 'Read the grade stamp on the beam boards.',
    how: 'The grade stamp is inked on a face of each board. Choose the species and the grade it shows, such as No.\u00a02. If the list does not have them, the checks have no design values for these boards: choose boards whose stamp the list has, or ask an experienced builder whether these will do.',
    illustration: 'grade-stamp',
  },
  {
    from: 'structuralInputs',
    path: 'beamIncised',
    beside: { parts: ['beam'] },
    prompt: "Do the beam boards' faces have rows of small slits?",
    how: 'Incised boards have short slits pressed into their faces in rows, so the treatment goes deeper. Yes if you see them on the beam boards, no if the faces are smooth.',
  },
  {
    from: 'structuralInputs',
    path: 'legSpeciesGrade',
    beside: { parts: LEG_IDS },
    prompt: 'Read the grade stamp on the leg boards.',
    how: 'The grade stamp is inked on a face of each board. Choose the species and the grade it shows, such as No.\u00a02. If the list does not have them, the legs\' check has no design values for these boards: choose boards whose stamp the list has, or ask an experienced builder whether these will do.',
    illustration: 'grade-stamp',
  },
  {
    from: 'structuralInputs',
    path: 'legIncised',
    beside: { parts: LEG_IDS },
    prompt: "Do the leg boards' faces have rows of small slits?",
    how: 'Incised boards have short slits pressed into their faces in rows, so the treatment goes deeper. Yes if you see them on the leg boards, no if the faces are smooth.',
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
    path: 'hardware.anchorsPerFoot',
    beside: { hardware: ANCHORS },
    prompt: 'Read how many anchors the maker calls for at each leg.',
    how: "The anchor package or the maker's instructions say how many to set at each post or leg. Enter that number for each leg foot.",
  },
];
