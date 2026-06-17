import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    // 1. Get code parameter from URL query string
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.toUpperCase().trim();

    // 2. Read the local clinicalDictionary.json file
    const dictionaryPath = path.resolve(process.cwd(), 'src/lib/clinicalDictionary.json');

    if (!fs.existsSync(dictionaryPath)) {
      return Response.json(
        { error: 'Clinical Dictionary file not found.' },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(dictionaryPath, 'utf8');
    const dictionaryData = JSON.parse(fileContent);

    // 3. If a specific ICD code is requested, return that condition's protocol
    if (code) {
      const protocol = dictionaryData[code];
      if (!protocol) {
        return Response.json(
          { error: `No clinical protocol found for ICD code: "${code}"` },
          { status: 404 }
        );
      }
      return Response.json(protocol);
    }

    // 4. Otherwise, return the entire dictionary of protocols
    return Response.json(dictionaryData);

  } catch (error) {
    console.error('API Error in protocols route:', error);
    return Response.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
