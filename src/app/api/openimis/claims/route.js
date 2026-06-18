import { NextResponse } from 'next/server';

// In-memory mock claims data
const mockClaims = [
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

// Attempt to dynamically load Developer 2's validation engines.
// If they are not yet created, we fall back gracefully to stub logic.
let validateClinicalServices = null;
let evaluateStpCompliance = null;
let calculateRiskScore = null;

try {
  const clinicalValidator = require('@/lib/clinicalValidator');
  validateClinicalServices = clinicalValidator.validateClinicalServices;
} catch (e) {}

try {
  const stpEngine = require('@/lib/stpEngine');
  evaluateStpCompliance = stpEngine.evaluateStpCompliance;
} catch (e) {}

try {
  const riskScorer = require('@/lib/riskScorer');
  calculateRiskScore = riskScorer.calculateRiskScore;
} catch (e) {}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const claimId = searchParams.get('claimId');

    if (claimId) {
      const claim = mockClaims.find(c => c.claimId === claimId);
      if (!claim) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }
      return NextResponse.json(claim);
    }

    return NextResponse.json(mockClaims);
  } catch (error) {
    console.error("GET claims error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { claimId, action, comments } = body;

    // A. Adjudication Flow (Invoked by Reviewer Dashboard)
    if (claimId && action) {
      const idx = mockClaims.findIndex(c => c.claimId === claimId);
      if (idx === -1) {
        return NextResponse.json({ error: `Claim ${claimId} not found` }, { status: 404 });
      }

      let status = action.toUpperCase();
      if (status === 'APPROVE') status = 'APPROVED';
      if (status === 'REJECT') status = 'REJECTED';
      if (status === 'MODIFY') status = 'MODIFIED';

      mockClaims[idx].status = status;
      mockClaims[idx].reviewerComments = comments || `Claim ${action.toLowerCase()}ed`;
      mockClaims[idx].reviewedAt = new Date().toISOString();

      return NextResponse.json({
        success: true,
        message: `Claim ${claimId} successfully ${action.toLowerCase()}ed.`,
        claimId,
        action,
        claim: mockClaims[idx]
      });
    }

    // B. Claim Submission Flow (Invoked by Doctor Portal)
    const generatedId = `CLM-${Math.floor(10000 + Math.random() * 90000)}`;
    const submittedAt = new Date().toISOString();

    const newClaim = {
      ...body,
      claimId: generatedId,
      submittedAt,
      status: "PENDING_REVIEW"
    };

    // 1. Run Clinical & STP Validation (or use mock stubs if Dev 2's code isn't ready)
    let clinicalValidation = { isValid: true, issues: [] };
    let stpCompliance = { isCompliant: true, complianceScore: 100, protocolName: "General Consultation Protocol", deviations: [] };
    let riskScoring = { overallRiskScore: 0, riskCategory: "LOW", reviewerPriority: 5 };

    if (validateClinicalServices && evaluateStpCompliance && calculateRiskScore) {
      clinicalValidation = validateClinicalServices(newClaim);
      stpCompliance = evaluateStpCompliance(newClaim);
      riskScoring = calculateRiskScore(clinicalValidation, stpCompliance, newClaim);
    } else {
      // Mock Fallback Logic for early stage parallel testing
      const primaryDiag = newClaim.diagnoses?.find(d => d.isPrimary) || newClaim.diagnoses?.[0];
      const code = primaryDiag?.code || "UNKNOWN";

      // If Malaria code (starts with 1F4) and no Rapid Test or microscopy is present, trigger a penalty
      if (code.startsWith("1F4")) {
        const hasTest = newClaim.carePathway?.some(step => step.code === "TEST-MAL-RDT" || step.code === "TEST-MAL-MIC");
        if (!hasTest) {
          stpCompliance = {
            isCompliant: false,
            complianceScore: 60,
            protocolName: "Malaria Standard Treatment Protocol",
            deviations: [{ type: "TEST_REQUIRED", message: "Prescribing antimalarials requires a prior diagnostic verification (RDT or Microscopy).", penalty: 40 }]
          };
          riskScoring = { overallRiskScore: 40, riskCategory: "MEDIUM", reviewerPriority: 3 };
        }
      }
      
      // If Diabetes (starts with 5A11) and medication Metformin is added without test
      if (code.startsWith("5A11")) {
        const hasTest = newClaim.carePathway?.some(step => step.type === 'diagnostic_test');
        if (!hasTest) {
          stpCompliance = {
            isCompliant: false,
            complianceScore: 60,
            protocolName: "Type 2 Diabetes Mellitus Standard Treatment Protocol",
            deviations: [{ type: "TEST_REQUIRED", message: "Prescribing anti-diabetic medication requires prior HbA1c/FPG testing.", penalty: 40 }]
          };
          riskScoring = { overallRiskScore: 40, riskCategory: "MEDIUM", reviewerPriority: 3 };
        }
      }
    }

    newClaim.clinicalValidation = clinicalValidation;
    newClaim.stpCompliance = stpCompliance;
    newClaim.riskScoring = riskScoring;

    // Automatically auto-approve low-risk claims
    if (riskScoring.overallRiskScore <= 30) {
      newClaim.status = "APPROVED";
    }

    mockClaims.push(newClaim);

    return NextResponse.json(newClaim);
  } catch (error) {
    console.error("POST claims error:", error);
    return NextResponse.json({ error: "Invalid request body or server error" }, { status: 400 });
  }
}
