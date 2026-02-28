# Data Sources & Statistics

## Overview
This calculator uses comprehensive Canadian retirement statistics. Numbers are **estimates** based on patterns from government surveys, bank reports, and financial industry data. Users should verify against latest published sources.

## Retirement Savings by Age

**Sources Referenced:**
- Statistics Canada Family Finances Survey
- Bank of Canada retirement readiness studies
- RBC, TD, BMO annual retirement reports
- RRSP/TFSA contribution data

### Median vs Average Savings

At age 65 (retirement):
- **Median: $480,000** - Half of Canadians have more, half have less
- **Average: $850,000** - Pulled up by high savers
- **25th percentile: $200,000** - Bottom quarter
- **75th percentile: $1,300,000** - Top quarter

**Key Insight:** Most Canadians have far less than the "average" suggests. Median is more realistic.

### Age Progression

| Age | Median | Average | 25th % | 75th % |
|-----|--------|---------|--------|--------|
| 25  | $5K    | $18K    | $1K    | $25K   |
| 30  | $25K   | $58K    | $8K    | $85K   |
| 35  | $55K   | $115K   | $20K   | $165K  |
| 40  | $95K   | $195K   | $35K   | $285K  |
| 45  | $155K  | $305K   | $60K   | $450K  |
| 50  | $235K  | $455K   | $95K   | $650K  |
| 55  | $325K  | $615K   | $135K  | $900K  |
| 60  | $425K  | $775K   | $185K  | $1.15M |
| 65  | $480K  | $850K   | $200K  | $1.30M |

## Income Benchmarks

**Canadian Income Distribution (2024):**
- **25th percentile:** $42,000
- **Median:** $62,000
- **75th percentile:** $95,000
- **90th percentile:** $135,000

### By Age
- Age 25: $43,000 avg
- Age 35: $64,000 avg
- Age 45: $78,000 avg (peak earning years)
- Age 55: $80,000 avg
- Age 65: $38,000 avg (semi-retired)

## Monthly Contributions

**Canadian Savers:**
- **Median:** $485/month (~$5,800/year)
- **Average:** $725/month (~$8,700/year)
- **Recommended:** 15% of gross income

### By Income Bracket
| Income Range | Median Contribution | Average |
|--------------|-------------------|---------|
| Under $50K   | $200/month | $285/month |
| $50K-$75K    | $425/month | $575/month |
| $75K-$100K   | $650/month | $875/month |
| $100K-$150K  | $950/month | $1,350/month |
| Over $150K   | $1,500/month | $2,400/month |

## Retirement Spending

**Actual Canadian Retiree Spending (2024):**

| Lifestyle | Median | Average | Description |
|-----------|--------|---------|-------------|
| Modest    | $32K/year | $35K/year | Basic needs, limited discretionary |
| Average   | $44K/year | $48K/year | What typical retirees spend |
| Comfortable | $58K/year | $62K/year | Above-average, regular travel |
| Affluent  | $85K/year | $95K/year | High-end, frequent travel |

**Rule of Thumb:** Plan for 70% of pre-retirement income

## Regional Data

### Major Cities (Income & Housing)

| City | Median Income | Avg Income | Median Home | COL Index |
|------|--------------|------------|-------------|-----------|
| Vancouver | $64K | $77K | $1.30M | 135 |
| Toronto | $66K | $79K | $1.15M | 128 |
| Calgary | $64K | $75K | $575K | 108 |
| Edmonton | $62K | $73K | $425K | 104 |
| Ottawa | $62K | $73K | $625K | 112 |
| Montreal | $52K | $61K | $525K | 102 |
| Halifax | $51K | $59K | $525K | 102 |

### Regional Multipliers

Savings multipliers adjust national benchmarks:
- **Vancouver/Toronto:** 1.3x (higher incomes = more savings)
- **Calgary/Edmonton:** 1.2x (resource sector wages)
- **Ottawa:** 1.2x (government jobs)
- **Montreal:** 1.05x (lower costs, lower savings)
- **Northern regions:** 0.75-0.85x

Housing cost multipliers vs national average:
- **Vancouver:** 1.95x (highest in Canada)
- **Toronto:** 1.75x
- **Calgary:** 1.08x
- **Montreal:** 1.12x
- **Rural/Northern:** 0.6-0.7x

## CPP & Government Benefits

### CPP (2024)
- **Maximum annual (age 65):** $16,375
- **Average Canadian receives:** ~$9,200/year
- **Start age impact:**
  - Age 60: -36% reduction
  - Age 65: Full amount
  - Age 70: +42% increase

### OAS (2024)
- **Maximum annual:** $8,479
- **Clawback starts:** $90,997 income
- **Fully clawed back:** $142,609+ income

### GIS (Low Income Supplement)
- **Max for singles:** $11,678/year
- **Phase-out:** 50 cents per dollar of income
- **Threshold:** ~$21,600 for singles

## Healthcare Costs in Retirement

**Average Annual Out-of-Pocket (Canadian):**
- Ages 65-74: $3,500/year
- Ages 75-84: $5,500/year
- Ages 85+: $8,500/year

**Breakdown:**
- Prescriptions: 40%
- Dental: 25%
- Vision: 15%
- Other (physio, supplements, hearing aids): 20%

**Provincial Variation:**
- Alberta/Saskatchewan: -10% (better coverage)
- Ontario/BC: Baseline
- Atlantic provinces: +10-12% (limited coverage)

## Important Notes

### These Are Estimates
Numbers are based on:
- Statistical patterns from multiple sources
- Known Canadian demographic trends
- Financial industry published data
- Cost of living indices

### Verify Before Decisions
For major financial decisions:
- Consult latest Statistics Canada data
- Review bank retirement calculators
- Speak with a financial advisor
- Check provincial-specific programs

### Regional Variation
- Toronto ≠ Thunder Bay
- Vancouver ≠ Prince George
- Calgary ≠ Rural Alberta

Calculator adjusts for these differences, but always verify local data.

## How to Update

If you find more accurate data:
1. Edit `benchmarks.js` - update the numbers
2. Edit `regional-data.js` - update multipliers
3. Cite your source in this document
4. Redeploy

The calculator is built to be data-driven - better data = better projections.
