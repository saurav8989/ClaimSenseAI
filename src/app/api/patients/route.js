import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dbPath = path.resolve(process.cwd(), 'src/lib/patientsDatabase.json');
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json([], { status: 200 });
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    const patients = JSON.parse(data);
    return NextResponse.json(patients);
  } catch (error) {
    console.error("Failed to fetch patients database:", error);
    return NextResponse.json({ error: "Failed to load patients database" }, { status: 500 });
  }
}
