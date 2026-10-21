import test from 'node:test';
import assert from 'node:assert/strict';
import { getGooglePlacesError } from './googlePlacesError.ts';

test('explains when the Google Places daily text-search quota is exhausted', () => {
  const result = getGooglePlacesError({
    error: {
      status: 'RESOURCE_EXHAUSTED',
      message: "Quota exceeded for quota metric 'SearchTextRequest' and limit 'SearchTextRequest per day'.",
    },
  }, 429);

  assert.equal(result.status, 429);
  assert.match(result.message, /daily search quota is exhausted/i);
  assert.match(result.message, /increase.*SearchTextRequest daily quota/i);
  assert.match(result.message, /Repeated retries will not bypass/i);
});

test('gives API setup guidance for denied Google Places requests', () => {
  const result = getGooglePlacesError({
    error: { status: 'PERMISSION_DENIED', message: 'Key not allowed' },
  }, 403);

  assert.equal(result.status, 502);
  assert.match(result.message, /Places API \(New\).*billing/i);
  assert.doesNotMatch(result.message, /Key not allowed/);
});
