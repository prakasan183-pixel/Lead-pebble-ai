import test from 'node:test';
import assert from 'node:assert/strict';
import { getGeminiImageError } from './geminiError.ts';

test('explains Gemini quota errors and reports provider retry time', () => {
  const response = getGeminiImageError(new Error(JSON.stringify({
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      message: 'You exceeded your current quota.',
      details: [{ retryDelay: '48140s' }],
    },
  })));

  assert.equal(response.status, 429);
  assert.match(response.message, /Gemini image generation.*quota/i);
  assert.match(response.message, /free-tier key may have no quota/i);
  assert.match(response.message, /about 14 hour\(s\)/);
});

test('explains Gemini model permission errors without exposing raw provider payload', () => {
  const response = getGeminiImageError(
    '{"error":{"code":403,"status":"PERMISSION_DENIED","message":"raw project detail"}}'
  );

  assert.equal(response.status, 403);
  assert.match(response.message, /denied access to this image model/i);
  assert.doesNotMatch(response.message, /raw project detail/);
});

test('returns a safe message for unrecognized Gemini errors', () => {
  const response = getGeminiImageError(new Error('unexpected provider response'));
  assert.match(response.message, /could not generate the image preview/i);
});
