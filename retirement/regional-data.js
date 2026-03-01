// ═══════════════════════════════════════════
//  Regional Data for Canada (2024)
//  Based on: cost of living indices, housing prices, income surveys
//  NOTE: Multipliers are estimates based on known regional differences
// ═══════════════════════════════════════════

const RegionalDataV2 = {
    
    // Ontario regions
    ON_Toronto: {
        name: 'Toronto (GTA)',
        province: 'ON',
        incomeMultiplier: 1.28,      // 28% higher than provincial average
        savingsMultiplier: 1.35,     // Higher incomes = more savings
        housingCostMultiplier: 1.75, // Extremely high housing costs
        averageIncome: 79000,
        medianIncome: 66000,
        medianHome: 1150000,
        costOfLivingIndex: 128        // Relative to national average = 100
    },
    
    ON_Ottawa: {
        name: 'Ottawa-Gatineau',
        province: 'ON',
        incomeMultiplier: 1.18,
        savingsMultiplier: 1.22,
        housingCostMultiplier: 1.30,
        averageIncome: 73000,
        medianIncome: 62000,
        medianHome: 625000,
        costOfLivingIndex: 112
    },
    
    ON_Hamilton: {
        name: 'Hamilton / Burlington',
        province: 'ON',
        incomeMultiplier: 1.08,
        savingsMultiplier: 1.12,
        housingCostMultiplier: 1.45,
        averageIncome: 67000,
        medianIncome: 57000,
        medianHome: 825000,
        costOfLivingIndex: 108
    },
    
    ON_KitchenerWaterloo: {
        name: 'Kitchener-Waterloo',
        province: 'ON',
        incomeMultiplier: 1.12,
        savingsMultiplier: 1.15,
        housingCostMultiplier: 1.35,
        averageIncome: 69000,
        medianIncome: 59000,
        medianHome: 725000,
        costOfLivingIndex: 105
    },
    
    ON_London: {
        name: 'London',
        province: 'ON',
        incomeMultiplier: 0.98,
        savingsMultiplier: 0.95,
        housingCostMultiplier: 1.15,
        averageIncome: 61000,
        medianIncome: 52000,
        medianHome: 575000,
        costOfLivingIndex: 98
    },
    
    ON_Southern: {
        name: 'Southern Ontario',
        province: 'ON',
        incomeMultiplier: 1.05,
        savingsMultiplier: 1.08,
        housingCostMultiplier: 1.25,
        averageIncome: 65000,
        medianIncome: 55000,
        medianHome: 675000,
        costOfLivingIndex: 105
    },
    
    ON_Northern: {
        name: 'Northern Ontario',
        province: 'ON',
        incomeMultiplier: 0.88,
        savingsMultiplier: 0.78,
        housingCostMultiplier: 0.65,
        averageIncome: 54000,
        medianIncome: 47000,
        medianHome: 350000,
        costOfLivingIndex: 92
    },
    
    ON_Rest: {
        name: 'Rest of Ontario',
        province: 'ON',
        incomeMultiplier: 1.0,
        savingsMultiplier: 1.0,
        housingCostMultiplier: 1.0,
        averageIncome: 62000,
        medianIncome: 53000,
        medianHome: 550000,
        costOfLivingIndex: 100
    },

    // British Columbia regions
    BC_Vancouver: {
        name: 'Vancouver (Metro)',
        province: 'BC',
        incomeMultiplier: 1.25,
        savingsMultiplier: 1.28,
        housingCostMultiplier: 1.95, // Highest housing costs in Canada
        averageIncome: 77000,
        medianIncome: 64000,
        medianHome: 1300000,
        costOfLivingIndex: 135
    },
    
    BC_Victoria: {
        name: 'Victoria',
        province: 'BC',
        incomeMultiplier: 1.12,
        savingsMultiplier: 1.18,
        housingCostMultiplier: 1.52,
        averageIncome: 69000,
        medianIncome: 58000,
        medianHome: 925000,
        costOfLivingIndex: 118
    },
    
    BC_Kelowna: {
        name: 'Kelowna / Okanagan',
        province: 'BC',
        incomeMultiplier: 1.05,
        savingsMultiplier: 1.08,
        housingCostMultiplier: 1.35,
        averageIncome: 65000,
        medianIncome: 55000,
        medianHome: 775000,
        costOfLivingIndex: 110
    },
    
    BC_Rest: {
        name: 'Rest of BC',
        province: 'BC',
        incomeMultiplier: 0.96,
        savingsMultiplier: 0.92,
        housingCostMultiplier: 0.92,
        averageIncome: 59000,
        medianIncome: 51000,
        medianHome: 525000,
        costOfLivingIndex: 102
    },

    // Alberta regions
    AB_Calgary: {
        name: 'Calgary',
        province: 'AB',
        incomeMultiplier: 1.22,
        savingsMultiplier: 1.28,
        housingCostMultiplier: 1.08,
        averageIncome: 75000,
        medianIncome: 64000,
        medianHome: 575000,
        costOfLivingIndex: 108
    },
    
    AB_Edmonton: {
        name: 'Edmonton',
        province: 'AB',
        incomeMultiplier: 1.18,
        savingsMultiplier: 1.22,
        housingCostMultiplier: 0.98,
        averageIncome: 73000,
        medianIncome: 62000,
        medianHome: 425000,
        costOfLivingIndex: 104
    },
    
    AB_FortMcMurray: {
        name: 'Fort McMurray / Oil Sands',
        province: 'AB',
        incomeMultiplier: 1.55,      // Very high resource sector wages
        savingsMultiplier: 1.45,
        housingCostMultiplier: 1.15,
        averageIncome: 96000,
        medianIncome: 82000,
        medianHome: 525000,
        costOfLivingIndex: 115
    },
    
    AB_Rest: {
        name: 'Rest of Alberta',
        province: 'AB',
        incomeMultiplier: 1.08,
        savingsMultiplier: 1.10,
        housingCostMultiplier: 0.82,
        averageIncome: 67000,
        medianIncome: 57000,
        medianHome: 375000,
        costOfLivingIndex: 98
    },

    // Quebec regions
    QC_Montreal: {
        name: 'Montreal (Metro)',
        province: 'QC',
        incomeMultiplier: 1.08,
        savingsMultiplier: 1.05,
        housingCostMultiplier: 1.12,
        averageIncome: 61000,
        medianIncome: 52000,
        medianHome: 525000,
        costOfLivingIndex: 102
    },
    
    QC_QuebecCity: {
        name: 'Quebec City',
        province: 'QC',
        incomeMultiplier: 0.98,
        savingsMultiplier: 0.95,
        housingCostMultiplier: 0.85,
        averageIncome: 55000,
        medianIncome: 48000,
        medianHome: 375000,
        costOfLivingIndex: 94
    },
    
    QC_Gatineau: {
        name: 'Gatineau',
        province: 'QC',
        incomeMultiplier: 1.05,
        savingsMultiplier: 1.02,
        housingCostMultiplier: 0.95,
        averageIncome: 59000,
        medianIncome: 51000,
        medianHome: 425000,
        costOfLivingIndex: 98
    },
    
    QC_Rest: {
        name: 'Rest of Quebec',
        province: 'QC',
        incomeMultiplier: 0.88,
        savingsMultiplier: 0.82,
        housingCostMultiplier: 0.68,
        averageIncome: 49000,
        medianIncome: 43000,
        medianHome: 275000,
        costOfLivingIndex: 88
    },

    // Other provinces (province-level)
    MB_Winnipeg: {
        name: 'Winnipeg',
        province: 'MB',
        incomeMultiplier: 0.95,
        savingsMultiplier: 0.90,
        housingCostMultiplier: 0.72,
        averageIncome: 59000,
        medianIncome: 51000,
        medianHome: 375000,
        costOfLivingIndex: 95
    },
    
    MB_Rest: {
        name: 'Rest of Manitoba',
        province: 'MB',
        incomeMultiplier: 0.85,
        savingsMultiplier: 0.78,
        housingCostMultiplier: 0.55,
        averageIncome: 53000,
        medianIncome: 46000,
        medianHome: 285000,
        costOfLivingIndex: 88
    },

    SK_Saskatoon: {
        name: 'Saskatoon',
        province: 'SK',
        incomeMultiplier: 1.02,
        savingsMultiplier: 1.00,
        housingCostMultiplier: 0.75,
        averageIncome: 63000,
        medianIncome: 54000,
        medianHome: 375000,
        costOfLivingIndex: 96
    },
    
    SK_Regina: {
        name: 'Regina',
        province: 'SK',
        incomeMultiplier: 1.00,
        savingsMultiplier: 0.98,
        housingCostMultiplier: 0.72,
        averageIncome: 62000,
        medianIncome: 53000,
        medianHome: 350000,
        costOfLivingIndex: 94
    },
    
    SK_Rest: {
        name: 'Rest of Saskatchewan',
        province: 'SK',
        incomeMultiplier: 0.92,
        savingsMultiplier: 0.88,
        housingCostMultiplier: 0.58,
        averageIncome: 57000,
        medianIncome: 49000,
        medianHome: 275000,
        costOfLivingIndex: 90
    },

    NS_Halifax: {
        name: 'Halifax',
        province: 'NS',
        incomeMultiplier: 0.95,
        savingsMultiplier: 0.88,
        housingCostMultiplier: 1.05,
        averageIncome: 59000,
        medianIncome: 51000,
        medianHome: 525000,
        costOfLivingIndex: 102
    },
    
    NS_Rest: {
        name: 'Rest of Nova Scotia',
        province: 'NS',
        incomeMultiplier: 0.82,
        savingsMultiplier: 0.75,
        housingCostMultiplier: 0.75,
        averageIncome: 51000,
        medianIncome: 44000,
        medianHome: 325000,
        costOfLivingIndex: 92
    },

    NB: {
        name: 'New Brunswick',
        province: 'NB',
        incomeMultiplier: 0.85,
        savingsMultiplier: 0.78,
        housingCostMultiplier: 0.68,
        averageIncome: 53000,
        medianIncome: 46000,
        medianHome: 295000,
        costOfLivingIndex: 90
    },

    PE: {
        name: 'Prince Edward Island',
        province: 'PE',
        incomeMultiplier: 0.82,
        savingsMultiplier: 0.75,
        housingCostMultiplier: 0.88,
        averageIncome: 51000,
        medianIncome: 44000,
        medianHome: 425000,
        costOfLivingIndex: 95
    },

    NL_StJohns: {
        name: "St. John's",
        province: 'NL',
        incomeMultiplier: 0.98,
        savingsMultiplier: 0.92,
        housingCostMultiplier: 0.85,
        averageIncome: 61000,
        medianIncome: 52000,
        medianHome: 375000,
        costOfLivingIndex: 98
    },
    
    NL_Rest: {
        name: 'Rest of Newfoundland',
        province: 'NL',
        incomeMultiplier: 0.85,
        savingsMultiplier: 0.80,
        housingCostMultiplier: 0.62,
        averageIncome: 53000,
        medianIncome: 46000,
        medianHome: 275000,
        costOfLivingIndex: 90
    },

    /**
     * Get regional data by code
     */
    getRegion(code) {
        return this[code] || this.ON_Toronto;
    },

    /**
     * Get adjusted benchmarks for a region
     */
    getRegionalBenchmarks(regionCode, age) {
        const region = this.getRegion(regionCode);
        const baseBenchmarks = BenchmarksV2.getSavingsBenchmark(age);
        
        return {
            median: Math.round(baseBenchmarks.median * region.savingsMultiplier),
            average: Math.round(baseBenchmarks.average * region.savingsMultiplier),
            p25: Math.round(baseBenchmarks.percentiles.p25 * region.savingsMultiplier),
            p75: Math.round(baseBenchmarks.percentiles.p75 * region.savingsMultiplier),
            averageIncome: region.averageIncome,
            medianIncome: region.medianIncome,
            medianHome: region.medianHome,
            costOfLivingIndex: region.costOfLivingIndex,
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
                    id: key,              // Add id field for canada-map.js compatibility
                    code: key,
                    name: region.name,
                    medianIncome: region.medianIncome,
                    medianHome: region.medianHome
                });
            }
        });

        // If no regions, return province-level
        if (regions.length === 0 && this[province]) {
            return [{
                id: province,
                code: province,
                name: this[province].name,
                medianIncome: this[province].medianIncome,
                medianHome: this[province].medianHome
            }];
        }
        
        // Sort by median income (descending)
        return regions.sort((a, b) => b.medianIncome - a.medianIncome);
    },

    /**
     * Alias for getProvincialRegions (used by canada-map.js)
     */
    getRegionsByProvince(province) {
        return this.getProvincialRegions(province);
    },

    /**
     * Get region by province and region code
     */
    getRegion(province, regionCode) {
        // If only one argument, assume it's a region code
        if (regionCode === undefined) {
            regionCode = province;
        }
        return this[regionCode] || this.ON_Toronto;
    }
};
