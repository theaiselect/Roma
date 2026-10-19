// Compresión de fotos en el móvil: lado mayor 1600 px, JPEG calidad 0,8.

export async function compressImage(file: Blob, maxSide = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // formato que el navegador no sabe decodificar: se guarda tal cual
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
  return out && out.size < file.size ? out : file;
}
