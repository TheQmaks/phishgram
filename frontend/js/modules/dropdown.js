import { elements, addClass, removeClass } from './dom.js';
import { countries } from './countries.js';

let isDropdownOpen = false;

export function populateDropdown() {
    elements.countryDropdown.innerHTML = '';
    
    countries.forEach(country => {
        const menuItem = document.createElement('div');
        menuItem.className = 'MenuItem';
        
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.code = country.phone;
        button.dataset.country = country.name;
        button.dataset.flag = country.flag;
        
        button.innerHTML = `
            <span class="country-flag">
                <img src="assets/img/emoji/${country.flag}" alt="${country.name}" class="emoji emoji-image" 
                     onerror="this.style.display='none'">
            </span>
            <span class="country-name">${country.name}</span>
            <span class="country-code">${country.phone}</span>
        `;
        
        menuItem.appendChild(button);
        elements.countryDropdown.appendChild(menuItem);
    });
}

export function toggleDropdown() {
    isDropdownOpen = !isDropdownOpen;
    
    if (isDropdownOpen) {
        elements.countryDropdown.style.display = 'block';
        // Force reflow before adding show class
        elements.countryDropdown.offsetHeight;
        addClass(elements.countryDropdown, 'show');
        addClass(elements.countryArrow, 'open');
        addClass(elements.countryInputGroup, 'dropdown-open');
    } else {
        closeDropdown();
    }
}

export function closeDropdown() {
    if (isDropdownOpen) {
        isDropdownOpen = false;
        removeClass(elements.countryDropdown, 'show');
        removeClass(elements.countryArrow, 'open');
        removeClass(elements.countryInputGroup, 'dropdown-open');
        setTimeout(() => {
            if (!isDropdownOpen) {
                elements.countryDropdown.style.display = 'none';
            }
        }, 150);
    }
}

export function setupDropdownHandlers(onCountrySelect) {
    elements.countryInputGroup.addEventListener('click', function(e) {
        e.stopPropagation();
        addClass(elements.countryCodeInput, 'ready');
        toggleDropdown();
    });

    elements.countryDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        const button = e.target.closest('button');
        if (button && onCountrySelect) {
            onCountrySelect(button);
            closeDropdown();
        }
    });

    document.addEventListener('click', function(e) {
        if (!elements.countryCodeInput.contains(e.target) && isDropdownOpen) {
            closeDropdown();
        }
    });
}