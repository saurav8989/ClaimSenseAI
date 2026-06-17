import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    // 1. Get search query parameters from URL
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.toLowerCase().trim();

    // 2. Read the local ICD database JSON file
    const dbPath = path.resolve(process.cwd(), 'src/lib/icdDatabase.json');
    
    if (!fs.existsSync(dbPath)) {
      return Response.json(
        { error: 'ICD Database file not found. Run the fetch script first.' },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(dbPath, 'utf8');
    const icdData = JSON.parse(fileContent);

    // 3. If no query is provided, return all 10 conditions
    if (!query) {
      return Response.json({ results: icdData });
    }

    // 4. If query is provided, filter results by title or synonyms
    const filteredResults = icdData.map(condition => {
      // Calculate a basic matching score
      let score = 0;
      
      // Exact title match
      if (condition.title.toLowerCase() === query) {
        score = 1.0;
      } 
      // Partial title match
      else if (condition.title.toLowerCase().includes(query)) {
        score = 0.8;
      } 
      // Synonym matches
      else {
        const matchingSynonym = condition.synonyms.find(synonym => 
          synonym.toLowerCase().includes(query)
        );
        if (matchingSynonym) {
          score = 0.6; // slightly lower confidence for synonym matches
        }
      }

      return { ...condition, confidence: score };
    })
    .filter(item => item.confidence > 0) // keep only matching items
    .sort((a, b) => b.confidence - a.confidence); // sort by confidence descending

    return Response.json({ results: filteredResults });

  } catch (error) {
    console.error('API Error in suggest-icd route:', error);
    return Response.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
