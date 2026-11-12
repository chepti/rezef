const MAX_SIDE = 1920;

// תמונה שהודבקה או נגררה: מוקטנת לרוחב מסך ומומרת ל-WEBP, כדי שתיטען מהר במקרן ולא תחרוג ממגבלת הגודל.
// GIF נשאר כמו שהוא (כדי לא לאבד אנימציה).
export async function imageFileToDataUrl(file: File): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("קריאת הקובץ נכשלה"));
    reader.readAsDataURL(file);
  });
  if (file.type === "image/gif") return original;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("הקובץ אינו תמונה תקינה"));
    el.src = original;
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.85);
  // דפדפן שלא יודע לייצא WEBP מחזיר PNG; גם זה מתקבל בשרת.
  return webp.length < original.length || scale < 1 ? webp : original;
}

export function imageFiles(list: FileList | null | undefined): File[] {
  return list ? [...list].filter((f) => /^image\/(png|jpeg|webp|gif)$/.test(f.type)) : [];
}
