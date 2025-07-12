// WebSocket module for handling server communication

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.messageHandlers = new Map();
        this.connectionHandlers = {
            onConnect: null,
            onDisconnect: null,
            onError: null
        };
    }

    // Connect to WebSocket server
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            this.setupEventHandlers();
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            if (this.connectionHandlers.onError) {
                this.connectionHandlers.onError(error);
            }
        }
    }

    // Setup WebSocket event handlers
    setupEventHandlers() {
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            if (this.connectionHandlers.onConnect) {
                this.connectionHandlers.onConnect();
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            
            if (this.connectionHandlers.onDisconnect) {
                this.connectionHandlers.onDisconnect();
            }

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                setTimeout(() => this.connect(), this.reconnectDelay);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            
            if (this.connectionHandlers.onError) {
                this.connectionHandlers.onError(error);
            }
        };
    }

    handleMessage(data) {
        console.log('Received message:', data);
        
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data);
        } else {
            console.warn('No handler for message type:', data.type);
        }
    }

    on(messageType, handler) {
        this.messageHandlers.set(messageType, handler);
    }

    setConnectionHandlers(handlers) {
        Object.assign(this.connectionHandlers, handlers);
    }

    // Send a message
    send(data) {
        if (!this.isConnected || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket is not connected');
            return false;
        }

        try {
            this.ws.send(JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }

    submitPhone(phone) {
        return this.send({
            type: 'submit_phone',
            phone: phone
        });
    }

    submitCode(code) {
        return this.send({
            type: 'submit_code',
            code: code
        });
    }
}

export const wsClient = new WebSocketClient();