'use client';

export const TYPE_BADGE_COLORS: Record<
  string,
  { fillColor: [number, number, number]; textColor: [number, number, number] }
> = {
  Sales: { fillColor: [219, 234, 254], textColor: [29, 78, 216] }, // bg-blue-100 / text-blue-700
  Return: { fillColor: [255, 237, 213], textColor: [194, 65, 12] }, // bg-orange-100 / text-orange-700
  Payment: { fillColor: [220, 252, 231], textColor: [21, 128, 61] }, // bg-green-100 / text-green-700
  'R-Payment': { fillColor: [254, 226, 226], textColor: [185, 28, 28] }, // bg-red-100 / text-red-700
  Discount: { fillColor: [254, 249, 195], textColor: [161, 98, 7] }, // bg-yellow-100 / text-yellow-700
  OB: { fillColor: [243, 232, 255], textColor: [126, 34, 206] }, // bg-purple-100 / text-purple-700
  'Our-Paid': { fillColor: [209, 250, 229], textColor: [6, 95, 70] }, // bg-emerald-100 / text-emerald-800
  'Invoice/Txn': { fillColor: [241, 245, 249], textColor: [51, 65, 85] }, // bg-slate-100 / text-slate-700
};

export async function addArabicFont(doc: any): Promise<void> {
  const fontUrls = [
    'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf',
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf'
  ];

  for (const url of fontUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status ${response.status}`);

      const fontArrayBuffer = await response.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(fontArrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fontBase64 = btoa(binary);

      doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
      doc.setFont('Amiri');

      console.log(`Arabic font loaded from ${url}`);
      return;
    } catch (e) {
      console.warn(`Failed to load font from ${url}`, e);
    }
  }

  throw new Error('Failed to load Arabic font from all sources');
}
