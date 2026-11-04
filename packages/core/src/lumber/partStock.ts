import { z } from 'zod';
import { BoardStock, PanelStock } from './panel.ts';
import { Stock } from './stock.ts';
import { StripGlueUp } from './strips.ts';

/**
 * What a part is cut from: a panel glued from boards edge to edge, strips glued face to face,
 * board stock cut to length as it is sold (such as square stock bought ready to cut), or dimension
 * lumber. Board stock comes before dimension lumber, so one named like a dimension size keeps its
 * own lengths.
 */
export const PartStock = z.union([PanelStock, StripGlueUp, BoardStock, Stock]);
export type PartStock = z.infer<typeof PartStock>;

export function isPanel(stock: PartStock): stock is PanelStock {
  return 'boards' in stock;
}

export function isStripGlueUp(stock: PartStock): stock is StripGlueUp {
  return 'strips' in stock;
}

/** Board stock a part is cut from directly, with no glue-up. */
export function isBoardStock(stock: PartStock): stock is BoardStock {
  return 'buyableFeet' in stock;
}
