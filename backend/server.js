import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config/index.js';
import { createLogger } from './utils/logger.js';
import SessionManager from './websocket/SessionManager.js';
import WebSocketHandler from './websocket/WebSocketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('Server');

const app = express();
const server = createServer(app);

const wss = new WebSocketServer({ server });

const sessionManager = new SessionManager();
const wsHandler = new WebSocketHandler(sessionManager);

app.use(express.static(join(__dirname, '../frontend')));

wss.on('connection', (ws, req) => {
    wsHandler.handleConnection(ws, req);
});

const startServer = () => {
    server.listen(config.port, () => {
        logger.info('Server started', {
            port: config.port,
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version
        });
        console.log(`
            🚀 phishgram server is running!
        `);
    });
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    server.close(() => {
        logger.info('Server closed');
    });

    wss.clients.forEach((ws) => {
        ws.close(1000, 'Server shutdown');
    });

    await sessionManager.shutdown();
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', reason, { promise });
    process.exit(1);
});

startServer();