# 💰 Windfall Feature - Complete Guide

**Version:** V5.2  
**Status:** ✅ DEPLOYED  
**Date:** March 2, 2026

---

## What Are Windfalls?

**Windfalls** are one-time financial events that could significantly impact your retirement plan:

- 🏠 **Home Sale** - Downsizing in retirement
- 💼 **Inheritance** - From parents or relatives
- 🚀 **Business Sale** - Selling your company
- 📈 **Stock Options** - Vesting at retirement
- 🎰 **Other** - Legal settlement, lottery, etc.

**Key feature:** Each windfall has a **probability** (0-100%) of occurring.

---

## How It Works

### 1. **Add Windfalls** (Step 1 of Calculator)

After filling out your basic info and income, scroll to the **"One-Time Windfalls"** section:

1. Click **"+ Add Windfall"**
2. Fill out the form:
   - **Name:** e.g., "Home sale" or "Mom's inheritance"
   - **Amount:** Expected pre-tax amount
   - **Year:** When it will occur (e.g., 2035 or age 65)
   - **Probability:** How likely (0-100%)
   - **Tax Treatment:** Taxable or non-taxable
   - **Destination:** Where the money goes (RRSP, TFSA, Non-Reg, or Auto-split)

3. Click **"Add Windfall"**
4. Repeat for multiple windfalls

### 2. **Monte Carlo Randomization**

When you click "Calculate My Plan," the Monte Carlo simulation:

- Runs **1000 scenarios**
- For each scenario, **randomizes whether each windfall occurs** based on probability
- Example: 75% probability = windfall occurs in ~750 of 1000 scenarios

**This gives you realistic success rates that account for uncertainty.**

### 3. **Results Display**

In the **Overview** tab, you'll see:

- **Windfall Summary Card**
  - Total count
  - Total amount (if all occur)
  - **Expected value** (probability-weighted)
  - Average probability
- **List of all windfalls** with amounts and probabilities
- **Note** explaining Monte Carlo randomization

---

## Example Scenarios

### Example 1: Home Sale (High Probability)

```
Name: "Sell house and downsize"
Amount: $500,000
Year: 2035 (age 65)
Probability: 95%
Tax Treatment: Non-taxable (principal residence)
Destination: Auto (TFSA + Non-Reg)
```

**Impact:** In 95% of Monte Carlo scenarios, you get $500K at age 65. Success rate reflects this high likelihood.

### Example 2: Inheritance (Medium Probability)

```
Name: "Inheritance from parents"
Amount: $200,000
Year: 2032 (age 70)
Probability: 50%
Tax Treatment: Non-taxable
Destination: TFSA
```

**Impact:** In 50% of scenarios, you get $200K at age 70. Success rate averages across scenarios with/without inheritance.

### Example 3: Business Sale (Low Probability)

```
Name: "Sell company"
Amount: $1,000,000
Year: 2028 (age 60)
Probability: 30%
Tax Treatment: Taxable
Destination: RRSP + Non-Reg
```

**Impact:** In 30% of scenarios, you get $1M (minus taxes) at age 60. Success rate shows you're likely okay even without it.

---

## Tax Treatment

### Non-Taxable Windfalls
- **Inheritance** - Always non-taxable in Canada
- **Principal residence sale** - Capital gains exemption
- **Life insurance** - Tax-free
- **Lottery winnings** - Tax-free in Canada

### Taxable Windfalls
- **Business sale** - Capital gains tax (~25% effective rate)
- **Stock options** - Taxed as income
- **Investment property sale** - 50% of capital gain taxable
- **Rental income** - Fully taxable

**The calculator applies simplified tax rates** (~30% for taxable windfalls). For precise estimates, consult a tax professional.

---

## Destination Accounts

### Auto (Recommended)
- Automatically splits between TFSA and Non-Registered
- Maximizes tax efficiency
- **Default choice** for most users

### TFSA
- Tax-free growth
- No tax on withdrawals
- Limited by contribution room (~$100K assumed)

### RRSP
- Tax-deferred growth
- Taxable on withdrawal
- Good for large taxable windfalls

### Non-Registered
- Taxable growth (capital gains, dividends)
- Flexible withdrawals
- Use when TFSA/RRSP full

---

## Expected Value

**Expected Value** = probability-weighted average outcome.

**Formula:**
```
Expected Value = Amount × (Probability / 100)
```

**Example:**
- $500K windfall with 75% probability
- Expected value = $500K × 0.75 = **$375K**

**Multiple windfalls:**
- Home sale: $500K × 95% = $475K
- Inheritance: $200K × 50% = $100K
- Business: $1M × 30% = $300K
- **Total expected value: $875K**

**Why it matters:** Helps you understand the "average" outcome across all possible futures.

---

## Best Practices

### 1. **Be Conservative with Probabilities**
- **Don't overestimate** likelihood
- If uncertain, use **50%** as baseline
- **Higher stakes = lower probability**
  - Home sale: 80-95% (you control it)
  - Inheritance: 30-60% (depends on longevity, estate)
  - Business sale: 10-30% (market-dependent)

### 2. **Use Realistic Amounts**
- Research comparable home sales
- Review estate documents for inheritance
- Get business valuations
- **Don't inflate** to make plan work

### 3. **Model Multiple Scenarios**
- Add windfalls with different probabilities
- See how plan performs with/without
- Use **Save Scenario** feature to compare

### 4. **Don't Depend on Low-Probability Windfalls**
- If success rate only works with 20% windfall, **plan is risky**
- Windfalls should **improve** an already-solid plan
- Use them as **upside**, not **foundation**

### 5. **Update Regularly**
- As you get closer to windfall date, update probability
- Adjust amounts based on new information
- Remove windfalls that no longer apply

---

## FAQ

### Q: What if I'm certain a windfall will occur?
**A:** Set probability to **95-100%**. Monte Carlo will treat it as near-certain.

### Q: Can I model windfalls in retirement?
**A:** Yes! Set the year to any age up to life expectancy.

### Q: How does this affect my success rate?
**A:** Higher probability windfalls → higher success rate. Lower probability → less impact.

### Q: Can I add more than 3 windfalls?
**A:** Yes, no limit. Add as many as you want.

### Q: What if the windfall amount changes?
**A:** Click "Edit" on the windfall, update amount, save.

### Q: Can I delete a windfall?
**A:** Yes, click "Delete" next to any windfall.

### Q: What if I enter the wrong year?
**A:** Edit the windfall and update the year.

### Q: How accurate is the tax calculation?
**A:** Simplified (~30% for taxable windfalls). For precision, consult a CPA.

### Q: Does Monte Carlo show which scenarios had windfalls?
**A:** Not in the UI currently, but the success rate includes both with/without scenarios.

### Q: Can I see a scenario comparison (with vs without windfalls)?
**A:** Use the **Save Scenario** feature: save one with windfalls, one without, then compare manually.

---

## Technical Details

### How Monte Carlo Handles Windfalls

For each of the 1000 simulations:

1. **Loop through years** (current age → life expectancy)
2. **Check for windfalls** at current age
3. **Randomize:** `Math.random() * 100 <= probability`
4. **If occurs:**
   - Calculate after-tax amount
   - Add to appropriate account(s)
   - Mark in year data
5. **Continue simulation** with updated balances

**Result:** Success rate reflects average across all 1000 scenarios, some with windfalls, some without.

### Probability Distribution

Example with $500K windfall at 75% probability:

- **~750 scenarios:** Windfall occurs → higher success
- **~250 scenarios:** Windfall doesn't occur → lower success
- **Average success rate:** Weighted across all scenarios

---

## Limitations

### Current Version (V5.2)

**What it does:**
- ✅ Randomizes windfalls by probability
- ✅ Shows expected value
- ✅ Integrates with Monte Carlo
- ✅ Displays summary in results

**What it doesn't do (yet):**
- ❌ Chart visualization of windfall events
- ❌ Detailed scenario breakdown (which sims had windfalls)
- ❌ Precise tax calculations (uses simplified rates)
- ❌ Dynamic TFSA contribution room tracking
- ❌ With/without windfall comparison chart

**Future V6 ideas:**
- Timeline visualization showing windfall events
- Detailed tax integration with `canada-tax.js`
- Scenario comparison: "With all windfalls vs none"
- Export windfall summary to PDF

---

## Use Cases

### 1. **Retirement Home Downsizing**
```
Name: "Sell house, move to condo"
Amount: $400,000
Year: Age 67
Probability: 90%
Tax: Non-taxable
Destination: Auto
```

**Why:** Most retirees downsize. High probability, known timing.

### 2. **Uncertain Inheritance**
```
Name: "Parents' estate"
Amount: $150,000
Year: Age 75 (estimated)
Probability: 40%
Tax: Non-taxable
Destination: TFSA
```

**Why:** Parents might live longer, spend more, leave less. Medium probability, uncertain timing.

### 3. **Business Exit**
```
Name: "Sell business to partner"
Amount: $750,000
Year: Age 62
Probability: 60%
Tax: Taxable
Destination: RRSP + Non-Reg
```

**Why:** Buyout depends on partner's financing, market conditions. Medium probability, some control.

### 4. **Stock Options Vesting**
```
Name: "Company stock vesting"
Amount: $200,000
Year: Age 65
Probability: 85%
Tax: Taxable
Destination: RRSP
```

**Why:** Known vesting schedule, but company performance uncertain. High probability, predictable timing.

---

## Example Calculation

### Scenario Setup
- **Base plan:** Success rate 72% (without windfalls)
- **Windfall 1:** $500K home sale, 90% probability, age 65
- **Windfall 2:** $200K inheritance, 50% probability, age 70

### Monte Carlo Results (1000 sims)

**Scenarios breakdown:**
1. **Both windfalls occur:** ~450 sims (90% × 50% = 45%)
   - Success rate: ~95%
2. **Only home sale:** ~450 sims (90% × 50% = 45%)
   - Success rate: ~85%
3. **Only inheritance:** ~50 sims (10% × 50% = 5%)
   - Success rate: ~75%
4. **Neither:** ~50 sims (10% × 50% = 5%)
   - Success rate: ~70%

**Weighted success rate:** ~87%

**Expected value:**
- Home: $500K × 90% = $450K
- Inheritance: $200K × 50% = $100K
- **Total: $550K expected**

---

## Summary

**Windfall modeling lets you:**
- ✅ Plan for uncertain one-time events
- ✅ See realistic success rates with probability
- ✅ Understand expected value vs best/worst case
- ✅ Make informed decisions about risk

**Best used as:**
- **Upside booster** to an already-solid plan
- **Sensitivity analysis** (how much do I depend on this?)
- **Scenario planning** (what if inheritance comes through?)

**Not a replacement for:**
- Conservative base planning
- Professional financial advice
- Legal/tax consultation

---

**Ready to model your windfalls?**

1. Open calculator: https://brodyschnarr.github.io/gameboy-emulator/retirement/
2. Go to Step 1
3. Scroll to "One-Time Windfalls"
4. Click "+ Add Windfall"
5. Fill out form
6. Calculate and see results!

**Questions? Issues? Let me know!**

—Brody Bot 🎮
