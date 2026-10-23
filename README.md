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

Deploy the frontend and API together on Vercel. The API uses Google Places for real business listings, and saved data is kept in each browser.

1. Import this repository into Vercel with the project root as the **Root Directory**.
2. Add `GOOGLE_MAPS_API_KEY` in **Project Settings → Environment Variables**. Enable Google Places API (New) for this key and restrict the key to that API. Keep it server-side; do not use a browser-restricted key.
3. Optionally add `GEMINI_API_KEY` for image generation and `DEEPSEEK_API_KEY` for outreach drafts.
4. Deploy the `main` branch. `vercel.json` selects npm, builds the Vite frontend, and the `api/[...path].ts` function serves the API.

`GET /api/health` should return `{"status":"ok"}`. Saved companies and profile preferences are stored in the current browser only; they do not sync across devices or browsers. Search results require the server-side Google Places key. Google Places billing and quotas apply.

The app opens directly to the company directory. On first visit it searches Google Places around the default location; you can search another area or use device GPS. Saved companies, profile name, and avatar are stored locally in that browser.

Company discovery uses multiple category-specific Google Places searches, then merges duplicate place IDs. When Google provides them, records include structured city/state/country, international phone, business status, regular hours, business types, and Google's editorial summary, with the Google Maps source retained. Google does not provide every business field for every listing; unavailable details remain unknown rather than being inferred. Search coverage and returned details depend on Places data, the selected area, API quotas, and billing.

Outreach drafts use DeepSeek via `DEEPSEEK_API_KEY`. Add this key to the local `.env` file for development or to the Vercel project's environment variables for deployment.
