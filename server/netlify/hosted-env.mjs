// Imported by the site's function (functions/api.mjs) before the server,
// whose config reads these as it loads. STEPWRITE_HOSTED turns on the limits
// for a public site (server/config.js). Only warnings are logged, which keeps
// visitors' writing out of the log.
process.env.STEPWRITE_HOSTED = 'true';
process.env.LOG_LEVEL ??= 'warn';
