const fs = require('fs');
const path = require('path');

// Helper to load environment variables manually from root .env file
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          // Strip surrounding quotes
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          process.env[key] = value.trim();
        }
      });
    }
  } catch (err) {
    console.error('⚠️ Failed to load .env file:', err.message);
  }
}

loadEnv();

const CLIENT_ID = process.env.WHO_CLIENT_ID;
const CLIENT_SECRET = process.env.WHO_CLIENT_SECRET;

// Target clinical conditions we want to index
const TARGET_CONDITIONS = [
  { term: 'Malaria', defaultCode: '1F45', defaultSynonyms: ['fever', 'chills', 'plasmodium', 'shivering', 'malaria'] },
  { term: 'Plasmodium falciparum', defaultCode: '1F40', defaultSynonyms: ['falciparum', 'malaria'] },
  { term: 'Plasmodium vivax', defaultCode: '1F41', defaultSynonyms: ['vivax', 'malaria'] },
  { term: 'Plasmodium malariae', defaultCode: '1F42', defaultSynonyms: ['malariae', 'malaria'] },
  { term: 'Plasmodium ovale', defaultCode: '1F43', defaultSynonyms: ['ovale', 'malaria'] },
  { term: 'Congenital malaria', defaultCode: 'KA64.2', defaultSynonyms: ['congenital', 'baby', 'malaria'] },
  { term: 'Essential Hypertension', defaultCode: 'BA00.Z', defaultSynonyms: ['high blood pressure', 'elevated bp', 'headache', 'dizziness', 'hypertension'] },
  { term: 'Type 2 Diabetes Mellitus', defaultCode: '5A11', defaultSynonyms: ['diabetes', 'sugar', 'high glucose', 'thirst', 't2dm'] },
  { term: 'Dengue Fever', defaultCode: '1D2Z', defaultSynonyms: ['fever', 'chills', 'mosquito', 'platelets', 'headache', 'joint pain', 'dengue'] },
  { term: 'Pneumonia', defaultCode: 'CA40.Z', defaultSynonyms: ['cough', 'fever', 'shortness of breath', 'difficulty breathing', 'chest pain', 'pneumonia'] }
];

async function getAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID === 'your_client_id_here') {
    throw new Error('Missing or placeholder Client ID / Client Secret in .env');
  }

  const tokenUrl = 'https://icdaccessmanagement.who.int/connect/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'icdapi_access'
  });

  console.log('🔑 Authenticating with WHO ICD Access Management...');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Authentication failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function fetchFromWhoApi(token) {
  console.log('📡 Connected to WHO ICD-11 API. Fetching target codes...');
  const database = [];
  const addedCodes = new Set();

  for (const condition of TARGET_CONDITIONS) {
    const searchUrl = `https://id.who.int/icd/release/11/2026-01/mms/search?q=${encodeURIComponent(condition.term)}`;
    console.log(`🔎 Searching WHO ICD-11 for: "${condition.term}"...`);

    try {
      const res = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'API-Version': 'v2',
          'Accept': 'application/json',
          'Accept-Language': 'en'
        }
      });

      if (!res.ok) {
        throw new Error(`WHO API responded with status ${res.status}`);
      }

      const searchResult = await res.json();
      
      // Parse search results
      if (searchResult.destinationEntities && searchResult.destinationEntities.length > 0) {
        console.log(`  Found ${searchResult.destinationEntities.length} matching entities for "${condition.term}"`);
        searchResult.destinationEntities.forEach(match => {
          const code = match.theCode;
          if (!code) return; // skip intermediate node entries without a specific code

          const title = match.title.replace(/<[^>]*>/g, ''); // strip HTML tags
          
          // Parse synonyms from search highlight PVs
          const synonymsSet = new Set(condition.defaultSynonyms);
          if (match.matchingPVs) {
            match.matchingPVs.forEach(pv => {
              if (pv.label) {
                const cleanPv = pv.label.replace(/<[^>]*>/g, '').toLowerCase().trim();
                if (cleanPv.length > 2) synonymsSet.add(cleanPv);
              }
            });
          }

          if (!addedCodes.has(code)) {
            addedCodes.add(code);
            database.push({
              code: code,
              title: title,
              synonyms: Array.from(synonymsSet)
            });
            console.log(`  ✅ Indexed: ${code} - ${title}`);
          }
        });
      } else {
        throw new Error(`No entities found for "${condition.term}"`);
      }
    } catch (err) {
      console.warn(`⚠️ Warning: Failed to fetch "${condition.term}" from WHO API: ${err.message}. Using default local seeds.`);
      if (!addedCodes.has(condition.defaultCode)) {
        addedCodes.add(condition.defaultCode);
        database.push({
          code: condition.defaultCode,
          title: condition.term,
          synonyms: condition.defaultSynonyms
        });
      }
    }
  }

  return database;
}

function fallbackSeeding() {
  console.log('📦 Seeding local database with pre-configured default values (Offline Mode)...');
  return TARGET_CONDITIONS.map(condition => ({
    code: condition.defaultCode,
    title: condition.term,
    synonyms: condition.defaultSynonyms
  }));
}

async function main() {
  let finalDatabase = [];

  try {
    const token = await getAccessToken();
    finalDatabase = await fetchFromWhoApi(token);
  } catch (err) {
    console.log(`ℹ️ Info: API fetching skipped/failed (${err.message}). Using local cache seeds.`);
    finalDatabase = fallbackSeeding();
  }

  // Ensure target folder exists
  const outputDir = path.resolve(__dirname, '../src/lib');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'icdDatabase.json');
  fs.writeFileSync(outputPath, JSON.stringify(finalDatabase, null, 2), 'utf8');

  console.log(`\n🎉 Local ICD database successfully saved to:`);
  console.log(`👉 ${outputPath}\n`);
  console.log(`Indexed ${finalDatabase.length} clinical conditions.`);
}

main();
