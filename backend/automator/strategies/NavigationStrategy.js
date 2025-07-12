import { setTimeout } from 'node:timers/promises';
import { selectors } from '../config/selectors.js';

export class NavigationStrategy {
    constructor(page, logger = console) {
        this.page = page;
        this.logger = logger;
    }

    /**
     * Navigate to Telegram Web page
     */
    async navigateToTelegram() {
        this.logger.info('Navigating to Telegram Web...');
        
        await this.page.goto('https://web.telegram.org/a/', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        this.logger.info('Navigation complete');
    }
}