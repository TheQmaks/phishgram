// Phone number formatting patterns for different countries (using X as placeholder)
export const phonePatterns = {
    '+1': 'XXX XXX XXXX',     // US/Canada
    '+7': 'XXX XXX XX XX',    // Russia/Kazakhstan
    '+44': 'XXXX XXX XXXX',   // UK  
    '+33': 'XX XX XX XX XX',  // France
    '+49': 'XXXX XXXX XXXX',  // Germany
    '+86': 'XXX XXXX XXXX',   // China
    '+81': 'XX XXXX XXXX',    // Japan
    '+39': 'XXX XXX XXXX',    // Italy
    '+34': 'XXX XX XX XX',    // Spain
    '+972': 'XX XXX XXXX',    // Israel
    '+93': 'XX XXX XXXX',     // Afghanistan
    '+380': 'XX XXX XX XX',   // Ukraine
    '+61': 'XXX XXX XXX',     // Australia
    '+82': 'XX XXXX XXXX',    // South Korea
    'default': 'XXX XXX XXXX' // Default pattern
};

export function getPhonePattern(countryCode) {
    return phonePatterns[countryCode] || phonePatterns['default'];
}

export function formatPhoneNumber(phoneDigits, pattern) {
    let formatted = '';
    let digitIndex = 0;
    
    for (let i = 0; i < pattern.length && digitIndex < phoneDigits.length; i++) {
        if (pattern[i] === 'X') {
            formatted += phoneDigits[digitIndex];
            digitIndex++;
        } else {
            formatted += pattern[i];
        }
    }
    
    return formatted;
}

export function extractPhoneDigits(phoneNumber, countryCode) {
    // Remove country code and extract only digits
    const afterCountryCode = phoneNumber.substring(countryCode.length);
    return afterCountryCode.replace(/\D/g, '');
}

// Find best country match for a phone number
export function findBestCountryMatch(phoneNumber, countriesByPhone, detectedCountryCode) {
    // Check each possible prefix
    for (let i = Math.min(phoneNumber.length, 4); i >= 1; i--) {
        const prefix = phoneNumber.substring(0, i);
        const countriesWithPrefix = countriesByPhone.get(prefix);
        if (countriesWithPrefix && countriesWithPrefix.length > 0) {
            // Prefer detected country if available
            if (detectedCountryCode) {
                const detectedMatch = countriesWithPrefix.find(c => c.code === detectedCountryCode);
                if (detectedMatch) return detectedMatch;
            }
            return countriesWithPrefix[0];
        }
    }
    return null;
}