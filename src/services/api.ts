export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const message = response.status === 404
      ? 'The API route was not found. Check the Vercel deployment.'
      : `The API returned a non-JSON response (HTTP ${response.status}). Check the Vercel function logs.`;
    throw new Error(message);
  }
  return response;
}
