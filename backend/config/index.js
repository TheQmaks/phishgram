export default {
    port: process.env.PORT || 3000,
    puppeteer: {
        headless: process.env.PUPPETEER_HEADLESS === 'true',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1200,800'
        ]
    },
    session: {
        timeout: 30 * 60 * 1000, // 30 minutes
        cleanupInterval: 5 * 60 * 1000 // 5 minutes
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
};