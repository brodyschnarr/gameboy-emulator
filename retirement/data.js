// ═══════════════════════════════════════════
//  Canadian Retirement Data & Constants
// ═══════════════════════════════════════════

const RetirementData = {
    
    // Lifestyle presets (annual spending in retirement)
    lifestyles: {
        modest: {
            name: 'Modest',
            annual: 35000,
            description: 'Simple living, stay close to home',
            breakdown: {
                housing: 12000,
                food: 6000,
                transportation: 3000,
                healthcare: 3000,
                utilities: 2400,
                entertainment: 2000,
                misc: 6600
            }
        },
        comfortable: {
            name: 'Comfortable',
            annual: 60000,
            description: 'Travel occasionally, enjoy hobbies',
            breakdown: {
                housing: 18000,
                food: 9000,
                transportation: 5000,
                healthcare: 4000,
                utilities: 3600,
                entertainment: 6000,
                travel: 8000,
                hobbies: 3000,
                misc: 3400
            }
        },
        luxury: {
            name: 'Luxury',
            annual: 90000,
            description: 'Frequent travel, high-end lifestyle',
            breakdown: {
                housing: 24000,
                food: 12000,
                transportation: 8000,
                healthcare: 6000,
                utilities: 4800,
                entertainment: 10000,
                travel: 15000,
                hobbies: 5000,
                misc: 5200
            }
        }
    },

    // Common retirement activities and their costs
    activities: [
        { id: 'travel-domestic', name: 'Domestic travel (2x/year)', annual: 4000 },
        { id: 'travel-international', name: 'International travel (1x/year)', annual: 8000 },
        { id: 'golf-membership', name: 'Golf club membership', annual: 3500 },
        { id: 'fitness', name: 'Gym / fitness membership', annual: 600 },
        { id: 'cottage', name: 'Cottage / vacation property', annual: 12000 },
        { id: 'dining-out', name: 'Dining out frequently', annual: 3000 },
        { id: 'grandkids', name: 'Supporting grandchildren', annual: 5000 },
        { id: 'hobbies', name: 'Hobbies & crafts', annual: 2000 },
        { id: 'entertainment', name: 'Shows, concerts, events', annual: 2500 },
        { id: 'healthcare-extra', name: 'Private healthcare / dental', annual: 3000 },
        { id: 'pet', name: 'Pet care', annual: 1500 },
        { id: 'home-maintenance', name: 'Home maintenance buffer', annual: 2000 }
    ],

    // Canadian averages (2024 data)
    averages: {
        retirementAge: 64,
        lifeExpectancy: 82,
        householdSavings: 179000, // median Canadian household near retirement
        annualSaving: 6000,       // median annual contribution
        retirementSpending: 50000 // average retiree spending
    },

    // CPP & OAS estimates (2024 rates)
    government: {
        cppMax: 15679,      // max annual CPP (age 65)
        cppAverage: 8108,   // average CPP payment
        oasMax: 8479,       // max annual OAS (age 65)
        oasAverage: 7707    // average OAS (most get full)
    },

    // Tax considerations (simplified)
    tax: {
        // Federal + provincial average effective rates
        brackets: [
            { max: 50000, rate: 0.20 },
            { max: 100000, rate: 0.30 },
            { max: Infinity, rate: 0.40 }
        ]
    }
};
