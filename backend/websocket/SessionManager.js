import { createLogger } from '../utils/logger.js';
import WebSocketSession from './Session.js';
import config from '../config/index.js';

const logger = createLogger('SessionManager');

export class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.startCleanupInterval();
    }

    createSession(ws, detectedCountry = null) {
        const sessionId = this.generateSessionId();
        const session = new WebSocketSession(sessionId, ws, detectedCountry);
        
        this.sessions.set(sessionId, session);
        logger.info('Session created', { 
            sessionId, 
            totalSessions: this.sessions.size,
            detectedCountry 
        });
        
        return session;
    }

    async removeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (session) {
            await session.cleanup();
            this.sessions.delete(sessionId);
            logger.info('Session removed', { sessionId, totalSessions: this.sessions.size });
        }
    }

    generateSessionId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    startCleanupInterval() {
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupExpiredSessions();
        }, config.session.cleanupInterval);
    }

    async cleanupExpiredSessions() {
        const expiredSessions = [];
        
        for (const [sessionId, session] of this.sessions) {
            if (session.isExpired(config.session.timeout)) {
                expiredSessions.push(sessionId);
            }
        }
        
        if (expiredSessions.length > 0) {
            logger.info('Cleaning up expired sessions', { count: expiredSessions.length });
            
            for (const sessionId of expiredSessions) {
                await this.removeSession(sessionId);
            }
        }
    }

    async shutdown() {
        logger.info('Shutting down session manager');

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        const promises = [];
        for (const sessionId of this.sessions.keys()) {
            promises.push(this.removeSession(sessionId));
        }
        
        await Promise.all(promises);
        logger.info('Session manager shutdown complete');
    }
}

export default SessionManager;