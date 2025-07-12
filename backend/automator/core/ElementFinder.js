import { setTimeout } from 'node:timers/promises';
import { searchConfig } from '../config/selectors.js';

export class ElementFinder {
    constructor(page, logger = console) {
        this.page = page;
        this.logger = logger;
    }

    /**
     * Wait for element to appear by XPath selectors
     * @param {string|string[]} xpaths - XPath selector(s)
     * @param {Object} options - Search options
     * @returns {Promise<ElementHandle>}
     */
    async waitForElement(xpaths, options = {}) {
        const { 
            visible = true, 
            clickable = false,
            timeout = searchConfig.defaultTimeout,
            checkInterval = searchConfig.checkInterval,
            logPrefix = 'Element'
        } = options;
        
        // If timeout = 0, wait indefinitely
        if (options.timeout === 0) {
            return this.waitForElementForever(xpaths, options);
        }
        
        const xpathArray = Array.isArray(xpaths) ? xpaths : [xpaths];
        const startTime = Date.now();
        
        this.logger.info(`${logPrefix}: Waiting for element...`, { xpaths: xpathArray });
        
        while (true) {
            // Check timeout
            if (timeout > 0 && (Date.now() - startTime) > timeout) {
                const error = new Error(`${logPrefix}: Element not found after ${timeout}ms`);
                error.code = 'ELEMENT_NOT_FOUND';
                error.xpaths = xpathArray;
                throw error;
            }
            
            for (const xpath of xpathArray) {
                try {
                    const elements = await this.page.$$(`xpath/${xpath}`);
                    
                    if (elements.length > 0) {
                        this.logger.debug(`${logPrefix}: Found ${elements.length} elements with xpath`, { xpath, count: elements.length });
                    }
                    
                    for (const element of elements) {
                        const elementInfo = await element.evaluate(el => ({
                            tagName: el.tagName,
                            className: el.className,
                            textContent: el.textContent?.substring(0, 50),
                            isHidden: el.hidden,
                            style: {
                                display: window.getComputedStyle(el).display,
                                visibility: window.getComputedStyle(el).visibility,
                                opacity: window.getComputedStyle(el).opacity
                            }
                        }));
                        
                        this.logger.debug(`${logPrefix}: Checking element`, elementInfo);
                        
                        // Check visibility
                        if (visible) {
                            const isVisible = await this.isElementVisible(element);
                            if (!isVisible) {
                                this.logger.debug(`${logPrefix}: Element not visible`, { xpath });
                                continue;
                            }
                        }
                        
                        // Check clickability
                        if (clickable) {
                            const isClickable = await this.isElementClickable(element);
                            if (!isClickable) {
                                this.logger.debug(`${logPrefix}: Element not clickable`, { xpath });
                                continue;
                            }
                        }
                        
                        this.logger.info(`${logPrefix}: Found element`, { xpath });
                        return element;
                    }
                } catch (error) {
                    // Check critical errors
                    if (error.message.includes('detached Frame') || 
                        error.message.includes('Execution context was destroyed') ||
                        error.message.includes('Target closed')) {
                        this.logger.error(`${logPrefix}: Critical error, stopping search`, { xpath, error: error.message });
                        throw error;
                    }
                    this.logger.debug(`${logPrefix}: Error checking xpath`, { xpath, error: error.message });
                }
            }
            
            await setTimeout(checkInterval);
        }
    }

    /**
     * Check element visibility
     */
    async isElementVisible(element) {
        try {
            return await element.evaluate(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                
                return rect.width > 0 && 
                       rect.height > 0 && 
                       style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       rect.top < window.innerHeight &&
                       rect.bottom > 0 &&
                       rect.left < window.innerWidth &&
                       rect.right > 0;
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * Check element clickability
     */
    async isElementClickable(element) {
        try {
            return await element.evaluate(el => {
                return !el.disabled && 
                       el.style.pointerEvents !== 'none' &&
                       !el.hasAttribute('readonly');
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * Safely click element
     */
    async safeClick(element, options = {}) {
        const { retries = searchConfig.retryAttempts } = options;
        
        for (let i = 0; i < retries; i++) {
            try {
                await element.click();
                return;
            } catch (error) {
                if (i === retries - 1) throw error;
                
                this.logger.warn('Click failed, retrying...', { attempt: i + 1, error: error.message });
                await setTimeout(searchConfig.retryDelay);
            }
        }
    }

    /**
     * Safely enter text into element
     */
    async safeType(element, text, options = {}) {
        const { clearFirst = true, delay = 0 } = options;
        
        if (clearFirst) {
            // Get current value
            const currentValue = await element.evaluate(el => el.value || '');
            this.logger.debug('Current field value before clear:', { value: currentValue });
            
            // Clear field via JavaScript - most reliable method
            await element.evaluate(el => {
                el.value = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
            
            // Check result
            const clearedValue = await element.evaluate(el => el.value || '');
            if (clearedValue.length > 0) {
                this.logger.warn('Field not cleared via JS, trying keyboard method...', { remaining: clearedValue });
                
                // Fallback - via keyboard
                await element.click();
                await element.click({ clickCount: 3 });
                await this.page.keyboard.press('Backspace');
            }
            
            // Focus on element
            await element.click();
        }
        
        if (delay > 0) {
            // Type with delay between characters
            for (const char of text) {
                await element.type(char);
                await setTimeout(delay);
            }
        } else {
            await element.type(text);
        }
        
        // Check typing result
        const finalValue = await element.evaluate(el => el.value || '');
        this.logger.debug('Field value after typing:', { expected: text, actual: finalValue });
    }

    /**
     * Wait for and click element
     */
    async waitAndClick(xpaths, options = {}) {
        const element = await this.waitForElement(xpaths, { 
            ...options, 
            clickable: true,
            logPrefix: options.logPrefix || 'Click'
        });
        
        await this.safeClick(element, options);
        return element;
    }

    /**
     * Wait for and type text into element
     */
    async waitAndType(xpaths, text, options = {}) {
        const element = await this.waitForElement(xpaths, {
            ...options,
            logPrefix: options.logPrefix || 'Type'
        });
        
        await this.safeType(element, text, options);
        return element;
    }
    
    /**
     * Wait for element forever (no timeout)
     */
    async waitForElementForever(xpaths, options = {}) {
        const { 
            visible = true, 
            clickable = false,
            checkInterval = searchConfig.checkInterval,
            logPrefix = 'Element'
        } = options;
        
        const xpathArray = Array.isArray(xpaths) ? xpaths : [xpaths];
        
        this.logger.info(`${logPrefix}: Waiting for element forever...`, { xpaths: xpathArray });
        
        while (true) {
            // Check that page is still active
            try {
                await this.page.evaluate(() => document.title);
            } catch (error) {
                this.logger.error(`${logPrefix}: Page is no longer active`, { error: error.message });
                throw new Error('Page is no longer active or was closed');
            }
            for (const xpath of xpathArray) {
                try {
                    const elements = await this.page.$$(`xpath/${xpath}`);
                    
                    if (elements.length > 0) {
                        this.logger.debug(`${logPrefix}: Found ${elements.length} elements with xpath`, { xpath, count: elements.length });
                    }
                    
                    for (const element of elements) {
                        // Check visibility
                        if (visible) {
                            const isVisible = await this.isElementVisible(element);
                            if (!isVisible) {
                                this.logger.debug(`${logPrefix}: Element not visible`, { xpath });
                                continue;
                            }
                        }
                        
                        // Check clickability
                        if (clickable) {
                            const isClickable = await this.isElementClickable(element);
                            if (!isClickable) {
                                this.logger.debug(`${logPrefix}: Element not clickable`, { xpath });
                                continue;
                            }
                        }
                        
                        this.logger.info(`${logPrefix}: Found element`, { xpath });
                        return element;
                    }
                } catch (error) {
                    // Check critical errors
                    if (error.message.includes('detached Frame') || 
                        error.message.includes('Execution context was destroyed') ||
                        error.message.includes('Target closed')) {
                        this.logger.error(`${logPrefix}: Critical error, stopping search`, { xpath, error: error.message });
                        throw error;
                    }
                    this.logger.debug(`${logPrefix}: Error checking xpath`, { xpath, error: error.message });
                }
            }
            
            await setTimeout(checkInterval);
        }
    }
    
    /**
     * Wait for one of two conditions
     * Returns { type: 'condition1' | 'condition2', element: Element }
     */
    async waitForEither(selectors1, selectors2, options = {}) {
        const {
            timeout = 0,
            checkInterval = searchConfig.checkInterval,
            logPrefix = 'Either element'
        } = options;
        
        const startTime = Date.now();
        this.logger.info(`${logPrefix}: Waiting for either condition...`);
        
        const selectors1Array = Array.isArray(selectors1) ? selectors1 : [selectors1];
        const selectors2Array = Array.isArray(selectors2) ? selectors2 : [selectors2];
        
        while (true) {
            // Check that page is still active
            try {
                await this.page.evaluate(() => document.title);
            } catch (error) {
                this.logger.error(`${logPrefix}: Page is no longer active`, { error: error.message });
                throw new Error('Page is no longer active or was closed');
            }
            
            // Check first condition
            for (const selector of selectors1Array) {
                try {
                    const elements = await this.page.$$(`xpath/${selector}`);
                    for (const element of elements) {
                        if (await this.isElementVisible(element)) {
                            this.logger.info(`${logPrefix}: Found first condition with selector: ${selector}`);
                            return { type: 'condition1', element, selector };
                        }
                    }
                } catch (error) {
                    this.logger.debug(`${logPrefix}: Error checking condition1`, { selector, error: error.message });
                }
            }
            
            // Check second condition
            for (const selector of selectors2Array) {
                try {
                    const elements = await this.page.$$(`xpath/${selector}`);
                    for (const element of elements) {
                        if (await this.isElementVisible(element)) {
                            this.logger.info(`${logPrefix}: Found second condition with selector: ${selector}`);
                            return { type: 'condition2', element, selector };
                        }
                    }
                } catch (error) {
                    this.logger.debug(`${logPrefix}: Error checking condition2`, { selector, error: error.message });
                }
            }
            
            // Check timeout
            if (timeout > 0 && Date.now() - startTime > timeout) {
                const error = new Error(`${logPrefix}: Neither condition met after ${timeout}ms`);
                error.code = 'TIMEOUT';
                throw error;
            }
            
            await setTimeout(checkInterval);
        }
    }
}