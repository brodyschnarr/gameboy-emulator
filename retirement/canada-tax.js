// ═══════════════════════════════════════════
//  Canadian Tax Calculator (2024 rates)
// ═══════════════════════════════════════════

const CanadianTax = {
    
    // Federal tax brackets (2024 — CRA)
    federalBrackets: [
        { max: 55867, rate: 0.15 },
        { max: 111733, rate: 0.205 },
        { max: 154906, rate: 0.26 },
        { max: 220000, rate: 0.29 },
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

    // Basic Personal Amount (2024) — non-refundable tax credits
    // Federal BPA: $15,705 (enhanced BPA phases down above $173,205)
    // Provincial BPA varies by province
    FEDERAL_BPA: 15705,
    PROVINCIAL_BPA: {
        ON: 11865, BC: 11981, AB: 21003, QC: 17183, SK: 17661,
        MB: 15780, NB: 12458, NS: 8481, PE: 12000, NL: 10382
    },

    // Calculate total tax on income
    // options.inflationFactor: CRA indexes brackets/credits annually to CPI.
    //   Pass (1+inf)^years to scale all dollar thresholds for future years.
    //   Default 1.0 = current-year dollars.
    calculateTax(income, province = 'ON', options = {}) {
        const cpi = options.inflationFactor || 1.0;

        // Scale brackets by inflation (CRA indexes annually)
        const scaleBrackets = (brackets) => brackets.map(b => ({
            max: b.max === Infinity ? Infinity : b.max * cpi,
            rate: b.rate
        }));

        let federalTax = this._calculateBracketTax(income, scaleBrackets(this.federalBrackets));
        let provincialTax = this._calculateBracketTax(income, scaleBrackets(this.provincialBrackets[province] || this.provincialBrackets.ON));

        // Basic Personal Amount — indexed to CPI
        federalTax -= (this.FEDERAL_BPA * cpi) * 0.15;
        const provBPA = (this.PROVINCIAL_BPA[province] || 11865) * cpi;
        const provLowestRate = (this.provincialBrackets[province] || this.provincialBrackets.ON)[0].rate;
        provincialTax -= provBPA * provLowestRate;

        // Senior tax credits (age 65+) — all thresholds indexed
        if (options.age >= 65) {
            const AGE_AMOUNT = 8790 * cpi;
            const AGE_CLAWBACK_START = 44325 * cpi;
            let ageAmount = AGE_AMOUNT;
            if (income > AGE_CLAWBACK_START) {
                ageAmount = Math.max(0, AGE_AMOUNT - (income - AGE_CLAWBACK_START) * 0.15);
            }
            federalTax -= ageAmount * 0.15;

            const PROV_AGE = { ON: 5586, BC: 5376, AB: 5853, QC: 3500, SK: 5180, MB: 3728, NB: 5513, NS: 4141, PE: 4019, NL: 6584 };
            const provAge = (PROV_AGE[province] || 5000) * cpi;
            let provAgeAmount = provAge;
            if (income > AGE_CLAWBACK_START) {
                provAgeAmount = Math.max(0, provAge - (income - AGE_CLAWBACK_START) * 0.15);
            }
            provincialTax -= provAgeAmount * provLowestRate;

            // Pension Income Credit — $2,000 indexed
            const pensionIncome = options.pensionIncome || 0;
            if (pensionIncome > 0) {
                const eligiblePension = Math.min(pensionIncome, 2000 * cpi);
                federalTax -= eligiblePension * 0.15;
                provincialTax -= eligiblePension * provLowestRate;
            }
        }

        // Disability Tax Credit (DTC)
        if (options.dtc) {
            const DTC_AMOUNT = 9428 * cpi;
            federalTax -= DTC_AMOUNT * 0.15;
            const PROV_DTC = { ON: 9428, BC: 9428, AB: 16635, QC: 3500, SK: 9428, MB: 9428, NB: 9128, NS: 7341, PE: 6890, NL: 7011 };
            provincialTax -= ((PROV_DTC[province] || 9428) * cpi) * provLowestRate;
        }

        // Medical Expense Tax Credit (METC)
        if (options.metcAnnual && options.metcAnnual > 0) {
            const medExpenses = options.metcAnnual * cpi;
            const threshold = Math.min(2635 * cpi, income * 0.03);
            const claimable = Math.max(0, medExpenses - threshold);
            if (claimable > 0) {
                federalTax -= claimable * 0.15;
                provincialTax -= claimable * provLowestRate;
            }
        }

        // Home Accessibility Tax Credit (HATC) — seniors 65+ or DTC eligible
        if (options.hatc && (options.age >= 65 || options.dtc)) {
            const HATC_MAX = 20000 * cpi;
            federalTax -= Math.min(HATC_MAX, 20000 * cpi) * 0.15; // Max $3,000 federal credit
            provincialTax -= Math.min(HATC_MAX, 20000 * cpi) * provLowestRate;
        }

        // Canada Caregiver Credit
        if (options.caregiverCredit) {
            const CCC_AMOUNT = 7999 * cpi;
            federalTax -= CCC_AMOUNT * 0.15; // ~$1,200/yr
            provincialTax -= CCC_AMOUNT * provLowestRate;
        }

        federalTax = Math.max(0, federalTax);
        provincialTax = Math.max(0, provincialTax);

        // Ontario Health Premium (not indexed to inflation — legislated fixed thresholds)
        let ontarioHealthPremium = 0;
        if (province === 'ON') {
            // CRA tiered rates on taxable income
            if (income > 200000) ontarioHealthPremium = 900;
            else if (income > 72000) ontarioHealthPremium = Math.min(900, 750 + (income - 72000) * 0.25);
            else if (income > 48000) ontarioHealthPremium = 600 + (income - 48000) * 0.25;
            else if (income > 36000) ontarioHealthPremium = 450 + (income - 36000) * 0.25;
            else if (income > 25000) ontarioHealthPremium = 300 + (income - 25000) * 0.06;
            else if (income > 20000) ontarioHealthPremium = (income - 20000) * 0.06;
            ontarioHealthPremium = Math.max(0, ontarioHealthPremium);
        }

        return {
            federal: federalTax,
            provincial: provincialTax,
            ontarioHealthPremium,
            total: federalTax + provincialTax + ontarioHealthPremium,
            effectiveRate: income > 0 ? (federalTax + provincialTax + ontarioHealthPremium) / income : 0
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
        const threshold = 93454; // 2025 threshold
        const maxClawback = 151668; // Full clawback at this income
        const oasMax = 9217; // Max annual OAS (2025 Q1)

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
    },

    // Capital gains tax calculation (50% inclusion rate as of 2024)
    calculateCapitalGainsTax(capitalGain, otherIncome, province = 'ON') {
        const inclusionRate = 0.50; // 50% of capital gains are taxable
        const taxableGain = capitalGain * inclusionRate;
        const totalIncome = otherIncome + taxableGain;
        
        // Tax on total income minus tax on other income = tax on capital gain
        const taxWithGain = this.calculateTax(totalIncome, province).total;
        const taxWithoutGain = this.calculateTax(otherIncome, province).total;
        
        return {
            capitalGainsTax: taxWithGain - taxWithoutGain,
            effectiveRate: (taxWithGain - taxWithoutGain) / capitalGain,
            taxableGain
        };
    }
};
