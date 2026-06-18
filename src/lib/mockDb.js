import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'claims_db.json');

// Initialize DB with seed data if it doesn't exist
function initDb() {
  if (!fs.existsSync(dbPath)) {
    const seedClaims = [
      {
        claimId: "CLM-10023",
        providerId: "PROV-9082",
        providerName: "Dr. Sarah Jenkins",
        submittedAt: "2026-06-16T14:30:00Z",
        patient: {
          id: "PAT-5542",
          name: "John Doe",
          age: 45,
          gender: "Male"
        },
        diagnoses: [
          {
            code: "K35.8",
            name: "Acute appendicitis",
            isPrimary: true
          }
        ],
        carePathway: [
          {
            stepNumber: 1,
            type: "symptom",
            name: "Severe abdominal pain",
            details: "Patient reports sudden onset of sharp pain in lower right abdomen.",
            timestamp: "2026-06-16T14:05:00Z"
          },
          {
            stepNumber: 2,
            type: "medication",
            code: "RX-AML-5",
            name: "Amlodipine 5mg",
            details: "Oral, once daily",
            cost: 45.00,
            timestamp: "2026-06-16T14:15:00Z"
          }
        ],
        billing: {
          totalClaimedAmount: 45.00
        },
        status: "PENDING_REVIEW",
        clinicalValidation: {
          isValid: false,
          issues: [
            {
              severity: "CRITICAL",
              type: "MISMATCHED_SERVICE",
              message: "Medication Amlodipine (anti-hypertensive) does not match diagnosis of Acute Appendicitis."
            }
          ]
        },
        stpCompliance: {
          isCompliant: false,
          complianceScore: 20,
          protocolName: "Acute Abdomen Standard Treatment Protocol",
          deviations: [
            {
              type: "MISSING_MANDATORY_TEST",
              message: "No ultrasound or CT scan recorded before treatment for acute abdomen.",
              penalty: 40
            }
          ]
        },
        riskScoring: {
          overallRiskScore: 92,
          riskCategory: "HIGH",
          reviewerPriority: 1
        }
      },
      {
        claimId: "CLM-10024",
        providerId: "PROV-1022",
        providerName: "Dr. Alan Grant",
        submittedAt: "2026-06-17T09:15:00Z",
        patient: {
          id: "PAT-1123",
          name: "Ellie Sattler",
          age: 32,
          gender: "Female"
        },
        diagnoses: [
          {
            code: "E11.9",
            name: "Type 2 diabetes mellitus without complications",
            isPrimary: true
          }
        ],
        carePathway: [
          {
            stepNumber: 1,
            type: "diagnostic_test",
            code: "LAB-A1C",
            name: "HbA1c Test",
            details: "Result: 7.2%",
            cost: 25.00,
            timestamp: "2026-06-17T09:10:00Z"
          }
        ],
        billing: {
          totalClaimedAmount: 25.00
        },
        status: "PENDING_REVIEW",
        clinicalValidation: {
          isValid: true,
          issues: []
        },
        stpCompliance: {
          isCompliant: true,
          complianceScore: 100,
          protocolName: "Type 2 Diabetes Management Protocol",
          deviations: []
        },
        riskScoring: {
          overallRiskScore: 15,
          riskCategory: "LOW",
          reviewerPriority: 5
        }
      }
    ];
    fs.writeFileSync(dbPath, JSON.stringify(seedClaims, null, 2), 'utf8');
  }
}

export function getClaims() {
  initDb();
  const data = fs.readFileSync(dbPath, 'utf8');
  return JSON.parse(data);
}

export function getClaimById(claimId) {
  const claims = getClaims();
  return claims.find(c => c.claimId === claimId) || null;
}

export function saveClaim(claim) {
  initDb();
  const claims = getClaims();
  claims.push(claim);
  fs.writeFileSync(dbPath, JSON.stringify(claims, null, 2), 'utf8');
  return claim;
}

export function updateClaimStatus(claimId, status, comments = "") {
  initDb();
  const claims = getClaims();
  const idx = claims.findIndex(c => c.claimId === claimId);
  if (idx !== -1) {
    let resolvedStatus = status.toUpperCase();
    if (resolvedStatus === 'APPROVE') resolvedStatus = 'APPROVED';
    if (resolvedStatus === 'REJECT') resolvedStatus = 'REJECTED';
    if (resolvedStatus === 'MODIFY') resolvedStatus = 'MODIFIED';

    claims[idx].status = resolvedStatus;
    claims[idx].reviewerComments = comments || `Claim ${status.toLowerCase()}ed`;
    claims[idx].reviewedAt = new Date().toISOString();
    fs.writeFileSync(dbPath, JSON.stringify(claims, null, 2), 'utf8');
    return claims[idx];
  }
  return null;
}
