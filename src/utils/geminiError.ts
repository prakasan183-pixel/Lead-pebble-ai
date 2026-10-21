export interface GeminiImageError {
  status?: number;
  message: string;
}

interface GeminiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{ retryDelay?: string }>;
  };
}

export function getGeminiImageError(error: unknown): GeminiImageError {
  const rawMessage = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  let providerError: GeminiErrorPayload | undefined;

  const jsonStart = rawMessage.indexOf('{');
  const jsonEnd = rawMessage.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      providerError = JSON.parse(rawMessage.slice(jsonStart, jsonEnd + 1)) as GeminiErrorPayload;
    } catch {
      providerError = undefined;
    }
  }

  const nestedError = providerError?.error;
  const errorStatus =
    typeof error === 'object' && error !== null && 'status' in error &&
    typeof error.status === 'number'
      ? error.status
      : undefined;
  const status = typeof nestedError?.code === 'number' ? nestedError.code : errorStatus;
  const providerMessage = nestedError?.message || rawMessage;

  if (
    status === 429 ||
    nestedError?.status === 'RESOURCE_EXHAUSTED' ||
    /RESOURCE_EXHAUSTED|quota exceeded|free.?tier.*limit|rate limit/i.test(providerMessage)
  ) {
    const retryDelay = nestedError?.details?.find((detail) => detail.retryDelay)?.retryDelay;
    const retryMatch = retryDelay?.match(/^(\d+(?:\.\d+)?)s$/);
    const retrySeconds = retryMatch ? Number(retryMatch[1]) : null;
    const retryTime = retrySeconds !== null && retrySeconds > 0
      ? ` Google indicates retrying in about ${Math.ceil(retrySeconds / 3600)} hour(s).`
      : '';
    return {
      status: 429,
      message: `Gemini image generation is currently blocked by this API project's quota for the selected model. Check the Gemini API rate limits and billing; a free-tier key may have no quota for image generation.${retryTime}`,
    };
  }

  if (status === 403 || /PERMISSION_DENIED/i.test(providerMessage)) {
    return {
      status: 403,
      message: 'Gemini denied access to this image model. Check that the API key belongs to the intended project and that the model is enabled for that project.',
    };
  }

  if (status === 401 || /UNAUTHENTICATED/i.test(providerMessage)) {
    return {
      status: 401,
      message: 'Gemini rejected the configured API key. Check GEMINI_API_KEY in the server .env file and restart the server.',
    };
  }

  return {
    status,
    message: 'Gemini could not generate the image preview. Check the model availability, API key, and server logs.',
  };
}
