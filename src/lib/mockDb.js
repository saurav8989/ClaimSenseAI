import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'claims_db.json');

function initDb() {
  if (!fs.existsSync(dbPath)) {
    const seedClaims = [];
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
