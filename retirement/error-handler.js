// ═══════════════════════════════════════════
//  Centralized Error Handler
//  Better error messages and graceful degradation
// ═══════════════════════════════════════════

const ErrorHandler = {
    errorCount: 0,
    maxErrors: 10,
    
    /**
     * Handle calculation errors gracefully
     */
    handleCalculationError(error, context = '') {
        this.errorCount++;
        
        console.error(`[ErrorHandler] Calculation error${context ? ' in ' + context : ''}:`, error);
        
        // Log to console for debugging
        console.group('Error Details');
        console.log('Message:', error.message);
        console.log('Stack:', error.stack);
        console.log('Context:', context);
        console.groupEnd();
        
        // User-friendly message
        let userMessage = 'Calculation error. ';
        
        if (error.message.includes('undefined') || error.message.includes('null')) {
            userMessage += 'Missing required data. Please fill out all fields.';
        } else if (error.message.includes('NaN')) {
            userMessage += 'Invalid number detected. Please check your inputs.';
        } else if (error.message.includes('healthcareByAge')) {
            userMessage += 'Healthcare data missing. Refresh the page and try again.';
        } else if (error.message.includes('govBenefits')) {
            userMessage += 'Government benefits calculation failed. Check income and age inputs.';
        } else {
            userMessage += 'Please check your inputs and try again.';
        }
        
        // Show error to user (non-blocking)
        this.showError(userMessage, error.message);
        
        // Stop if too many errors
        if (this.errorCount >= this.maxErrors) {
            this.showFatalError('Too many errors occurred. Please refresh the page.');
        }
        
        return {
            success: false,
            error: userMessage,
            technical: error.message
        };
    },
    
    /**
     * Handle module loading errors
     */
    handleModuleError(moduleName, error) {
        console.error(`[ErrorHandler] Module ${moduleName} failed to load:`, error);
        
        this.showWarning(
            `Optional feature "${moduleName}" unavailable`,
            'Some advanced features may not work. The calculator will still function.'
        );
    },
    
    /**
     * Handle data validation errors
     */
    handleValidationError(field, message) {
        console.warn(`[ErrorHandler] Validation error on ${field}:`, message);
        
        this.showWarning(
            `Invalid ${field}`,
            message
        );
    },
    
    /**
     * Show error message to user
     */
    showError(message, technicalDetails = '') {
        const errorDiv = this._createErrorElement(message, technicalDetails, 'error');
        this._displayMessage(errorDiv);
    },
    
    /**
     * Show warning message to user
     */
    showWarning(message, technicalDetails = '') {
        const warningDiv = this._createErrorElement(message, technicalDetails, 'warning');
        this._displayMessage(warningDiv);
    },
    
    /**
     * Show fatal error (blocks UI)
     */
    showFatalError(message) {
        const overlay = document.createElement('div');
        overlay.id = 'fatal-error-overlay';
        overlay.innerHTML = `
            <div class="fatal-error-content">
                <div class="fatal-error-icon">⚠️</div>
                <h2>Something Went Wrong</h2>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn-primary">Refresh Page</button>
            </div>
        `;
        document.body.appendChild(overlay);
    },
    
    /**
     * Create error element
     */
    _createErrorElement(message, technicalDetails, type) {
        const div = document.createElement('div');
        div.className = `error-message error-${type}`;
        
        let icon = type === 'error' ? '❌' : '⚠️';
        let color = type === 'error' ? '#ef4444' : '#f59e0b';
        
        div.innerHTML = `
            <div class="error-content">
                <div class="error-icon">${icon}</div>
                <div class="error-text">
                    <div class="error-main">${message}</div>
                    ${technicalDetails ? `
                        <details class="error-details">
                            <summary>Technical details</summary>
                            <code>${technicalDetails}</code>
                        </details>
                    ` : ''}
                </div>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        div.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            max-width: 400px;
            background: white;
            border: 2px solid ${color};
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        
        return div;
    },
    
    /**
     * Display message
     */
    _displayMessage(element) {
        document.body.appendChild(element);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (element.parentElement) {
                element.remove();
            }
        }, 10000);
    },
    
    /**
     * Validate inputs before calculation
     */
    validateInputs(inputs) {
        const errors = [];
        
        // Age validation
        if (!inputs.currentAge || inputs.currentAge < 18 || inputs.currentAge > 100) {
            errors.push('Current age must be between 18 and 100');
        }
        
        if (!inputs.retirementAge || inputs.retirementAge <= inputs.currentAge) {
            errors.push('Retirement age must be greater than current age');
        }
        
        if (!inputs.lifeExpectancy || inputs.lifeExpectancy <= inputs.retirementAge) {
            errors.push('Life expectancy must be greater than retirement age');
        }
        
        // Income validation
        if (inputs.familyStatus === 'single') {
            if (!inputs.income1 || inputs.income1 < 0) {
                errors.push('Income must be a positive number');
            }
        } else {
            if (!inputs.income1 || inputs.income1 < 0) {
                errors.push('Person 1 income must be a positive number');
            }
        }
        
        // Savings validation
        if (inputs.rrsp < 0 || inputs.tfsa < 0 || inputs.nonReg < 0) {
            errors.push('Savings amounts cannot be negative');
        }
        
        // Spending validation
        if (!inputs.annualSpending || inputs.annualSpending <= 0) {
            errors.push('Annual spending must be greater than zero');
        }
        
        // Return rate validation
        if (inputs.returnRate < 0 || inputs.returnRate > 20) {
            errors.push('Expected returns should be between 0% and 20%');
        }
        
        // Inflation validation
        if (inputs.inflationRate < 0 || inputs.inflationRate > 15) {
            errors.push('Inflation rate should be between 0% and 15%');
        }
        
        if (errors.length > 0) {
            return {
                valid: false,
                errors
            };
        }
        
        return {
            valid: true,
            errors: []
        };
    },
    
    /**
     * Safe calculation wrapper
     */
    safeCalculate(inputs, calculationFn, context = 'calculation') {
        // Validate inputs first
        const validation = this.validateInputs(inputs);
        if (!validation.valid) {
            validation.errors.forEach(err => this.showWarning('Validation Error', err));
            return null;
        }
        
        // Try calculation
        try {
            return calculationFn(inputs);
        } catch (error) {
            this.handleCalculationError(error, context);
            return null;
        }
    },
    
    /**
     * Log debug info (only in development)
     */
    debug(message, ...args) {
        if (window.location.hostname === 'localhost' || window.location.search.includes('debug=1')) {
            console.log(`[Debug] ${message}`, ...args);
        }
    },
    
    /**
     * Reset error count
     */
    reset() {
        this.errorCount = 0;
    }
};

// Add error message styles
const errorStyles = document.createElement('style');
errorStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .error-content {
        display: flex;
        align-items: flex-start;
        padding: 16px;
        gap: 12px;
    }
    
    .error-icon {
        font-size: 24px;
        flex-shrink: 0;
    }
    
    .error-text {
        flex: 1;
    }
    
    .error-main {
        font-weight: 600;
        color: #111827;
        margin-bottom: 8px;
    }
    
    .error-details {
        margin-top: 8px;
    }
    
    .error-details summary {
        cursor: pointer;
        color: #6b7280;
        font-size: 12px;
    }
    
    .error-details code {
        display: block;
        margin-top: 8px;
        padding: 8px;
        background: #f3f4f6;
        border-radius: 4px;
        font-size: 11px;
        color: #ef4444;
        word-break: break-word;
    }
    
    .error-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #9ca3af;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        flex-shrink: 0;
    }
    
    .error-close:hover {
        color: #6b7280;
    }
    
    #fatal-error-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
    }
    
    .fatal-error-content {
        background: white;
        padding: 40px;
        border-radius: 12px;
        text-align: center;
        max-width: 500px;
    }
    
    .fatal-error-icon {
        font-size: 64px;
        margin-bottom: 20px;
    }
    
    .fatal-error-content h2 {
        margin: 0 0 15px 0;
        color: #111827;
    }
    
    .fatal-error-content p {
        color: #6b7280;
        margin-bottom: 25px;
    }
`;
document.head.appendChild(errorStyles);

console.log('[ErrorHandler] Module loaded');
