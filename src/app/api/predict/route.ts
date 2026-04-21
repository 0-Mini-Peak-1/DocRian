import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const COLAB_API_URL = process.env.COLAB_API_URL;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // ── Path A: Forward to Colab GPU server ──
    if (COLAB_API_URL) {
      const colabForm = new FormData();
      colabForm.append('file', file);

      const response = await fetch(`${COLAB_API_URL}/predict`, {
        method: 'POST',
        body: colabForm,
      });

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json({ error: `Colab server error: ${err}` }, { status: 500 });
      }

      const result = await response.json();
      return NextResponse.json(result);
    }

    // ── Path B: Local Python fallback ──
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `upload-${Date.now()}-${file.name}`);

    await writeFile(tempFilePath, buffer);

    const pythonScriptPath = path.join(process.cwd(), 'Model', 'predict.py');
    const pythonExecPath = path.join(process.cwd(), '..', '.venv', 'bin', 'python');
    const command = `"${pythonExecPath}" "${pythonScriptPath}" "${tempFilePath}"`;

    try {
      const { stdout } = await execAsync(command);

      try {
        await execAsync(`rm "${tempFilePath}"`);
      } catch (_) { /* ignore */ }

      const outputLines = stdout.trim().split('\n');
      const jsonLine = outputLines.find(line => line.trim().startsWith('{'));
      const result = jsonLine ? JSON.parse(jsonLine) : JSON.parse(stdout.trim());

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json(result);
    } catch (execError: any) {
      try { await execAsync(`rm "${tempFilePath}"`); } catch (_) { /* ignore */ }
      console.error('Python script execution error:', execError);
      return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
