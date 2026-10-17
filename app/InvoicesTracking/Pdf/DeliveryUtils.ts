import jsPDF from 'jspdf';

export function printPdfInSameTab(doc: jsPDF): void {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  iframe.src = url;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    
    const cleanup = () => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      URL.revokeObjectURL(url);
    };

    // Modern browsers support onafterprint (fires when print dialog is closed/printed)
    if (iframe.contentWindow) {
      iframe.contentWindow.onafterprint = () => {
        setTimeout(cleanup, 1000);
      };
    }

    // Fallback cleanup after 5 minutes just in case
    setTimeout(cleanup, 300000);
  };
}
