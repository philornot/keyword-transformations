/**
 * @fileoverview OCR pipeline: extract raw text from uploaded images or PDFs.
 *
 * - Images (JPEG, PNG, WEBP, etc.): processed with Tesseract.js
 * - PDFs: text extracted directly with pdf-parse (works for digitally-created
 *   PDFs); for scanned PDFs the quality depends on the embedded resolution.
 */

import {createWorker} from 'tesseract.js';
import pdfParse from 'pdf-parse';
import {join} from 'path';

/**
 * Extracts raw text from the given file buffer.
 *
 * @param buffer - The raw file bytes.
 * @param mimeType - MIME type of the file (e.g. "image/jpeg", "application/pdf").
 * @returns The extracted plain text string.
 * @throws {Error} If the MIME type is unsupported or OCR fails.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
        return extractTextFromPdf(buffer);
    }

    if (mimeType.startsWith('image/')) {
        return extractTextFromImage(buffer);
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
}

/**
 * Runs Tesseract OCR on an image buffer.
 *
 * @param buffer - Raw image bytes.
 * @returns Recognised text.
 */
async function extractTextFromImage(buffer: Buffer): Promise<string> {
    const worker = await createWorker(['eng', 'pol'], 1, {
        langPath: join(process.cwd()), logger: () => {
        },
    });
    const {data} = await worker.recognize(buffer);
    await worker.terminate();
    return data.text;
}

/**
 * Extracts text from a PDF using pdf-parse.
 * Works best for digitally-created PDFs. For purely scanned PDFs the result
 * may be empty and the caller should fall back to rasterising + OCR.
 *
 * @param buffer - Raw PDF bytes.
 * @returns Extracted text content.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
}