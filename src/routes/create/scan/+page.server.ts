/**
 * @fileoverview Server load for /create/scan.
 *
 * Reads the `?type` URL search parameter so the scan page opens
 * pre-configured for the exercise type the user selected in the nav tabs.
 */

import type {PageServerLoad} from './$types.js';
import type {ExerciseType} from '$lib/constants.js';
import {EXERCISE_TYPES} from '$lib/constants.js';

export const load: PageServerLoad = ({url}) => {
    const raw = url.searchParams.get('type') ?? 'kwt';
    const initialType: ExerciseType = (EXERCISE_TYPES.includes(raw as ExerciseType)
        ? raw
        : 'kwt') as ExerciseType;

    return {initialType};
};