import { apiFetch, ApiError } from "./apiClient";

export interface ExtractedDocument {
  filename: string;
  page_count: number;
  empty_pages: number[];
  chunk_count: number;
  text: string;
}

export const isPdf = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

/** Sends a PDF to the backend and gets its text back, page by page. Nothing is stored yet (IP-20). */
export const extractPdf = async (file: File): Promise<ExtractedDocument> => {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<ExtractedDocument>("/documents/extract", { method: "POST", body: form });
};

/** Reads an uploaded file as study text: PDFs go through the backend, text files are read here. */
export const readStudyFile = async (file: File): Promise<{ content: string; note?: string }> => {
  if (!isPdf(file)) {
    return { content: await file.text() };
  }
  try {
    const doc = await extractPdf(file);
    const notes: string[] = [];
    if (doc.empty_pages.length) {
      notes.push(
        `${doc.empty_pages.length} of ${doc.page_count} pages look scanned and have no text yet ` +
        `(pages ${doc.empty_pages.slice(0, 10).join(", ")}${doc.empty_pages.length > 10 ? ", …" : ""}). ` +
        "Reading scanned pages is coming soon."
      );
    }
    if (!doc.text.trim()) {
      throw new ApiError(422, "No text could be read from this PDF. It may be fully scanned.");
    }
    if (doc.text.length > 60_000) {
      notes.push("This document is long; AI features currently read its first ~60,000 characters.");
    }
    return { content: doc.text, note: notes.join("\n\n") || undefined };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "Can't reach the IntelliPrep server to read this PDF. Is the backend running?");
  }
};
