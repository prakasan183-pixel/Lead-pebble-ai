export interface GooglePlacesErrorResult {
  status: number;
  message: string;
}

interface GooglePlacesErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export function getGooglePlacesError(
  payload: GooglePlacesErrorPayload | undefined,
  httpStatus: number
): GooglePlacesErrorResult {
  const status = payload?.error?.status || '';
  const message = payload?.error?.message || '';

  if (
    status === 'RESOURCE_EXHAUSTED' ||
    /quota exceeded|quota metric|daily quota|rate limit/i.test(message)
  ) {
    return {
      status: 429,
      message: 'Google Places daily search quota is exhausted for this Google Cloud project. Search will work again when Google resets the quota, or ask the project owner to increase the Places API (New) SearchTextRequest daily quota in Google Cloud Console. Repeated retries will not bypass the limit.',
    };
  }

  if (httpStatus === 401 || httpStatus === 403 || status === 'PERMISSION_DENIED') {
    return {
      status: 502,
      message: 'Google Places rejected the server API key or project configuration. Check that Places API (New) is enabled, billing is active, and the key restrictions allow server-side Places requests.',
    };
  }

  return {
    status: 502,
    message: 'Google Places search is temporarily unavailable. Check Places API (New), billing, and server API-key restrictions.',
  };
}
