import { createApi, loadConfigOrReport, POOLED_CONNECTION } from './bootstrap.ts';

// Vercel's entry point (vercel.json). The app's routes already start with /api, which Vercel
// passes through unchanged. An invalid environment is logged and the function fails to start,
// so no request is served with a bad configuration.
export default createApi(loadConfigOrReport(process.env), POOLED_CONNECTION);
