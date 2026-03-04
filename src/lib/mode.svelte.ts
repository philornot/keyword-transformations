/**
 * @fileoverview Global reactive store for the active exercise mode.
 *
 * The three nav tabs (KWT / Grammar / Translation) write to this store.
 * All pages that depend on the current mode read from it — no URL params
 * needed. Resets to 'kwt' on a hard page refresh, which is intentional.
 */

import type {ExerciseType} from '$lib/constants.js';

export const mode = $state<{ type: ExerciseType }>({type: 'kwt'});