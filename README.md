# LeadPebble AI

LeadPebble is a company discovery and CRM app for finding, organizing, and managing business leads. It includes Google Maps search and optional Google Workspace integrations.

## Run Locally

**Prerequisites:** Node.js 22 or later and npm.

1. Install dependencies:
   `npm install`
2. Configure the required server environment variables in `.env` using `.env.example` as a guide.
3. Run the app:
   `npm run dev`

## Production Deployment

Deploy this as a Node.js service (not as static-only hosting): the API runs in the server process. Local development uses the JSON CRM store; production uses Firestore.

1. Use Node.js 22 or later and install dependencies with `npm ci`.
2. Configure environment variables for the integrations you enable. Keep server keys in the hosting platform's secret manager; never commit `.env`.
3. Build the frontend with `npm run build`, then start the service with `npm start`. Set `NODE_ENV=production` and let the host provide `PORT`.
4. Configure the Firebase Authentication authorized domain for the production hostname and use HTTPS.
5. Configure Firestore before production use. The production API stores each signed-in user's leads under that user's Firestore account; local development continues using the JSON file.

Google Maps browser keys are visible to browsers by design. Restrict `VITE_GOOGLE_MAPS_API_KEY` by allowed website referrers and enabled APIs in Google Cloud; use a separate restricted server key for `GOOGLE_MAPS_API_KEY`. Image generation and outreach integrations are optional and require their respective API keys and available quotas. See `.env.example` for variable names, not real credentials.

After startup, `GET /api/health` returns a small health response. Hashed frontend assets receive immutable caching; the HTML entry point is revalidated so deployments can serve the latest build.

### Firebase Hosting + Cloud Run

`firebase.json` serves the built frontend from `dist` and rewrites `/api/**` to the Cloud Run service `leadpulse-api` in `us-central1`. Deploy the API service before deploying Hosting. API routes verify Firebase ID tokens; the frontend sends a token with each API request. The Cloud Run endpoint is internet-reachable for Firebase Hosting rewrites, but API calls require a valid Firebase sign-in. If this app should be limited to specific people, add an email/domain allowlist before sharing the URL; Google sign-in alone permits any account enabled in the Firebase project.

1. Install and sign in to the Firebase and Google Cloud CLIs:
   ```powershell
   npm install -g firebase-tools
   firebase login
   gcloud auth login
   gcloud config set project YOUR_FIREBASE_PROJECT_ID
   firebase use leadpebble
   ```
   Confirm `firebase-applet-config.json` also belongs to this project; replace it with the project's web app config if needed. Enable billing and the Cloud Run, Cloud Build, Artifact Registry, and Firestore APIs for that project.
2. Set `VITE_GOOGLE_MAPS_API_KEY` in your local `.env` to a browser key restricted to your production domain, then build the frontend:
   ```powershell
   npm install
   npm run build
   ```
   The Docker image includes this build. The browser Maps key is public by design; do not use a server key here.
3. In the Firebase console, create a Firestore database in Native mode. Grant the Cloud Run service account the **Cloud Datastore User** role. Create any required server keys in Google Cloud Secret Manager (for example `gemini-api-key`, `google-maps-api-key`, and `openai-api-key`), then deploy the API:
   ```powershell
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com
   gcloud run deploy leadpulse-api --source . --region us-central1 --allow-unauthenticated --set-env-vars NODE_ENV=production --set-secrets GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_MAPS_API_KEY=google-maps-api-key:latest,OPENAI_API_KEY=openai-api-key:latest
   ```
   API routes verify Firebase ID tokens, and the frontend sends a token with every API call. Remove optional secrets from `--set-secrets` if you have not created them. Grant the Cloud Run service account **Secret Manager Secret Accessor** for each configured secret.
4. Deploy the frontend and API rewrites:
   ```powershell
   firebase deploy --only hosting
   ```
5. In Firebase Authentication, add the deployed `web.app` or custom domain to **Authorized domains**.

Production Firestore data is separate from any existing local `data/crm_leads.json`; migrate local records separately if you need them in the hosted account.

### Vercel

The `api/[...path].ts` function exposes the existing Express API on Vercel. Configure these environment variables in **Vercel → Project Settings → Environment Variables**:

- `FIREBASE_PROJECT_ID`: `leadpebble`.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete service-account JSON for the Firebase project. Create a dedicated service account with Firebase Authentication token verification and Firestore access; grant **Cloud Datastore User**. Save the JSON only as an encrypted Vercel environment variable, never in the repository or chat.
- `GOOGLE_MAPS_API_KEY`: a restricted server key with the Google Places API enabled.
- `VITE_GOOGLE_MAPS_API_KEY`: a browser key restricted to `lead-pebble-ai.vercel.app` and your enabled browser Maps APIs; this is embedded in the frontend build.
- Optional `GEMINI_API_KEY` and `OPENAI_API_KEY` for those features.

Enable Firestore in Native mode and Google Sign-In in Firebase Authentication. Set the variables for **Production**, then redeploy on Vercel so the frontend build and API function both receive the configuration. The API verifies Firebase ID tokens and stores leads per user in Firestore.

The app includes a page title, description, social-sharing metadata, and SoftwareApplication structured data. Once you choose the final domain, add its absolute canonical URL, `og:url`, and an absolute share-preview image URL in `index.html`. Search visibility is limited while the public experience is an app sign-in/dashboard rather than crawlable public product pages.

## Firebase Google Sign-In

The browser Firebase configuration is loaded from `firebase-applet-config.json`. Use the Firebase web app configuration for the Firebase project that should own sign-in.

Google sign-in is required to enter the dashboard. Signed-out visitors see the LeadPebble sign-in page; saved company records are fetched only after Firebase confirms a signed-in user. On first entry, users can grant browser location access or continue with the selected city; after the welcome animation, the app searches that location using the configured Places provider. Location access is optional. A skippable, mouse-guided tour introduces the main workspace after the first company load and is shown once per user per browser. Account Settings lets users update their Firebase display name and choose a business-themed avatar. Avatar choice and first-run completion are stored in that browser, while the display name is saved to the Firebase profile.

Company discovery uses multiple category-specific Google Places searches, then merges duplicate place IDs. When Google provides them, records include structured city/state/country, international phone, business status, regular hours, business types, and Google's editorial summary, with the Google Maps source retained. Google does not provide every business field for every listing; unavailable details remain unknown rather than being inferred. Search coverage and returned details depend on Places data, the selected area, API quotas, and billing.

Outreach drafts use the OpenAI API via `OPENAI_API_KEY`. OpenAI API billing and credits are separate from ChatGPT Free or Plus plans. A 429 response can mean either the API project has no credits or has reached its budget, or that it is making requests too quickly; the app reports these conditions separately.

In the Firebase console:

1. Open **Authentication → Sign-in method** and enable **Google**.
2. In **Authentication → Settings → Authorized domains**, add `localhost` for local development and the deployed app's hostname for production.
3. Confirm the OAuth consent screen and any Google Workspace scopes used by Chat or Forms are configured for the intended users.

The Firebase web app configuration is client-side configuration, not a server secret. Never put service-account private keys or OAuth client secrets in the browser bundle or commit them to the repository. Google sign-in cannot be fully verified until the Firebase project has Google enabled and the current host is authorized.

Basic Google sign-in requests only the account identity needed by Firebase. Google Chat and Forms scopes are requested separately, only when a user chooses to connect those integrations. If Google still shows an unverified-app warning during basic sign-in, the OAuth app owner must complete Google OAuth app verification in Google Cloud; this warning cannot be removed by changing application code.
