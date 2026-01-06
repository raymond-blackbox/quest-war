async function runTest(env) {
    console.log(`\n--- TESTING ${env.toUpperCase()} LOGGING ---`);
    if (env === 'production') {
        process.env.NODE_ENV = 'production';
        process.env.K_SERVICE = 'true';
    } else {
        delete process.env.NODE_ENV;
        delete process.env.K_SERVICE;
    }

    // Use a cache-busting query string or a different way to re-evaluate the module
    // In Node.js, we can't easily clear the ESM cache, so we'll test production first 
    // and then development in a separate run if needed.
    // However, for this simple test, let's just test production as it's the main goal.

    const loggerModule = await import('./backend/src/services/logger.js?update=' + Date.now());
    const logger = loggerModule.default;

    logger.info(`[${env}] This INFO log should ${env === 'production' ? 'NOT ' : ''}appear`);
    logger.debug(`[${env}] This DEBUG log should ${env === 'production' ? 'NOT ' : ''}appear`);
    logger.warn(`[${env}] This WARNING log SHOULD appear`);
    logger.error(`[${env}] This ERROR log SHOULD appear`);
}

await runTest('production');
await runTest('development');
