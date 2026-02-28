// ═══════════════════════════════════════════
//  Canadian Tax Calculator (2024 rates)
// ═══════════════════════════════════════════

const CanadianTax = {
    
    // Federal tax brackets (2024)
    federalBrackets: [
        { max: 55867, rate: 0.15 },
        { max: 111733, rate: 0.205 },
        { max: 173205, rate: 0.26 },
        { max: 246752, rate: 0.29 },
        { max: Infinity, rate: 0.33 }
    ],

    // Provincial tax brackets by province (2024)
    provincialBrackets: {
        ON: [ // Ontario
            { max: 51446, rate: 0.0505 },
            { max: 102894, rate: 0.0915 },
            { max: 150000, rate: 0.1116 },
            { max: 220000, rate: 0.1216 },
            { max: Infinity, rate: 0.1316 }
        ],
        BC: [ // British Columbia
            { max: 47937, rate: 0.0506 },
            { max: 95875, rate: 0.077 },
            { max: 110076, rate: 0.105 },
            { max: 133664, rate: 0.1229 },
            { max: 181232, rate: 0.147 },
            { max: Infinity, rate: 0.168 }
        ],
        AB: [ // Alberta (flat-ish with brackets)
            { max: 148269, rate: 0.10 },
            { max: 177922, rate: 0.12 },
            { max: 237230, rate: 0.13 },
            { max: 355845, rate: 0.14 },
            { max: Infinity, rate: 0.15 }
        ],
        QC: [ // Quebec
            { max: 51780, rate: 0.14 },
            { max: 103545, rate: 0.19 },
            { max: 126000, rate: 0.24 },
            { max: Infinity, rate: 0.2575 }
        ],
        MB: [ // Manitoba
            { max: 47000, rate: 0.108 },
            { max: 100000, rate: 0.1275 },
            { max: Infinity, rate: 0.174 }
        ],
        SK: [ // Saskatchewan
            { max: 52057, rate: 0.105 },
            { max: 148734, rate: 0.125 },
            { max: Infinity, rate: 0.145 }
        ],
        NS: [ // Nova Scotia
            { max: 29590, rate: 0.0879 },
            { max: 59180, rate: 0.1495 },
            { max: 93000, rate: 0.1667 },
            { max: 150000, rate: 0.175 },
            { max: Infinity, rate: 0.21 }
        ],
        NB: [ // New Brunswick
            { max: 49958, rate: 0.094 },
            { max: 99916, rate: 0.14 },
            { max: 185064, rate: 0.16 },
            { max: Infinity, rate: 0.195 }
        ],
        PE: [ // Prince Edward Island
            { max: 31984, rate: 0.098 },
            { max: 63969, rate: 0.138 },
            { max: Infinity, rate: 0.167 }
        ],
        NL: [ // Newfoundland & Labrador
            { max: 43198, rate: 0.087 },
            { max: 86395, rate: 0.145 },
            { max: 154244, rate: 0.158 },
            { max: 215943, rate: 0.173 },
            { max: Infinity, rate: 0.183 }
        ]
    },

    // Calculate total tax on income
    calculateTax(income, province = 'ON') {
        const federalTax = this._calculateBracketTax(income, this.federalBrackets);
        const provincialTax = this._calculateBracketTax(income, this.provincialBrackets[province] || this.provincialBrackets.ON);
        
        return {
            federal: federalTax,
            provincial: provincialTax,
            total: federalTax + provincialTax,
            effectiveRate: (federalTax + provincialTax) / income
        };
    },

    _calculateBracketTax(income, brackets) {
        let tax = 0;
        let previousMax = 0;

        for (const bracket of brackets) {
            const taxableInBracket = Math.min(income, bracket.max) - previousMax;
            if (taxableInBracket <= 0) break;
            
            tax += taxableInBracket * bracket.rate;
            previousMax = bracket.max;
            
            if (income <= bracket.max) break;
        }

        return tax;
    },

    // Calculate marginal tax rate (rate on next dollar earned)
    getMarginalRate(income, province = 'ON') {
        const fedBracket = this.federalBrackets.find(b => income <= b.max);
        const provBracket = (this.provincialBrackets[province] || this.provincialBrackets.ON).find(b => income <= b.max);
        
        const fedRate = fedBracket ? fedBracket.rate : this.federalBrackets[this.federalBrackets.length - 1].rate;
        const provRate = provBracket ? provBracket.rate : (this.provincialBrackets[province] || this.provincialBrackets.ON).slice(-1)[0].rate;
        
        return fedRate + provRate;
    },

    // OAS clawback calculation
    calculateOASClawback(income) {
        const threshold = 90997; // 2024 threshold
        const maxClawback = 142609; // Full clawback at this income
        const oasMax = 8479; // Max annual OAS

        if (income <= threshold) return 0;
        if (income >= maxClawback) return oasMax;

        const excessIncome = income - threshold;
        const clawbackRate = 0.15; // 15% clawback
        const clawback = excessIncome * clawbackRate;

        return Math.min(clawback, oasMax);
    },

    // Calculate after-tax income
    getAfterTaxIncome(grossIncome, province = 'ON') {
        const tax = this.calculateTax(grossIncome, province);
        return grossIncome - tax.total;
    },

    // RRSP tax savings calculation
    calculateRRSPSavings(contribution, income, province = 'ON') {
        const marginalRate = this.getMarginalRate(income, province);
        return contribution * marginalRate;
    }
};
