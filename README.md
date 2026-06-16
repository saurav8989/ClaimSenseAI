# ClaimSenseAI

ClaimSenseAI is an AI-powered Clinical Compliance & Standard Treatment Protocol (STP) validation engine designed for healthcare claim optimization, integrated with the openIMIS system.

It evaluates claims pre-submission or post-submission to ensure clinical validity, adherence to national treatment protocols, and priority routing of high-risk claims for human review.

---

## 🚀 Key Features

1. **Intelligent ICD-to-Service Mapping**
   - Contextual search and mapping of ICD diagnoses to prescribed medications and billed procedures.
   - Validation warning prompts when diagnosis-service combinations are mismatched.

2. **Real-Time STP Compliance Checker**
   - Rule-based evaluation engine validating chronological care pathways against national Standard Treatment Protocols.
   - Computes a dynamic **Care Legitimacy Score** based on deviation penalties.

3. **Risk Scoring Engine**
   - Scoring of anomalies, deviations, and billing errors to flag high-risk claims.

4. **Medical Reviewer Dashboard**
   - Prioritized queue routing based on claim risk.
   - In-depth, visual breakdown of protocol deviations and rules triggered to assist reviewers in making adjudication decisions.

---

## 🛠️ System Architecture

```
            ┌──────────────────────────┐
            │   SERVICE PROVIDER       │
            │ (Doctor / Facility)      │
            └──────────┬───────────────┘
                       ↓
        AI ICD Coding + Claim Builder
                       ↓
                 OPENIMIS SYSTEM
                       ↓
        ┌──────────────────────────┐
        │ CLAIMSENSE AI LAYER      │
        │                          │
        │ 1. Clinical Validation   │
        │ 2. STP Compliance Check  │
        │ 3. Risk Scoring Engine   │
        │ 4. Reviewer Priority     │
        └──────────┬───────────────┘
                       ↓
            MEDICAL REVIEWER DASHBOARD
                       ↓
                  PAYMENT PROCESS
```

---

## 📦 Getting Started

*(Detailed installation and configuration instructions will be added as we build out the code structure.)*
