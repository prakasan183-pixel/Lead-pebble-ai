import { auth } from './auth.ts';

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in to continue.');
  }

  const headers = new Headers(init.headers);
  headers.set('X-Firebase-ID-Token', await user.getIdToken());

  return fetch(input, { ...init, headers });
}
