// Páginas de un PDF como imágenes (pdf.js, dentro de la app y sin conexión). Así una entrada en PDF se ve
// igual en Android y en iPhone, a pantalla completa y con el QR nítido, sin depender del visor del móvil.

let lib: Promise<typeof import('pdfjs-dist')> | null = null;

async function pdfjs(): Promise<typeof import('pdfjs-dist')> {
  lib ??= (async () => {
    const [m, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    m.GlobalWorkerOptions.workerSrc = worker.default;
    return m;
  })();
  return lib;
}

/** Las primeras `maxPages` páginas, a `width` píxeles de ancho, en JPEG de buena calidad (el QR se lee bien). */
export async function renderPdfPages(file: Blob, maxPages = 4, width = 1600): Promise<Blob[]> {
  const m = await pdfjs();
  const task = m.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const out: Blob[] = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(4, width / base.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const b = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (b) out.push(b);
      page.cleanup();
    }
  } finally {
    void task.destroy();
  }
  return out;
}

export const isPdf = (mime: string, name = ''): boolean => mime === 'application/pdf' || /\.pdf$/i.test(name);
