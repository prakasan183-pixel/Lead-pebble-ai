import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGooglePlaceDetails } from './placeDetails.ts';

test('normalizes verifiable Google Places profile details without filling missing values', () => {
  const details = normalizeGooglePlaceDetails({
    internationalPhoneNumber: '+91 422 555 0100',
    nationalPhoneNumber: '0422 555 0100',
    addressComponents: [
      { longText: 'Coimbatore', types: ['locality', 'political'] },
      { longText: 'Tamil Nadu', types: ['administrative_area_level_1', 'political'] },
      { longText: 'India', types: ['country', 'political'] },
    ],
    regularOpeningHours: { weekdayDescriptions: ['Monday: 9:00 AM – 5:00 PM'] },
    editorialSummary: { text: 'A Google-provided business summary.' },
    businessStatus: 'OPERATIONAL',
    types: ['point_of_interest', 'establishment', 'manufacturer'],
  });

  assert.deepEqual(details, {
    phoneNumber: '+91 422 555 0100',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    country: 'India',
    businessStatus: 'OPERATIONAL',
    openingHours: ['Monday: 9:00 AM – 5:00 PM'],
    description: 'A Google-provided business summary.',
    businessTypes: ['manufacturer'],
  });
});

test('leaves unprovided details unknown rather than inventing them', () => {
  assert.deepEqual(normalizeGooglePlaceDetails({}), {
    openingHours: undefined,
    businessTypes: undefined,
    description: undefined,
    phoneNumber: undefined,
    city: undefined,
    state: undefined,
    country: undefined,
    businessStatus: undefined,
  });
});
