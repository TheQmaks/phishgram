import { setTimeout } from 'node:timers/promises';
import { selectors } from '../config/selectors.js';

export class InputStrategy {
    constructor(page, elementFinder, logger = console) {
        this.page = page;
        this.finder = elementFinder;
        this.logger = logger;
    }

    /**
     * Input phone number
     */
    async inputPhoneNumber(phone) {
        this.logger.info('Entering phone number...', { phone });
        
        try {
            // Find input field
            const phoneInput = await this.finder.waitForElement(selectors.phoneInput, {
                logPrefix: 'Phone input field'
            });
            
            // Get current value
            const currentValue = await phoneInput.evaluate(el => el.value || '');
            this.logger.info('Current phone field value:', { currentValue });
            
            // Determine what to enter
            let valueToType = phone;
            
            // If field already has country code matching our number's start
            if (currentValue && phone.startsWith(currentValue.trim())) {
                // Enter only missing part
                valueToType = phone.substring(currentValue.trim().length);
                this.logger.info('Will append to existing value:', { 
                    existing: currentValue.trim(), 
                    toAppend: valueToType 
                });
                
                // Click field and move cursor to end
                await phoneInput.click();
                await this.page.keyboard.press('End');
                
                // Enter missing part
                await phoneInput.type(valueToType);
            } else {
                // Clear and enter full number
                this.logger.info('Clearing field and typing full number');
                await this.finder.safeType(phoneInput, phone, {
                    clearFirst: true,
                    delay: 0
                });
            }
            
            // Check result
            const finalValue = await phoneInput.evaluate(el => el.value || '');
            this.logger.info('Final phone field value:', { 
                expected: phone, 
                actual: finalValue,
                success: finalValue === phone
            });
            
            this.logger.info('Phone number entered successfully');

            return true;
        } catch (error) {
            this.logger.error('Failed to enter phone number', error);
            throw error;
        }
    }

    /**
     * Click submit button
     */
    async clickSubmitButton() {
        this.logger.info('Looking for submit button...');
        
        try {
            // First check button text for errors
            const button = await this.finder.waitForElement(selectors.submitButton, {
                clickable: true,
                logPrefix: 'Submit button'
            });
            
            const buttonText = await button.evaluate(el => el.textContent);
            this.logger.info('Submit button text:', { text: buttonText });
            
            // Check for known errors
            if (buttonText && buttonText.includes('BANNED')) {
                throw new Error('Phone number is banned');
            }
            
            if (buttonText && buttonText.includes('FLOOD')) {
                throw new Error('Too many attempts. Please try later');
            }

            // Small delay after click
            await setTimeout(200);

            // Click button
            await this.finder.safeClick(button);
            this.logger.info('Submit button clicked');
            
            return true;
        } catch (error) {
            // If button not found, try Enter key
            if (error.code === 'ELEMENT_NOT_FOUND') {
                this.logger.info('Submit button not found, trying Enter key');
                await this.page.keyboard.press('Enter');
                return true;
            }
            
            this.logger.error('Failed to click submit button', error);
            throw error;
        }
    }

    /**
     * Input verification code
     */
    async inputVerificationCode(code) {
        this.logger.info('Entering verification code...');
        
        try {
            // Enter code
            await this.finder.waitAndType(selectors.codeInput, code, {
                logPrefix: 'Code input',
                clearFirst: true,
                delay: 0
            });
            
            this.logger.info('Verification code entered successfully');

            await this.page.keyboard.press('Enter');
            
            return true;
        } catch (error) {
            this.logger.error('Failed to enter verification code', error);
            throw error;
        }
    }
}