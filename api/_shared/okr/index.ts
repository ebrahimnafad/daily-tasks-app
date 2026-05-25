import { cyclesHandler } from './cycles.js';
import { objectivesHandler } from './objectives.js';
import { keyResultsHandler } from './keyResults.js';
import { checkInsHandler } from './checkIns.js';
import type { OkrResourceHandler } from './types.js';

/** Resource map for standard upsert resources (cycles, objectives, key-results). */
export const okrResourceMap: Record<string, OkrResourceHandler> = {
  cycles: cyclesHandler,
  objectives: objectivesHandler,
  'key-results': keyResultsHandler,
};

/** Check-ins handler — separate because it uses append-only semantics + atomic increment. */
export { checkInsHandler };
