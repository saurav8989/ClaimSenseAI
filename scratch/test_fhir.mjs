import { claimToFhirBundle, fhirBundleToClaim, claimsListToSearchset, searchsetToClaimsList } from '../src/lib/fhirConverter.js';

// Simple assertion helper
function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    console.error("Actual:", JSON.stringify(actual, null, 2));
    console.error("Expected:", JSON.stringify(expected, null, 2));
    process.exit(1);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

function runTests() {
  console.log("=========================================");
  console.log("    RUNNING FHIR CONVERTER UNIT TESTS    ");
  console.log("=========================================\n");

  const originalClaim = {
    claimId: "CLM-90821",
    providerId: "PROV-9082",
    providerName: "Dr. Ram Prasad Yadav",
    submittedAt: "2026-06-19T10:00:00.000Z",
    patient: {
      id: "PAT-0005",
      name: "Patient Epsilon",
      age: 28.0,
      gender: "Female",
      isPregnant: true,
      isLactating: false
    },
    diagnoses: [
      { code: "1F40.Z", name: "Falciparum Malaria", isPrimary: true }
    ],
    carePathway: [
      {
        stepNumber: 1,
        type: "symptom",
        name: "Fever and chills",
        details: "Pregnant woman presenting with fever",
        timestamp: "2026-06-19T09:45:00.000Z"
      },
      {
        stepNumber: 2,
        type: "diagnostic_test",
        code: "TEST-MAL-RDT",
        name: "Malaria RDT",
        cost: 15,
        details: "RDT performed positive",
        timestamp: "2026-06-19T09:50:00.000Z"
      },
      {
        stepNumber: 3,
        type: "medication",
        code: "MED-AL-ACT",
        name: "Artemether-Lumefantrine (ACT)",
        cost: 30,
        details: "Prescribed AL ACT therapy",
        timestamp: "2026-06-19T09:55:00.000Z"
      }
    ],
    billing: {
      totalClaimedAmount: 45
    },
    status: "PENDING_REVIEW",
    clinicalValidation: {
      isValid: true,
      issues: []
    },
    stpCompliance: {
      isCompliant: true,
      complianceScore: 100,
      protocolName: "Malaria Standard Treatment Protocol",
      deviations: []
    },
    riskScoring: {
      overallRiskScore: 0,
      riskCategory: "LOW",
      riskFlags: [],
      reviewerPriority: 5
    }
  };

  // 1. Test Claim to FHIR Bundle Conversion
  console.log("Converting Claim to FHIR Bundle...");
  const fhirBundle = claimToFhirBundle(originalClaim);
  assertEqual(fhirBundle.resourceType, "Bundle", "Root is a FHIR Bundle");
  assertEqual(fhirBundle.type, "collection", "Bundle type is 'collection'");

  const resources = fhirBundle.entry.map(e => e.resource);
  const patient = resources.find(r => r.resourceType === "Patient");
  const claim = resources.find(r => r.resourceType === "Claim");
  const response = resources.find(r => r.resourceType === "ClaimResponse");

  assertEqual(patient?.id, "PAT-0005", "Patient ID maps correctly");
  assertEqual(patient?.gender, "female", "Gender maps to lowercase");
  assertEqual(claim?.total?.value, 45, "Claim total cost maps correctly");
  assertEqual(response?.outcome, "queued", "Status maps to outcome 'queued'");

  const pregnancyStatus = patient?.extension?.find(e => e.url.endsWith("pregnancyStatus"));
  assertEqual(pregnancyStatus?.valueBoolean, true, "Pregnancy status extension maps correctly");

  // 2. Test FHIR Bundle to Claim Conversion
  console.log("\nConverting FHIR Bundle back to Claim...");
  const reconstructedClaim = fhirBundleToClaim(fhirBundle);

  assertEqual(reconstructedClaim.claimId, originalClaim.claimId, "Reconstructed Claim ID matches");
  assertEqual(reconstructedClaim.patient.id, originalClaim.patient.id, "Reconstructed Patient ID matches");
  assertEqual(reconstructedClaim.patient.isPregnant, originalClaim.patient.isPregnant, "Reconstructed Pregnancy status matches");
  assertEqual(reconstructedClaim.patient.gender, originalClaim.patient.gender, "Reconstructed Patient Gender matches");
  assertEqual(reconstructedClaim.billing.totalClaimedAmount, originalClaim.billing.totalClaimedAmount, "Reconstructed Billed amount matches");
  assertEqual(reconstructedClaim.status, originalClaim.status, "Reconstructed Status matches");
  assertEqual(reconstructedClaim.carePathway.length, originalClaim.carePathway.length, "Reconstructed Pathway length matches");

  // Verify pathway details
  assertEqual(reconstructedClaim.carePathway[0].type, "symptom", "First pathway step is symptom");
  assertEqual(reconstructedClaim.carePathway[1].type, "diagnostic_test", "Second pathway step is diagnostic_test");
  assertEqual(reconstructedClaim.carePathway[1].cost, 15, "Second pathway step cost matches");
  assertEqual(reconstructedClaim.carePathway[2].type, "medication", "Third pathway step is medication");
  assertEqual(reconstructedClaim.carePathway[2].cost, 30, "Third pathway step cost matches");

  // 3. Test Lists to Searchsets
  console.log("\nTesting Searchset mapping for lists...");
  const claimsList = [originalClaim];
  const searchset = claimsListToSearchset(claimsList);
  assertEqual(searchset.resourceType, "Bundle", "Searchset is a Bundle");
  assertEqual(searchset.type, "searchset", "Searchset type is 'searchset'");
  assertEqual(searchset.total, 1, "Searchset total count matches");

  const unpackedList = searchsetToClaimsList(searchset);
  assertEqual(unpackedList.length, 1, "Unpacked list count matches");
  assertEqual(unpackedList[0].claimId, originalClaim.claimId, "Unpacked claim ID matches");

  console.log("\n✅ ALL CONVERTER TESTS PASSED SUCCESSFULLY!");
}

async function runIntegrationTest() {
  console.log("\n=========================================");
  console.log("    RUNNING FHIR API INTEGRATION TESTS   ");
  console.log("=========================================\n");

  const BASE_URL = 'http://localhost:3000/api/openimis/claims';

  // 1. Submit a FHIR Bundle payload
  const fhirBundlePayload = {
    resourceType: "Bundle",
    type: "collection",
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: "PAT-0005",
          name: [{ use: "official", text: "Patient Epsilon" }],
          gender: "female",
          birthDate: "1998-01-01",
          extension: [
            { url: "http://hl7.org/fhir/StructureDefinition/patient-pregnancyStatus", valueBoolean: true },
            { url: "http://hl7.org/fhir/StructureDefinition/patient-lactationStatus", valueBoolean: false }
          ]
        }
      },
      {
        resource: {
          resourceType: "Practitioner",
          id: "PROV-9082",
          name: [{ text: "Dr. Ram Prasad Yadav" }]
        }
      },
      {
        resource: {
          resourceType: "Claim",
          id: "CLM-TEST-FHIR",
          status: "active",
          type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "professional" }] },
          use: "claim",
          patient: { reference: "Patient/PAT-0005" },
          created: new Date().toISOString(),
          provider: { reference: "Practitioner/PROV-9082" },
          diagnosis: [
            {
              sequence: 1,
              diagnosisReference: { reference: "Condition/CLM-TEST-FHIR-diag-0" }
            }
          ],
          item: [
            {
              sequence: 1,
              revenue: { coding: [{ code: "diagnostic" }] },
              productOrService: { coding: [{ system: "http://loinc.org", code: "TEST-MAL-RDT", display: "Malaria RDT" }] },
              net: { value: 15, currency: "NPR" }
            },
            {
              sequence: 2,
              revenue: { coding: [{ code: "pharmacy" }] },
              productOrService: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "MED-AL-ACT", display: "Artemether-Lumefantrine (ACT)" }] },
              net: { value: 30, currency: "NPR" }
            }
          ],
          total: { value: 45, currency: "NPR" }
        }
      },
      {
        resource: {
          resourceType: "Condition",
          id: "CLM-TEST-FHIR-diag-0",
          clinicalStatus: { coding: [{ code: "active" }] },
          code: { coding: [{ system: "http://id.who.int/icd/release/11/mms", code: "1F40.Z", display: "Falciparum Malaria" }] },
          subject: { reference: "Patient/PAT-0005" }
        }
      }
    ]
  };

  console.log("POSTing a FHIR Bundle to /api/openimis/claims...");
  const postRes = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fhirBundlePayload)
  });

  if (!postRes.ok) {
    throw new Error(`POST failed: ${postRes.statusText}`);
  }
  const fhirBundleResponse = await postRes.json();
  assertEqual(fhirBundleResponse.resourceType, "Bundle", "Response is a FHIR Bundle");

  const resources = fhirBundleResponse.entry.map(e => e.resource);
  const claimResponse = resources.find(r => r.resourceType === "ClaimResponse");
  assertEqual(claimResponse?.outcome, "queued", "ClaimResponse outcome is 'queued'");

  // 2. Fetch all claims in searchset FHIR format
  console.log("\nGETting all claims from /api/openimis/claims...");
  const getRes = await fetch(BASE_URL);
  if (!getRes.ok) {
    throw new Error(`GET failed: ${getRes.statusText}`);
  }
  const searchset = await getRes.json();
  assertEqual(searchset.resourceType, "Bundle", "GET response is a FHIR Bundle");
  assertEqual(searchset.type, "searchset", "GET bundle type is 'searchset'");
  console.log(`Successfully verified ${searchset.total} claims in searchset!`);

  // 3. Cleanup: Delete all claims
  console.log("\nDELETEing all claims...");
  const deleteRes = await fetch(BASE_URL, { method: 'DELETE' });
  if (!deleteRes.ok) {
    throw new Error(`DELETE failed: ${deleteRes.statusText}`);
  }
  const outcome = await deleteRes.json();
  assertEqual(outcome.resourceType, "OperationOutcome", "DELETE response is an OperationOutcome");

  console.log("\n✅ ALL FHIR API INTEGRATION TESTS PASSED SUCCESSFULLY!");
}

runTests();
runIntegrationTest().catch(err => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
