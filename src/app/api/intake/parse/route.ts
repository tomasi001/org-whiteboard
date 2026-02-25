import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 50_000;

function normaliseText(value: string): string {
  return value
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isTextDocument(fileName: string, mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    /\.(txt|md|markdown|csv|json|yaml|yml|xml|html|log|rtf)$/i.test(fileName)
  );
}

async function extractFileText(file: File): Promise<{ text: string; parser: string }> {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    try {
      const data = await parser.getText();
      return { text: data.text ?? "", parser: "pdf-parse" };
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType.includes("wordprocessingml") ||
    fileName.endsWith(".docx")
  ) {
    const data = await mammoth.extractRawText({ buffer });
    return { text: data.value ?? "", parser: "mammoth" };
  }

  if (isTextDocument(fileName, mimeType)) {
    return { text: buffer.toString("utf-8"), parser: "utf8" };
  }

  throw new Error(
    "Unsupported file type. Upload PDF, DOCX, TXT, Markdown, CSV, or JSON."
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
    }

    if (fileEntry.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large. Maximum supported file size is ${
            MAX_FILE_BYTES / (1024 * 1024)
          }MB.`,
        },
        { status: 413 }
      );
    }

    const { text, parser } = await extractFileText(fileEntry);
    const cleaned = normaliseText(text);

    if (!cleaned) {
      return NextResponse.json(
        { error: "No readable text could be extracted from this file." },
        { status: 422 }
      );
    }

    const truncated = cleaned.length > MAX_TEXT_LENGTH;

    return NextResponse.json({
      fileName: fileEntry.name,
      fileType: fileEntry.type,
      parser,
      extractedText: truncated ? `${cleaned.slice(0, MAX_TEXT_LENGTH)}\n[TRUNCATED]` : cleaned,
      truncated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
