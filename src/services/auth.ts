import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
];

const provider = new GoogleAuthProvider();

// In-memory token cache (never stored in localStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string | null }> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken ?? null;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const requestWorkspaceAccess = async (): Promise<{ user: User; accessToken: string }> => {
  const workspaceProvider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => workspaceProvider.addScope(scope));
  workspaceProvider.setCustomParameters({ prompt: 'consent' });

  const result = await signInWithPopup(auth, workspaceProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Google did not return a Workspace access token. Please retry and grant the requested permissions.');
  }

  cachedAccessToken = credential.accessToken;
  return { user: result.user, accessToken: credential.accessToken };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const updateAccountName = async (displayName: string): Promise<User> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to update your profile.');
  }

  const normalizedName = displayName.trim();
  if (!normalizedName) {
    throw new Error('Enter a name before saving.');
  }

  await updateProfile(currentUser, { displayName: normalizedName });
  await currentUser.reload();
  if (!auth.currentUser) {
    throw new Error('Your profile was updated, but your sign-in session is no longer active.');
  }
  return auth.currentUser;
};
