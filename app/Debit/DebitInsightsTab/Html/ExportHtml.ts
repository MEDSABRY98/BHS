import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { toast } from '@/app/Components/Notification';

export async function exportElementToLongPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    // Capture the element using html-to-image
    const imgData = await toPng(element, {
      pixelRatio: 2, // High resolution
      backgroundColor: '#f9fafb', // Match the dashboard background
    });

    // Create an image object to get the dimensions
    const img = new Image();
    img.src = imgData;
    await new Promise((resolve) => (img.onload = resolve));

    // Calculate dimensions
    const pdfWidthMm = 210; // A4 width in mm
    const ratio = img.height / img.width;
    const pdfHeightMm = pdfWidthMm * ratio;

    // Create a PDF with custom height (one long continuous page)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidthMm, pdfHeightMm],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);
    pdf.save(filename);

    toast.success('PDF downloaded successfully!');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    toast.error('Failed to generate PDF.');
  }
}
