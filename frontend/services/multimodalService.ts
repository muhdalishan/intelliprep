import { apiFetch } from "./apiClient";

export interface DiagramExplanation {
  title: string;
  kind: "diagram" | "equation" | "graph" | "notes" | "other";
  summary: string;
  steps: string[];
  equations: { latex: string; meaning: string }[];
  key_terms: string[];
}

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This file isn't an image the browser can open.")); };
    img.src = url;
  });

const drawScaled = (img: HTMLImageElement, maxSide: number) => {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs become white, not black, as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/**
 * Phone photos are often 3–8 MB. Shrinking to about 2,000 px on the long side keeps the text
 * readable for the AI while making the upload fast on mobile data. Also returns a small thumbnail.
 */
export const prepareImage = async (file: File) => {
  const img = await loadImage(file);
  const full = drawScaled(img, 2000);
  const blob = await new Promise<Blob>((resolve, reject) =>
    full.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't prepare the image."))), "image/jpeg", 0.88)
  );
  const thumbnail = drawScaled(img, 240).toDataURL("image/jpeg", 0.7);
  return { blob, thumbnail };
};

export const explainImage = (image: Blob, subject: string, question?: string) => {
  const form = new FormData();
  form.append("image", image, "photo.jpg");
  form.append("subject", subject);
  if (question?.trim()) form.append("question", question.trim());
  return apiFetch<DiagramExplanation>("/multimodal/explain", { method: "POST", body: form });
};
