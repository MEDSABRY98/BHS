'use client';

export const PDF_PAGE_WIDTH = 1122;
export const PDF_PAGE_HEIGHT = 793;
export const PDF_RENDER_WAIT_MS = 1500;

export function convertColorsToRgb(element: HTMLElement) {
  const properties = [
    'color',
    'backgroundColor',
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'fill',
    'stroke',
  ];

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');

  function toRgb(colorStr: string) {
    if (!colorStr) return colorStr;
    const lower = colorStr.toLowerCase();
    if (
      lower.includes('lab(') ||
      lower.includes('oklch(') ||
      lower.includes('oklab(') ||
      lower.includes('lch(')
    ) {
      if (ctx) {
        try {
          ctx.fillStyle = colorStr;
          return ctx.fillStyle;
        } catch {
          return colorStr;
        }
      }
    }
    return colorStr;
  }

  function processNode(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const computed = window.getComputedStyle(el);
      properties.forEach((prop) => {
        const val = computed[prop as keyof CSSStyleDeclaration] as string;
        if (
          val &&
          (val.includes('lab(') ||
            val.includes('oklch(') ||
            val.includes('oklab(') ||
            val.includes('lch('))
        ) {
          (el.style as any)[prop] = toRgb(val);
        }
      });

      const bg = computed.background;
      if (
        bg &&
        (bg.includes('lab(') ||
          bg.includes('oklch(') ||
          bg.includes('oklab(') ||
          bg.includes('lch('))
      ) {
        const regex = /(?:oklch|oklab|lab|lch)\([^)]+\)/g;
        el.style.background = bg.replace(regex, (match) => toRgb(match));
      }

      const shadow = computed.boxShadow;
      if (
        shadow &&
        (shadow.includes('lab(') ||
          shadow.includes('oklch(') ||
          shadow.includes('oklab(') ||
          shadow.includes('lch('))
      ) {
        const regex = /(?:oklch|oklab|lab|lch)\([^)]+\)/g;
        el.style.boxShadow = shadow.replace(regex, (match) => toRgb(match));
      }
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      processNode(node.childNodes[i]);
    }
  }

  processNode(element);
}

export function createOffScreenContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = `${PDF_PAGE_WIDTH}px`;
  container.style.height = `${PDF_PAGE_HEIGHT}px`;
  container.style.zIndex = '-1000';
  container.style.overflow = 'hidden';
  container.style.backgroundColor = '#ffffff';
  document.body.appendChild(container);
  return container;
}

export async function capturePage(element: HTMLElement): Promise<string> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: PDF_PAGE_WIDTH,
    height: PDF_PAGE_HEIGHT,
    windowWidth: PDF_PAGE_WIDTH,
    windowHeight: PDF_PAGE_HEIGHT,
    onclone: (clonedDoc) => {
      if (clonedDoc.body) {
        convertColorsToRgb(clonedDoc.body);
      }
    },
  });
  return canvas.toDataURL('image/jpeg', 0.95);
}

export function waitForRender(ms = PDF_RENDER_WAIT_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatPeriodLabel(filters: {
  periodPreset: string;
  periodFrom: string;
  periodTo: string;
}): string {
  if (filters.periodPreset === 'trailing12m') return 'Trailing 12 Months';
  if (filters.periodPreset === 'ytd') return 'Year to Date';
  if (filters.periodPreset === 'trailing6m') return 'Last 6 Months';
  if (filters.periodPreset === 'trailing3m') return 'Last 3 Months';
  return `${filters.periodFrom} – ${filters.periodTo}`;
}

export function formatGeneratedDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
