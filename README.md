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

Deploy this as a Node.js service (not as static-only hosting): the API and CRM persistence run in the same server process.

1. Use Node.js 22 or later and install dependencies with `npm ci`.
2. Configure environment variables for the integrations you enable. Keep server keys in the hosting platform's secret manager; never commit `.env`.
3. Build the frontend with `npm run build`, then start the service with `npm start`. Set `NODE_ENV=production` and let the host provide `PORT`.
4. Configure the Firebase Authentication authorized domain for the production hostname and use HTTPS.
5. Set `LEADPEBBLE_DATA_DIR` to a writable, persistent mounted directory if the host has an ephemeral filesystem. Without persistent storage, JSON-backed CRM records can be lost when the instance is replaced or restarted.

Google Maps browser keys are visible to browsers by design. Restrict `VITE_GOOGLE_MAPS_API_KEY` by allowed website referrers and enabled APIs in Google Cloud; use a separate restricted server key for `GOOGLE_MAPS_API_KEY`. Image generation and outreach integrations are optional and require their respective API keys and available quotas. See `.env.example` for variable names, not real credentials.

After startup, `GET /api/health` returns a small health response. Hashed frontend assets receive immutable caching; the HTML entry point is revalidated so deployments can serve the latest build.

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
