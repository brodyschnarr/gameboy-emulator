// ═══════════════════════════════════════════
//  Lifestyle Data with Detailed Breakdowns
// ═══════════════════════════════════════════

const LifestyleData = {
    
    modest: {
        name: 'Modest',
        annual: 35000,
        tagline: 'Simple, frugal retirement with the basics covered',
        breakdown: {
            housing: { monthly: 800, annual: 9600, description: 'Paid-off smaller home, property tax, utilities, minimal maintenance' },
            food: { monthly: 400, annual: 4800, description: 'Groceries, cook at home, rare dining out' },
            transportation: { monthly: 150, annual: 1800, description: '1 older car or public transit, insurance, gas, basic maintenance' },
            healthcare: { monthly: 150, annual: 1800, description: 'Basic prescription coverage, dental checkups' },
            travel: { monthly: 125, annual: 1500, description: 'Visiting family, 1-2 road trips/year, camping' },
            entertainment: { monthly: 150, annual: 1800, description: 'Streaming services, library, parks, free activities' },
            misc: { monthly: 200, annual: 2400, description: 'Clothing, gifts, household items' }
        },
        examples: [
            'Paid-off bungalow in smaller town',
            'Home-cooked meals, gardening',
            'One 10-year-old sedan',
            'Annual visit to kids, maybe a camping trip',
            'TV, reading, walking, community events',
            'Minimal discretionary spending'
        ]
    },

    average: {
        name: 'Canadian Average',
        annual: 48000,
        tagline: 'What most Canadian retirees actually spend',
        breakdown: {
            housing: { monthly: 1200, annual: 14400, description: 'Paid-off home, property tax $3K/year, utilities $200/month, maintenance fund' },
            food: { monthly: 600, annual: 7200, description: 'Groceries $450/month + dining out 2-3x/month' },
            transportation: { monthly: 300, annual: 3600, description: '1 paid-off car, insurance $150/month, gas, repairs' },
            healthcare: { monthly: 200, annual: 2400, description: 'Prescriptions, dental, vision, supplements' },
            travel: { monthly: 250, annual: 3000, description: '1-2 domestic trips/year, 1 international every 2-3 years' },
            entertainment: { monthly: 300, annual: 3600, description: 'Streaming, outings, hobbies, occasional concerts/sports' },
            misc: { monthly: 400, annual: 4800, description: 'Gifts, clothing, home improvements, pets' }
        },
        examples: [
            '2-3 bedroom home in suburbs',
            'Groceries + eating out weekly',
            'One reliable sedan (5-8 years old)',
            'Annual trip to BC/Florida + visiting grandkids',
            'Netflix, golf occasionally, book club',
            'Comfortable but not extravagant'
        ]
    },

    comfortable: {
        name: 'Comfortable',
        annual: 60000,
        tagline: 'Above-average retirement, regular travel and hobbies',
        breakdown: {
            housing: { monthly: 1500, annual: 18000, description: 'Nice home, property tax $4K/year, utilities $250/month, regular upgrades' },
            food: { monthly: 800, annual: 9600, description: 'Quality groceries + dining out weekly, wine with dinner' },
            transportation: { monthly: 500, annual: 6000, description: 'Newer car (2-5 years old), maybe 2 vehicles, full coverage insurance' },
            healthcare: { monthly: 300, annual: 3600, description: 'Good extended health, dental, massage, preventive care' },
            travel: { monthly: 500, annual: 6000, description: '2-3 trips/year, 1 international annually (Europe, Caribbean)' },
            entertainment: { monthly: 500, annual: 6000, description: 'Golf membership, hobbies, concerts, theatre, nice camera/gear' },
            misc: { monthly: 600, annual: 7200, description: 'Gifts for grandkids, home décor, nicer clothing, tech upgrades' }
        },
        examples: [
            '3-4 bedroom home in nice neighborhood',
            'Organic produce, restaurants 2x/week',
            'SUV + sedan, both newer models',
            'Winter in Arizona, summer road trip, Europe every 2 years',
            'Golf club, woodworking, gardening, season tickets',
            'Help kids financially, spoil grandkids'
        ]
    },

    luxury: {
        name: 'Luxury',
        annual: 90000,
        tagline: 'High-end retirement, frequent travel, premium everything',
        breakdown: {
            housing: { monthly: 2500, annual: 30000, description: 'Upscale home, condo fees/tax $6K+/year, utilities, regular renovations' },
            food: { monthly: 1200, annual: 14400, description: 'Premium groceries, fine dining 2-3x/week, wine collection' },
            transportation: { monthly: 800, annual: 9600, description: 'Luxury vehicles (leased or new), premium insurance, detailing' },
            healthcare: { monthly: 500, annual: 6000, description: 'Premium coverage, private clinic, wellness programs, spa' },
            travel: { monthly: 1250, annual: 15000, description: '3-4 international trips/year, business class, resorts, cruises' },
            entertainment: { monthly: 1000, annual: 12000, description: 'Multiple memberships (golf, yacht, country club), expensive hobbies' },
            misc: { monthly: 1000, annual: 12000, description: 'Designer clothes, luxury goods, generous gifts, latest tech' }
        },
        examples: [
            'Waterfront condo or executive home',
            'Whole Foods, steakhouses, private chef occasionally',
            'Tesla + Lexus, detailed monthly',
            'Italy in spring, Caribbean in winter, Alaska cruise, European river cruise',
            'Private golf club, sailing, photography (Leica), wine tastings',
            'Help kids buy homes, lavish gifts for family'
        ]
    }
};

    ultrawealthy: {
        name: 'Ultra-Wealthy',
        annual: 150000,
        tagline: 'Top 5% lifestyle, unlimited travel, luxury everything',
        breakdown: {
            housing: { monthly: 4000, annual: 48000, description: 'Luxury condo or estate, property tax $8K+/year, high-end maintenance, second home' },
            food: { monthly: 2000, annual: 24000, description: 'Fine dining 4-5x/week, premium groceries, private chef occasionally, wine cellar' },
            transportation: { monthly: 1500, annual: 18000, description: 'Multiple luxury vehicles (lease), premium insurance, chauffeur occasionally' },
            healthcare: { monthly: 800, annual: 9600, description: 'Concierge medicine, private clinic, wellness retreats, preventive care' },
            travel: { monthly: 2500, annual: 30000, description: '4-6 international trips/year, business/first class, 5-star resorts, exotic destinations' },
            entertainment: { monthly: 1500, annual: 18000, description: 'Exclusive memberships (golf, yacht, country club), expensive hobbies, art collecting' },
            misc: { monthly: 1700, annual: 20400, description: 'Designer wardrobe, luxury goods, philanthropic giving, family gifts, concierge services' }
        },
        examples: [
            'Waterfront penthouse or luxury estate + vacation property',
            'Michelin-star dining regularly, sommelier, private chef',
            'Porsche + Range Rover, both leased, detailed monthly',
            'Patagonia hiking, Maldives resorts, African safari, European tours, Antarctica cruise',
            'Private golf club, sailing/yachting, art collecting, wine investment',
            'Generous gifting to family, charitable foundation, concierge healthcare'
        ]
    }
};
