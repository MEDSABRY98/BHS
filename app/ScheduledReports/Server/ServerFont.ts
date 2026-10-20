// Arabic font (Amiri) for PDFs made on the server — same font as the browser PDFs.
// Downloaded once per server instance and kept in memory.

const FONT_URLS = [
  'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf',
];

let cached: string | null = null;

async function loadFontBase64(): Promise<string> {
  if (cached) return cached;
  let lastError: unknown = null;
  for (const url of FONT_URLS) {
    try {
      const res = await fetch(url, { cache: 'force-cache' } as RequestInit);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');
      cached = base64;
      return base64;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not load the Arabic font');
}

export async function addArabicFontServer(doc: any): Promise<void> {
  const base64 = await loadFontBase64();
  doc.addFileToVFS('Amiri-Regular.ttf', base64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');
}
