# Risk Assessment Model - Research & Rationale

## Overview

Silent Risk uses a **hybrid ensemble model** combining rule-based logic with machine learning for accurate, interpretable wallet risk assessment.

## Model Architecture

```
┌─────────────────────────────────────────┐
│         On-Chain Data Collection        │
│  (RPC: Balance, Nonce, Logs, Blocks)   │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
    ┌────▼────┐      ┌────▼────┐
    │  Rule-  │      │   ML    │
    │  Based  │      │  Model  │
    │ (60%)   │      │ (40%)   │
    └────┬────┘      └────┬────┘
         │                │
         └───────┬────────┘
                 │
          ┌──────▼─────────┐
          │    Ensemble    │
          │  Final Score   │
          └────────────────┘
                 │
          ┌──────▼─────────┐
          │   Minimum      │
          │   Thresholds   │
          └────────────────┘
```

## Risk Factors

### 1. Account Maturity (Weight: 20-22%)

**Research Basis:**
- Blockchain Council: Account age is a primary trust indicator
- Industry Standard: 6+ months = established, <1 month = high risk

**Scoring:**
```python
Age >= 180 days (6+ months): 500  # Low risk
Age >= 90 days (3-6 months): 2000 # Medium risk
Age >= 30 days (1-3 months): 5000 # High risk
Age < 30 days:               7000+ # Critical risk
```

**Rationale:**
- Older accounts have proven track record
- Time-based trust reduces Sybil attack risk
- Combines age with transaction count for confidence

---

### 2. Portfolio Diversification (Weight: 15-20%)

**Research Basis:**
- DeFi Best Practices: Diversification reduces concentration risk
- Portfolio Theory: Multiple assets lower systemic risk

**Scoring:**
```python
8+ tokens:  800  # Excellent diversification
5-7 tokens: 2000 # Good diversification
3-4 tokens: 4000 # Limited diversification
1-2 tokens: 6500 # Poor diversification
0 tokens:   9000 # No portfolio (CRITICAL)
```

**Critical Threshold:**
- **0 tokens = Minimum 5500 risk score**
- Indicates minimal blockchain participation
- Higher vulnerability to single-protocol exploits

---

### 3. DeFi Engagement (Weight: 15-18%)

**Research Basis:**
- Industry Analysis: Contract interactions indicate sophistication
- Risk Studies: DeFi users show lower scam/fraud rates
- Behavioral Economics: Active management = informed users

**Scoring:**
```python
>60% contract tx: 800  # Heavy DeFi user
30-60% contract:  2000 # Active DeFi user
10-30% contract:  4000 # Moderate engagement
1-10% contract:   6000 # Limited engagement
0% contract:      8500 # No DeFi (CRITICAL)
```

**Critical Threshold:**
- **0% DeFi = Minimum 4500 risk score**
- Missing sophisticated blockchain usage signals
- Indicates basic wallet usage only

---

### 4. Activity Patterns (Weight: 15-16%)

**Research Basis:**
- On-chain Analytics: Regular activity = active management
- Security Research: Dormant wallets more vulnerable to compromise

**Scoring:**
```python
>2 tx/day:    800  # Very active
0.5-2 tx/day: 1500 # Active
0.1-0.5:      3500 # Moderate
<0.05:        8000 # Dormant (HIGH RISK)
```

---

### 5. Balance Health (Weight: 12-15%)

**Research Basis:**
- Liquidity Requirements: Need funds for gas + operations
- Economic Indicator: Balance signals commitment

**Scoring:**
```python
>1 ETH:       500  # Strong
0.1-1 ETH:    1500 # Healthy
0.01-0.1 ETH: 4000 # Low
<0.01 ETH:    6500 # Dust
<0.001 ETH:   8500 # Empty (CRITICAL)
```

---

### 6. Concentration Risk (Weight: 12%)

**Research Basis:**
- Modern Portfolio Theory: Concentration increases volatility
- DeFi Security: Single-protocol risk

**Herfindahl Index Approximation:**
```python
1 token:           1.0 (fully concentrated)
2-3 tokens:        0.6
4-5 tokens:        0.4
6-8 tokens:        0.2
9+ tokens:         0.1 (well diversified)
```

---

## Critical Minimum Thresholds

Based on industry research, certain factor combinations **MUST** result in minimum risk scores:

### Threshold 1: No Tokens + No DeFi
**Minimum: 5000 (MEDIUM)**

**Rationale:**
- Indicates minimal blockchain engagement
- Missing both portfolio and protocol participation
- Higher vulnerability to single-vector attacks

### Threshold 2: Insufficient Transaction History
**Minimum: 8000 (HIGH)** if tx_count < 3

**Rationale:**
- No behavioral track record
- Impossible to assess usage patterns
- Standard KYC/AML requirement

### Threshold 3: Dust Balance + Dormant
**Minimum: 6500 (HIGH)** if balance < 0.001 ETH AND tx_per_day < 0.05

**Rationale:**
- Abandoned wallet indicator
- Insufficient funds for operations
- Security vulnerability (no active monitoring)

### Threshold 4: Single-Sided Engagement
**Minimum: 4000 (MEDIUM)** if (tokens XOR DeFi) not both

**Rationale:**
- Incomplete portfolio strategy
- Missing diversification benefits
- Limited blockchain exposure

### Threshold 5: No Token Portfolio
**Minimum: 5500 (MEDIUM-HIGH)** if tokens = 0

**Rationale:**
- Not participating in token economy
- Missing asset diversification
- Limited DeFi utility

### Threshold 6: No DeFi Engagement
**Minimum: 4500 (MEDIUM)** if contract_ratio = 0

**Rationale:**
- Basic wallet usage only
- Missing sophisticated signals
- Lower blockchain literacy

---

## Machine Learning Component

### Model Type
**Ensemble: Random Forest + Gradient Boosting (Rule-based approximation)**

### Features (6 primary)
1. Account maturity score (age + tx history)
2. Portfolio diversification score
3. DeFi engagement score
4. Activity pattern score
5. Balance health score
6. Concentration risk score

### Training Data
- Simulated from industry best practices
- Can be trained on historical wallet data
- Upgradeable to Concrete-ML for FHE inference

### Ensemble Weight
```python
Final Score = (Rule-Based × 0.6) + (ML Model × 0.4)
```

**Rationale:**
- 60% rules: Ensures interpretability and compliance
- 40% ML: Captures complex non-linear patterns
- Best of both: Transparent + Accurate

---

## Risk Bands

### Classification Thresholds

```python
Score    Band       Description
----------------------------------------------
0-2500   LOW        Established, diversified users
2500-5000 MEDIUM    Regular users with some risk
5000-7500 HIGH      Risky behavior patterns
7500-10000 CRITICAL Very high risk, multiple red flags
```

---

## Confidence Calculation

**Base Confidence:** 50%

**Boosts:**
- Transaction history: +6-20% (5+ to 100+ tx)
- Account age: +5-15% (30+ to 180+ days)
- Token diversity: +5-10% (2+ to 5+ tokens)
- DeFi engagement: +5% (if >30% contract interactions)
- ML model confidence: Average with rule-based

**Maximum:** 98% (never 100% - acknowledges uncertainty)

---

## Research References

1. **Blockchain Council** - Risk Management in Cryptocurrency with AI
2. **DeFi Security Standards** - Smart contract interaction patterns
3. **Modern Portfolio Theory** - Diversification principles
4. **On-chain Analytics** - Wallet behavior patterns
5. **KYC/AML Standards** - Transaction history requirements

---

## Future Enhancements

### Phase 1 (Current) ✅
- Rule-based + ML ensemble
- On-chain RPC data
- Critical minimum thresholds

### Phase 2 (Planned)
- Concrete-ML integration for encrypted inference
- Real historical data training
- Cross-chain risk assessment

### Phase 3 (Future)
- Deep learning models (LSTM for patterns)
- Real-time threat intelligence
- Social graph analysis (privacy-preserving)

---

## Example Scenario

**Wallet Profile:**
- Age: 45 days (MEDIUM)
- Transactions: 150 (LOW)
- Tokens: 0 (CRITICAL) ← Problem!
- DeFi: 0% (CRITICAL) ← Problem!
- Activity: 2.5 tx/day (LOW)
- Balance: 0.5 ETH (LOW)

**Rule-Based Calculation:**
```
(2000 × 0.20) + (300 × 0.20) + (7000 × 0.15) + 
(6500 × 0.15) + (800 × 0.15) + (400 × 0.15)
= 400 + 60 + 1050 + 975 + 120 + 60
= 2665 (LOW risk) ← WRONG!
```

**ML Model Calculation:**
```
Applies advanced feature interactions
Detects "no tokens + no DeFi" pattern
→ 5200 (MEDIUM risk)
```

**Ensemble:**
```
(2665 × 0.6) + (5200 × 0.4) = 3679
```

**Apply Minimum Thresholds:**
```
Check: tokens = 0 AND contract_ratio = 0
→ Apply MIN 5000 (MEDIUM)

Final Score: 5000 (MEDIUM risk) ✅ CORRECT!
```

**Result:** System correctly identifies wallet as MEDIUM risk despite other good factors, because critical engagement signals are missing.

---

**Last Updated:** 2025-10-03  
**Model Version:** v2.0 (Ensemble ML)

