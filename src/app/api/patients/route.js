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

export async function POST(request) {
  try {
    const { id, age } = await request.json();
    if (!id || typeof age !== 'number') {
      return NextResponse.json({ error: "Missing id or invalid age" }, { status: 400 });
    }

    const dbPath = path.resolve(process.cwd(), 'src/lib/patientsDatabase.json');
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const data = fs.readFileSync(dbPath, 'utf8');
    const patients = JSON.parse(data);
    const idx = patients.findIndex(p => p.id.toUpperCase().trim() === id.toUpperCase().trim());
    if (idx === -1) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    patients[idx].age = age;
    fs.writeFileSync(dbPath, JSON.stringify(patients, null, 2), 'utf8');
    return NextResponse.json({ success: true, patient: patients[idx] });
  } catch (error) {
    console.error("Failed to update patient age:", error);
    return NextResponse.json({ error: "Failed to update patient age" }, { status: 500 });
  }
}
