import { createLogger } from '../utils/logger.js';
import geoip from 'geoip-lite';

const logger = createLogger('WebSocketHandler');

export class WebSocketHandler {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
    }

    handleConnection(ws, req) {
        // Get client IP
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                        req.socket.remoteAddress || 
                        req.connection?.remoteAddress;
        
        // Remove IPv6 prefix if present
        const cleanIp = clientIp?.replace(/^::ffff:/, '');
        
        // Determine country by IP
        let detectedCountry = null;
        
        // Check if this is localhost
        const isLocalhost = cleanIp && (
            cleanIp === '127.0.0.1' || 
            cleanIp === 'localhost' || 
            cleanIp === '::1' ||
            cleanIp.startsWith('192.168.') ||
            cleanIp.startsWith('10.') ||
            cleanIp.startsWith('172.')
        );
        
        if (cleanIp && !isLocalhost) {
            const geo = geoip.lookup(cleanIp);
            detectedCountry = geo?.country || null;
            logger.info('New WebSocket connection', { 
                clientIp: cleanIp, 
                country: detectedCountry,
                geo: geo 
            });
        } else {
            logger.info('New WebSocket connection from localhost', { 
                clientIp: cleanIp || 'unknown',
                detectedCountry: null,
                isLocalhost 
            });
            // For localhost, country will be determined on client via external service
        }
        
        const session = this.sessionManager.createSession(ws, detectedCountry);
        
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                await session.handleMessage(data);
            } catch (error) {
                if (error instanceof SyntaxError) {
                    logger.error('Invalid JSON received', error, { sessionId: session.id });
                    session.sendError('Invalid message format');
                } else {
                    logger.error('WebSocket message error', error, { sessionId: session.id });
                    session.sendError('Internal server error');
                }
            }
        });

        ws.on('close', async (code, reason) => {
            logger.info('WebSocket connection closed', { 
                sessionId: session.id, 
                code, 
                reason: reason.toString() 
            });
            await this.sessionManager.removeSession(session.id);
        });

        ws.on('error', (error) => {
            logger.error('WebSocket error', error, { sessionId: session.id });
        });

        session.send({ 
            type: 'connected', 
            sessionId: session.id,
            message: 'Connected to phishgram server',
            detectedCountry: detectedCountry
        });
    }
}

export default WebSocketHandler;