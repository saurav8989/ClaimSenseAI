import { NextResponse } from 'next/server';

// Static mock data representing a combination of claim data and ClaimSense AI analysis.
const mockClaims = [
  {
    claimId: "CLM-10023",
    providerId: "PROV-9082",
    providerName: "Dr. Sarah Jenkins",
    submittedAt: "2026-06-16T14:30:00Z",
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

export async function GET() {
  // Returns the list of mock claims for the dashboard to render
  return NextResponse.json(mockClaims);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { claimId, action } = body; 

    if (!claimId || !action) {
      return NextResponse.json({ error: "Missing claimId or action" }, { status: 400 });
    }

    // In the real system, this would update the OpenIMIS database status.
    // For now, we return a success response mocking that process.
    return NextResponse.json({ 
      success: true, 
      message: `Claim ${claimId} successfully ${action.toLowerCase()}ed.`,
      claimId,
      action
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
