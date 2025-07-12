export const elements = {
    countryInputGroup: null,
    countryDisplay: null,
    countryDropdown: null,
    countryArrow: null,
    phoneInput: null,
    phoneInputGroup: null,
    phoneSubmit: null,
    loadingIndicator: null,
    form: null,
    countryCodeInput: null
};

export function initializeElements() {
    elements.countryInputGroup = document.getElementById('country-input-group');
    elements.countryDisplay = document.getElementById('country-display');
    elements.countryDropdown = document.getElementById('country-dropdown');
    elements.countryArrow = document.getElementById('country-arrow');
    elements.phoneInput = document.getElementById('phone-input');
    elements.phoneInputGroup = document.getElementById('phone-input-group');
    elements.phoneSubmit = document.getElementById('phone-submit');
    elements.loadingIndicator = document.getElementById('loading-indicator');
    elements.form = document.querySelector('.form');
    elements.countryCodeInput = document.querySelector('.CountryCodeInput');

    const missingElements = Object.entries(elements)
        .filter(([key, value]) => value === null)
        .map(([key]) => key);
    
    if (missingElements.length > 0) {
        console.warn('Missing DOM elements:', missingElements);
    }
}

export function addClass(element, className) {
    if (element) element.classList.add(className);
}

export function removeClass(element, className) {
    if (element) element.classList.remove(className);
}