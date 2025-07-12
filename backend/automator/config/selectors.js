// XPath selectors for various Telegram Web elements
export const selectors = {
    // Phone number login button
    loginButton: [
        "//button[text()='Log in by phone Number']",
        "//button[contains(text(), 'Log in by phone Number')]",
        "//button[contains(@class, 'Button') and contains(@class, 'primary') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'log in by phone')]",
        "//button[@class='Button smaller primary text']",
        "//*[text()='LOG IN BY PHONE NUMBER']",
        "//*[contains(text(), 'LOG IN BY PHONE NUMBER')]",
        "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'log in by phone number')]"
    ],
    
    // Phone input field
    phoneInput: [
        "//input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'your phone number')]",
        "//input[@type='tel' and contains(@placeholder, 'phone')]",
        "//input[@type='tel' and @id='sign-in-phone-number']",
        "//input[@type='tel'][1]",
        "//input[contains(@class, 'input-field-phone')]"
    ],
    
    // Submit button
    submitButton: [
        "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'next')]"
    ],
    
    // Code input field
    codeInput: [
        "//input[@type='tel' and not(contains(@placeholder, 'phone'))]",
        "//input[contains(@placeholder, 'code') or contains(@placeholder, 'Code')]",
        "//input[@maxlength='5' or @maxlength='6']",
        "//input[@aria-label='Code']",
        "//input[contains(@class, 'form-control') and @type='tel']",
        "//input[@type='number']",
        "//input[not(@aria-label)][@type='tel']",
        "//input[@id='sign-in-code']"
    ],
    
    // Error indicators
    errorIndicators: [
        // Main selector - find input inside div with error class
        "//div[contains(@class, 'input-group') and contains(@class, 'error')]//input[@type='tel']",
        "//div[contains(@class, 'input-group') and contains(@class, 'error')]//input",
        // Fallback options
        "//input[@type='tel' and @aria-label]",
        "//div[contains(@class, 'error')]//label",
        "//label[contains(., 'Invalid phone number')]",
        "//label[contains(., 'Too many attempts')]",
        "//label[contains(., 'banned')]",
        "//label[contains(., 'Invalid code')]",
        "//label[contains(., 'expired')]",
        // Code errors - main selector
        "//div[contains(@class, 'input-group') and contains(@class, 'error')]//input[@id='sign-in-code']",
        "//input[@id='sign-in-code' and @aria-label]",
        "//div[contains(@class, 'error') and contains(., 'Invalid code')]",
        "//div[contains(@class, 'error') and contains(., 'expired')]"
    ],
    
    // Success indicators
    successIndicators: [
        "//div[contains(@class, 'chat')]",
        "//div[contains(@class, 'sidebar')]",
        "//div[contains(@class, 'im-page')]"
    ],
    
    // Password input field
    passwordInput: [
        "//input[@type='password']",
        "//input[@id='sign-in-password']",
        "//input[contains(@placeholder, 'password') or contains(@placeholder, 'Password')]",
        "//input[@autocomplete='current-password']"
    ],
    
    // Password request indicators
    passwordIndicators: [
        "//h1[contains(., 'Enter Password')]",
        "//p[contains(., 'Two-Step Verification')]",
        "//div[contains(., 'additional password')]"
    ]
};

// Settings for element search
export const searchConfig = {
    defaultTimeout: 30000,
    checkInterval: 100,  // Reduce interval for faster response
    retryAttempts: 3,
    retryDelay: 500     // Reduce delay between attempts
};