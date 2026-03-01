# User Feedback Implementation Status

## ✅ COMPLETED

1. **Region selector bug** - Fixed "Toronto" showing for all provinces
2. **Progress indicator** - Added "Step X of 5" visual progress bar
3. **Ultra-wealthy tier** - Added $150K single / $200K couple retirement option
4. **Enhanced $ prefix** - Money inputs now show $ in prominent gray box
5. **Southern Ontario region** - Added as separate region option
6. **Couple retirement data** - Updated to $74K after-tax spending
7. **Year breakdown $ + %** - Shows both dollar amounts AND percentages with color labels

## 🚧 IN PROGRESS / REMAINING

### Medium Priority
2. **Regional retirement spending** - Scale retirement averages by location (not just savings/income)
   - Current: Only savings/income scale by region
   - Needed: Retirement spending should also vary (Toronto vs Northern ON)

13. **Year breakdown tooltips** - Already shows $ and % on hover
   - ✅ Partially done - shows in tooltip
   - Could enhance: Make always visible, not just on hover

14. **Auto-run scenarios** - Run scenarios automatically, show as tabs
   - Currently: User manually adds scenarios
   - Needed: Auto-calculate common scenarios (retire early/late, spend more/less) and show as tabs

### Complex Features (Require Significant Work)

4. **Add income sources in Savings step** - Move "additional income" earlier
   - Currently: In Step 4 (Retirement Plan)
   - Requested: Also available in Step 2 (Savings)
   - Note: Might be confusing to have in both places

5. **Contribution allocation flexibility** - Choose % OR $ for each account
   - Currently: % split only (RRSP 60%, TFSA 40%, etc.)
   - Needed: Option to input $ amounts instead (RRSP $500, TFSA $300)

7. **Different retirement ages per person** - Couple mode flexibility
   - Currently: Single retirement age for household
   - Needed: Person 1 retires at 60, Person 2 at 65 (different ages)

8. **Advanced CPP options** - Multiple input methods
   - Currently: Auto-estimated from income
   - Needed:
     - Avg / Min / Max quick buttons
     - Manual input if known
     - Advanced: Multi-salary career path (e.g., $50K for 10 years, then $80K for 20 years)

11. **Granular spending categories** - Mix-and-match lifestyle
   - Currently: Preset lifestyles (Modest/Avg/Comfortable/etc.)
   - Needed: Choose housing from "Comfortable" + food from "Modest" + custom travel budget
   - Very complex - essentially a full spending breakdown builder

12. **Windfalls** - Inheritance + house sale
   - Currently: No way to model one-time income events
   - Needed:
     - Inheritance: Age X, receive $Y
     - House sale: Age X, sell for $Y (maybe minus remaining mortgage)
     - Should add to portfolio at specified age

## DECISION NEEDED

Some features conflict or require UX decisions:

**Savings vs Retirement Plan:**
- User wants "additional income sources" in Savings step
- Currently it's in Retirement Plan step
- Question: Should it be in both? Or just move it earlier?

**Contribution inputs:**
- User wants both % AND $ options
- Question: Toggle between modes? Or always show both?

**Granular spending:**
- Building a full category-by-category spending tool is essentially a new feature
- Question: Is this a V5 feature or should we build it into V4?

## RECOMMENDATIONS

**Ship Now (V4.1):**
- Everything currently completed
- Regional retirement spending (quick to add)
- Auto-run scenarios as tabs (moderate effort)

**Next Release (V4.2):**
- Contribution $ OR % toggle
- Different retirement ages (couple mode)
- Windfalls (inheritance + house sale)

**Future (V5):**
- Advanced CPP career path modeling
- Granular spending category builder
- Move income sources to Savings step

This keeps V4 focused while planning bigger features for V5.

## Current Status

**7 of 14 features completed** (50%)  
**3 moderate features remaining for V4.1**  
**4 complex features deferred to V4.2/V5**

Total time invested so far: ~4 hours  
Estimated time for V4.1 completion: +1.5 hours  
Estimated time for V4.2: +3 hours  
Estimated time for V5: +5 hours
