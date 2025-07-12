import puppeteer from 'puppeteer';
import { setTimeout } from 'node:timers/promises';
import { ElementFinder } from './core/ElementFinder.js';
import { NavigationStrategy } from './strategies/NavigationStrategy.js';
import { InputStrategy } from './strategies/InputStrategy.js';
import { createLogger } from '../utils/logger.js';
import { selectors } from './config/selectors.js';
import config from '../config/index.js';

export class TelegramAutomator {
    constructor(logger = null) {
        this.browser = null;
        this.page = null;
        this.logger = logger || createLogger('TelegramAutomator');

        this.finder = null;
        this.navigation = null;
        this.input = null;
    }

    /**
     * Initialize browser and strategies
     */
    async init() {
        if (this.browser) return;
        
        this.logger.info('Initializing browser...');
        
        this.browser = await puppeteer.launch({
            headless: config.puppeteer.headless,
            defaultViewport: null,
            args: config.puppeteer.args
        });

        const pages = await this.browser.pages();
        this.page = pages[0] ? pages[0] : await this.browser.newPage();
        
        await this.page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        this.finder = new ElementFinder(this.page, this.logger);
        this.navigation = new NavigationStrategy(this.page, this.logger);
        this.input = new InputStrategy(this.page, this.finder, this.logger);
        
        this.logger.info('Browser initialized successfully');
    }
    
    /**
     * Initialize browser and navigate to login page
     * Used when creating session for preliminary preparation
     */
    async initialize() {
        await this.init();
        
        try {
            await this.navigation.navigateToTelegram();

            this.logger.info('Pre-clicking login by phone button...');
            await this.finder.waitAndClick(selectors.loginButton, {
                timeout: 0,
                logPrefix: 'Login button'
            });

            this.logger.info('Waiting for phone input field to be ready...');
            await this.finder.waitForElement(selectors.phoneInput, {
                timeout: 0,
                logPrefix: 'Phone input field'
            });
            
            this.logger.info('Browser is ready for phone number input');
        } catch (error) {
            this.logger.error('Failed to initialize and prepare browser:', error);
            throw error;
        }
    }

    /**
     * Submit phone number
     */
    async submitPhone(phone) {
        try {
            if (!this.browser) {
                await this.initialize();
            }

            // Check if we're already on phone input page
            try {
                // If phone input field already available, just enter the number
                const phoneInputExists = await this.finder.waitForElement(selectors.phoneInput, {
                    timeout: 1000,  // Quick check
                    logPrefix: 'Phone input check'
                });
                
                if (phoneInputExists) {
                    this.logger.info('Phone input field already available, entering number...');
                }
            } catch (error) {
                // If field not found, need to go through process again
                this.logger.info('Phone input not ready, reinitializing...');
                await this.initialize();
            }

            await this.input.inputPhoneNumber(phone);

            await this.input.clickSubmitButton();

            this.logger.info('Waiting for either code input or error...');
            
            const result = await this.finder.waitForEither(
                selectors.codeInput,
                selectors.errorIndicators,
                {
                    timeout: 0,  // Wait indefinitely
                    logPrefix: 'Phone submission result'
                }
            );
            
            if (result.type === 'condition2') {
                this.logger.info('Error element found', { selector: result.selector });
                
                let errorMessage = 'Unknown error';
                try {
                    errorMessage = await result.element.evaluate(el => {
                        const parentDiv = el.closest('div.input-group');
                        const hasErrorClass = parentDiv && parentDiv.classList.contains('error');

                        if (el.tagName === 'INPUT' && hasErrorClass && el.getAttribute('aria-label')) {
                            return el.getAttribute('aria-label');
                        }

                        if (el.tagName === 'INPUT' && el.getAttribute('aria-label')) {
                            return el.getAttribute('aria-label');
                        }

                        if (el.tagName === 'LABEL') {
                            return el.textContent || el.innerText;
                        }

                        return el.textContent || el.innerText || el.getAttribute('aria-label') || 'Unknown error';
                    });
                    errorMessage = errorMessage.trim();
                } catch (e) {
                    this.logger.error('Failed to extract error message', e);
                }
                
                this.logger.warn('Error detected after phone submission:', errorMessage);
                
                return { 
                    success: false, 
                    error: errorMessage 
                };
            }
            
            this.logger.info('Phone submission successful - ready for code input');

            return { success: true };
        } catch (error) {
            this.logger.error('Phone submission error:', error);

            return { 
                success: false, 
                error: error.message || 'Failed to submit phone number' 
            };
        }
    }

    /**
     * Submit verification code
     */
    async submitCode(code) {
        try {
            if (!this.page) {
                throw new Error('Browser session not initialized');
            }

            await this.input.inputVerificationCode(code);

            await setTimeout(500);

            const pageContent = await this.page.evaluate(() => {
                const passwordInput = document.querySelector('input[type="password"]');
                return {
                    hasPasswordInput: !!passwordInput
                };
            });

            if (pageContent.hasPasswordInput) {
                this.logger.info('Password input already present, 2FA detected');
                return {
                    success: false, 
                    passwordRequired: true 
                };
            }
            
            // Check for code error or password request
            try {
                const codeInput = await this.page.$('#sign-in-code');
                if (codeInput) {
                    // Wait for error aria-label, successful login or password request
                    this.logger.info('Waiting for page response after code submission...');
                    const result = await this.page.waitForFunction(
                        () => {
                            console.log('[Code Check] Checking page state...');
                            // Check successful login
                            const successElements = document.querySelectorAll('.im-page, .chat-list, .sidebar');
                            if (successElements.length > 0) {
                                console.log('[Code Check] Success elements found');
                                return { type: 'success' };
                            }
                            
                            // Check password request
                            const passwordInput = document.querySelector('input[type="password"]');
                            const codeInputField = document.getElementById('sign-in-code');
                            const passwordHeader = document.querySelector('h1');
                            const twoStepText = document.querySelector('p');
                            
                            console.log('[Code Check] Password input found:', !!passwordInput);
                            console.log('[Code Check] Code input found:', !!codeInputField);
                            console.log('[Code Check] H1 text:', passwordHeader?.textContent);
                            console.log('[Code Check] P text:', twoStepText?.textContent);
                            
                            // Simple check: if password field exists, password is required
                            if (passwordInput) {
                                console.log('[Password Detection] Password input detected!');
                                // Additional check: if both code and password inputs are present,
                                // this is definitely 2FA
                                if (codeInputField) {
                                    console.log('[Password Detection] Both code and password inputs present - 2FA detected!');
                                }
                                return { type: 'password_required' };
                            }
                            
                            // Check error in aria-label
                            const codeInput = document.getElementById('sign-in-code');
                            if (codeInput) {
                                const ariaLabel = codeInput.getAttribute('aria-label');
                                const parentDiv = codeInput.closest('div.input-group');
                                const hasError = parentDiv && parentDiv.classList.contains('error');
                                
                                if (hasError && ariaLabel && ariaLabel !== 'Code') {
                                    return { type: 'error', message: ariaLabel };
                                }
                            }
                            
                            return null;
                        },
                        { timeout: 10000, polling: 500 }
                    );
                    
                    const evalResult = await result.evaluate(r => r);
                    this.logger.info('Wait result:', evalResult);

                    if (evalResult.type === 'password_required') {
                        this.logger.info('Two-factor authentication detected, password required');

                        return { 
                            success: false, 
                            passwordRequired: true 
                        };
                    }
                    
                    if (evalResult.type === 'error') {
                        this.logger.warn('Error detected after code submission:', evalResult.message);
                        
                        // Clear code field for retry
                        await codeInput.evaluate(el => {
                            el.value = '';
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        });
                        
                        return { 
                            success: false, 
                            error: evalResult.message 
                        };
                    }
                }
            } catch (waitError) {
                this.logger.error('Error during wait:', waitError);
                
                // Check again for password case
                const passwordCheck = await this.page.evaluate(() => {
                    const passwordInput = document.querySelector('input[type="password"]');
                    const passwordHeader = document.querySelector('h1');
                    const twoStepText = document.querySelector('p');
                    
                    return passwordInput &&
                        (passwordHeader?.textContent.includes('Password') ||
                            passwordHeader?.textContent.includes('password') ||
                            twoStepText?.textContent.includes('Two-Step') ||
                            twoStepText?.textContent.includes('additional password'));

                });
                
                if (passwordCheck) {
                    this.logger.info('Password form detected after timeout');
                    return {
                        success: false, 
                        passwordRequired: true 
                    };
                }
            }

            this.logger.info('Verification successful!');

            return { success: true };
        } catch (error) {
            this.logger.error('Code submission error:', error);

            return { 
                success: false, 
                error: error.message || 'Failed to submit verification code' 
            };
        }
    }


    /**
     * Submit password for two-factor authentication
     * @param {string} password - User password
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async submitPassword(password) {
        try {
            this.logger.info('Submitting password for 2FA');

            const passwordInput = await this.page.waitForSelector('input[type="password"], #sign-in-password', { timeout: 10000 });
            if (!passwordInput) {
                throw new Error('Password input field not found');
            }
            
            // Clear field and enter password
            await passwordInput.click({ clickCount: 3 }); // Select all text
            await passwordInput.type(password);
            this.logger.info('Password typed successfully');
            
            // Find and click Submit button
            try {
                const submitButton = await this.page.waitForSelector('button[type="submit"]', { timeout: 5000 });
                if (submitButton) {
                    await submitButton.click();
                    this.logger.info('Password submit button clicked');
                } else {
                    throw new Error('Submit button not found');
                }
            } catch (error) {
                this.logger.warn('Submit button not found, using Enter key as fallback');
                await passwordInput.press('Enter');
                this.logger.info('Password submitted via Enter key');
            }

            await setTimeout(500);
            
            // Check result
            try {
                const result = await this.page.waitForFunction(
                    () => {
                        // Check successful login
                        const successElements = document.querySelectorAll('.im-page, .chat-list, .sidebar');
                        if (successElements.length > 0) {
                            return { type: 'success' };
                        }
                        
                        // Check password error
                        const passwordInput = document.querySelector('input[type="password"], #sign-in-password');
                        if (passwordInput) {
                            const parentDiv = passwordInput.closest('div.input-group, .input-group');
                            const hasError = parentDiv && parentDiv.classList.contains('error');
                            
                            if (hasError) {
                                // Find error message in label
                                const errorLabel = parentDiv.querySelector('label');
                                if (errorLabel && errorLabel.textContent) {
                                    const errorMessage = errorLabel.textContent.trim();
                                    // Check this is not standard label
                                    if (errorMessage !== 'Password' && errorMessage !== '') {
                                        return { type: 'error', message: errorMessage };
                                    }
                                }
                                
                                // Fallback - check aria-label
                                const ariaLabel = passwordInput.getAttribute('aria-label');
                                if (ariaLabel && ariaLabel !== 'Password') {
                                    return { type: 'error', message: ariaLabel };
                                }
                                
                                // If error class exists but no message, return standard error
                                return { type: 'error', message: 'Invalid password, please try again' };
                            }
                        }
                        
                        return null;
                    },
                    { timeout: 30000 }
                );
                
                const evalResult = await result.evaluate(r => r);
                this.logger.info('Password verification result:', evalResult);
                
                if (evalResult.type === 'error') {
                    this.logger.warn('Password error detected:', evalResult.message);
                    
                    // Clear password field for retry
                    await passwordInput.evaluate(el => {
                        el.value = '';
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    });
                    
                    return { 
                        success: false, 
                        error: evalResult.message 
                    };
                }
            } catch (waitError) {
                this.logger.error('Error during password verification wait:', waitError);
            }

            this.logger.info('Password verification successful!');

            return { success: true };
            
        } catch (error) {
            this.logger.error('Password submission error:', error);

            return { 
                success: false, 
                error: error.message || 'Failed to submit password' 
            };
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }

            this.finder = null;
            this.navigation = null;
            this.input = null;
            
            this.logger.info('Browser cleanup completed');
        } catch (error) {
            this.logger.error('Error during cleanup:', error);
        }
    }
}