import { jsPDF } from 'jspdf';

/**
 * PDF Engine for generating construction reports.
 */

export async function generateSinglePdf(project, backgroundImage) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  // 1. Add background image (The Template)
  doc.addImage(backgroundImage, 'JPEG', 0, 0, width, height);

  // 2. Set Font
  doc.setFontSize(10);

  // 3. Draw Form Data (Example coordinates - would need adjustment)
  if (project.type === 'kanryo') {
    doc.text(project.companyName, 20, 50); // Company Name
    doc.text(project.workerName, 20, 60);  // Worker Name
    if (project.formData.content) {
      doc.text(project.formData.content, 20, 100);
    }
  } else if (project.type === 'geppo') {
    doc.text(project.companyName || '', 30, 15);
    if (project.formData.summary) {
      doc.text(project.formData.summary, 15, 40);
    }
  }

  // 4. Handle Receipt Image if present
  if (project.receiptImage) {
    // If user specified location, use it. Otherwise, put it on page 2.
    if (project.receiptPosition) {
        doc.addImage(project.receiptImage, 'JPEG', 
            project.receiptPosition.x, project.receiptPosition.y, 
            project.receiptPosition.scale * 50, project.receiptPosition.scale * 80);
    } else {
        doc.addPage();
        doc.text('添付書類: 領収書', 20, 20);
        doc.addImage(project.receiptImage, 'JPEG', 20, 30, 100, 150);
    }
  }

  return doc;
}

/**
 * Combine multiple projects into one PDF.
 */
export async function generateBulkPdf(projects, templates) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const bg = templates[p.type];
    
    if (i > 0) doc.addPage();
    
    // Draw content (Simplified version of generateSinglePdf logic)
    doc.addImage(bg, 'JPEG', 0, 0, width, height);
    doc.setFontSize(10);
    doc.text(p.companyName || '', 20, 50);
    
    // Add receipt on next page if exists
    if (p.receiptImage) {
        doc.addPage();
        doc.addImage(p.receiptImage, 'JPEG', 20, 30, 100, 150);
    }
  }
  
  return doc;
}
