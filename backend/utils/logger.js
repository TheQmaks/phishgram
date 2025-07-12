class Logger {
    constructor(name) {
        this.name = name;
    }

    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        console.log(JSON.stringify({
            timestamp,
            level,
            logger: this.name,
            message,
            ...data
        }));
    }

    info(message, data) {
        this.log('info', message, data);
    }

    error(message, error, data = {}) {
        this.log('error', message, {
            ...data,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        });
    }

    warn(message, data) {
        this.log('warn', message, data);
    }

    debug(message, data) {
        this.log('debug', message, data);
    }
}

export const createLogger = (name) => new Logger(name);