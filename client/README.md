# Secure Bridge Client

The client is a React + Vite application organized by feature.

## Structure

- `src/app` contains routing, Redux store setup, layout, and application initialization.
- `src/features/auth` contains authentication UI, state, and API integration.
- `src/features/api-key` contains BYOK UI, state, and API integration.
- `src/features/projects` contains project and conversation management.
- `src/features/chat` contains chat presentation and API integration.
- `src/features/profile` contains account management.
- `src/features/usage` contains usage state and dashboard.
- `src/shared` contains reusable UI, utilities, and the single HTTP client.

## Authentication

All feature API calls use `src/shared/api/client.js`. Authentication uses the `/api/v1/auth` backend contract. Browser credentials are sent with requests so httpOnly auth cookies work across refreshes.

The client does not persist plaintext passwords. Access tokens are kept in runtime state and refreshed through the server refresh cookie when required.

## Commands

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```
