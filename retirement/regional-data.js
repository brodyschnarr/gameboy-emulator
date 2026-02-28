// ═══════════════════════════════════════════
//  Regional Benchmarks for Canada (2024)
// ═══════════════════════════════════════════

const RegionalData = {
    
    // Ontario regions
    ON_Toronto: {
        name: 'Toronto',
        province: 'ON',
        incomeMultiplier: 1.25,      // 25% higher than provincial average
        savingsMultiplier: 1.30,     // 30% higher savings
        housingCostMultiplier: 1.60, // 60% higher housing
        averageIncome: 85000,
        medianHome: 1100000
    },
    
    ON_Ottawa: {
        name: 'Ottawa',
        province: 'ON',
        incomeMultiplier: 1.15,
        savingsMultiplier: 1.20,
        housingCostMultiplier: 1.25,
        averageIncome: 78000,
        medianHome: 650000
    },
    
    ON_Northern: {
        name: 'Northern Ontario',
        province: 'ON',
        incomeMultiplier: 0.85,
        savingsMultiplier: 0.75,
        housingCostMultiplier: 0.60,
        averageIncome: 58000,
        medianHome: 350000
    },
    
    ON_Rest: {
        name: 'Rest of Ontario',
        province: 'ON',
        incomeMultiplier: 1.0,
        savingsMultiplier: 1.0,
        housingCostMultiplier: 1.0,
        averageIncome: 68000,
        medianHome: 550000
    },

    // British Columbia regions
    BC_Vancouver: {
        name: 'Vancouver',
        province: 'BC',
        incomeMultiplier: 1.22,
        savingsMultiplier: 1.25,
        housingCostMultiplier: 1.80, // Highest in Canada
        averageIncome: 82000,
        medianHome: 1200000
    },
    
    BC_Victoria: {
        name: 'Victoria',
        province: 'BC',
        incomeMultiplier: 1.10,
        savingsMultiplier: 1.15,
        housingCostMultiplier: 1.40,
        averageIncome: 72000,
        medianHome: 850000
    },
    
    BC_Rest: {
        name: 'Rest of BC',
        province: 'BC',
        incomeMultiplier: 0.95,
        savingsMultiplier: 0.90,
        housingCostMultiplier: 0.85,
        averageIncome: 64000,
        medianHome: 550000
    },

    // Alberta regions
    AB_Calgary: {
        name: 'Calgary',
        province: 'AB',
        incomeMultiplier: 1.20,
        savingsMultiplier: 1.25,
        housingCostMultiplier: 1.15,
        averageIncome: 82000,
        medianHome: 550000
    },
    
    AB_Edmonton: {
        name: 'Edmonton',
        province: 'AB',
        incomeMultiplier: 1.15,
        savingsMultiplier: 1.18,
        housingCostMultiplier: 1.05,
        averageIncome: 78000,
        medianHome: 420000
    },
    
    AB_Rest: {
        name: 'Rest of Alberta',
        province: 'AB',
        incomeMultiplier: 1.05,
        savingsMultiplier: 1.05,
        housingCostMultiplier: 0.80,
        averageIncome: 72000,
        medianHome: 380000
    },

    // Quebec regions
    QC_Montreal: {
        name: 'Montreal',
        province: 'QC',
        incomeMultiplier: 1.10,
        savingsMultiplier: 1.08,
        housingCostMultiplier: 1.20,
        averageIncome: 65000,
        medianHome: 550000
    },
    
    QC_QuebecCity: {
        name: 'Quebec City',
        province: 'QC',
        incomeMultiplier: 1.0,
        savingsMultiplier: 1.0,
        housingCostMultiplier: 0.95,
        averageIncome: 59000,
        medianHome: 380000
    },
    
    QC_Rest: {
        name: 'Rest of Quebec',
        province: 'QC',
        incomeMultiplier: 0.90,
        savingsMultiplier: 0.85,
        housingCostMultiplier: 0.70,
        averageIncome: 53000,
        medianHome: 280000
    },

    // Other provinces (province-level only)
    MB: {
        name: 'Manitoba',
        province: 'MB',
        incomeMultiplier: 0.92,
        savingsMultiplier: 0.88,
        housingCostMultiplier: 0.75,
        averageIncome: 62000,
        medianHome: 350000
    },

    SK: {
        name: 'Saskatchewan',
        province: 'SK',
        incomeMultiplier: 0.98,
        savingsMultiplier: 0.95,
        housingCostMultiplier: 0.70,
        averageIncome: 66000,
        medianHome: 320000
    },

    NS: {
        name: 'Nova Scotia',
        province: 'NS',
        incomeMultiplier: 0.88,
        savingsMultiplier: 0.82,
        housingCostMultiplier: 0.85,
        averageIncome: 59000,
        medianHome: 420000
    },

    NB: {
        name: 'New Brunswick',
        province: 'NB',
        incomeMultiplier: 0.85,
        savingsMultiplier: 0.78,
        housingCostMultiplier: 0.65,
        averageIncome: 57000,
        medianHome: 280000
    },

    PE: {
        name: 'Prince Edward Island',
        province: 'PE',
        incomeMultiplier: 0.82,
        savingsMultiplier: 0.75,
        housingCostMultiplier: 0.80,
        averageIncome: 55000,
        medianHome: 350000
    },

    NL: {
        name: 'Newfoundland & Labrador',
        province: 'NL',
        incomeMultiplier: 0.90,
        savingsMultiplier: 0.85,
        housingCostMultiplier: 0.75,
        averageIncome: 61000,
        medianHome: 320000
    },

    /**
     * Get regional data by code
     */
    getRegion(code) {
        return this[code] || this.ON_Rest; // Default to Rest of Ontario
    },

    /**
     * Get adjusted benchmarks for a region
     */
    getRegionalBenchmarks(regionCode, age) {
        const region = this.getRegion(regionCode);
        const baseBenchmarks = Benchmarks.getSavingsBenchmark(age);
        
        return {
            median: Math.round(baseBenchmarks.median * region.savingsMultiplier),
            average: Math.round(baseBenchmarks.average * region.savingsMultiplier),
            averageIncome: region.averageIncome,
            medianHome: region.medianHome,
            name: region.name
        };
    },

    /**
     * Get list of regions for a province
     */
    getProvincialRegions(province) {
        const regions = [];
        
        Object.keys(this).forEach(key => {
            const region = this[key];
            if (typeof region === 'object' && region.province === province) {
                regions.push({
                    code: key,
                    name: region.name
                });
            }
        });

        // If no regions found, return province-level
        if (regions.length === 0 && this[province]) {
            return [{
                code: province,
                name: this[province].name
            }];
        }
        
        return regions;
    }
};
