import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm';

/**
 * Creates an image object from a URL/path and waits for it to load.
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Same-origin images don't need anonymous crossOrigin, 
    // and sometimes it causes issues on local dev servers.
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
    
    // Safety check for undefined/null src
    if (!src) return reject(new Error(`Image source is undefined or null`));

    // Add cache buster only if it's not already a data URL
    if (String(src).startsWith('data:')) {
        img.src = src;
    } else {
        const separator = src.includes('?') ? '&' : '?';
        img.src = `${src}${separator}t=${new Date().getTime()}`;
    }
  });
}

/**
 * Draws text on canvas with automatic wrapping and alignment support.
 */
function drawTextOnCanvas(ctx, text, x, y, width, fontSize, align = 'left', maxLines = 1, debug = false) {
  ctx.font = `${fontSize}px 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  const chars = text.split('');
  let lines = [];
  let currentLine = '';

  for (let n = 0; n < chars.length; n++) {
    let testLine = currentLine + chars[n];
    let metrics = ctx.measureText(testLine);
    if (metrics.width > width && n > 0) {
      lines.push(currentLine);
      currentLine = chars[n];
      if (lines.length >= maxLines) break;
    } else {
      currentLine = testLine;
    }
  }
  if (lines.length < maxLines && currentLine !== '') {
    lines.push(currentLine);
  }

  const lineHeight = fontSize * 1.5;

  // Draw Debug Box for the entire field bounds
  if (debug) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, width, lineHeight * maxLines);
    ctx.restore();
  }

  lines.forEach((line, i) => {
    let drawX = x;
    if (align === 'center') {
      const metrics = ctx.measureText(line);
      drawX = x + (width - metrics.width) / 2;
    }
    ctx.fillText(line, drawX, y + (i * lineHeight));
  });
}

/**
 * Draws a project's data onto the canvas. Used for both PDF generation and Editor Preview.
 */
export async function drawProjectToCanvas(project, backgroundImage, config, targetCanvas = null) {
  const CANVAS_WIDTH = 2480;
  const CANVAS_HEIGHT = 3508;
  
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');

  // Clear canvas for preview updates
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const bgImg = await loadImage(backgroundImage);
  ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const typeConfig = config[project.type];
  if (typeConfig && typeConfig.fields) {
    for (const field of typeConfig.fields) {
      let value = '';
      if (['date', 'companyName', 'workerName'].includes(field.id)) {
        value = project[field.id] || '';
      } else {
        value = project.formData[field.id] || '';
      }

      // Coordinates based on percentage of 2480x3508
      const px_x = (field.x / 100) * CANVAS_WIDTH;
      const px_y = (field.y / 100) * CANVAS_HEIGHT;
      const px_width = (field.width / 100) * CANVAS_WIDTH;
      
      const px_fontSize = (field.fontSize || 12) * (CANVAS_WIDTH / 375);
      const isDebug = targetCanvas !== null;

      // Handle Circles (visitCount, status)
      if (field.isCircle) {
        let isSelected = false;
        if (field.id.startsWith('visitCount_')) {
          isSelected = String(project.formData.visitCount) === field.id.split('_')[1];
        } else if (field.id.startsWith('status_')) {
          isSelected = project.formData.completionStatus === field.id.split('_')[1];
        }

        if (isSelected) {
          ctx.beginPath();
          ctx.lineWidth = 10;
          ctx.strokeStyle = '#000000';
          const cx = px_x + (px_width / 2);
          const cy = px_y + (px_fontSize / 2);
          ctx.arc(cx, cy, 60, 0, 2 * Math.PI);
          ctx.stroke();
        }
        continue;
      }

      // Handle Support Names
      if (field.id === 'supportSpot') {
        const supportNames = project.formData.supportName || [];
        if (Array.isArray(supportNames) && supportNames.length > 0) {
          const fontStack = `'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif`;
          ctx.font = `${px_fontSize}px ${fontStack}`;
          ctx.fillStyle = '#000000';
          ctx.textBaseline = 'top';
          
          const totalFieldWidth = px_width;
          let currentX = px_x;
          const nameCount = supportNames.length;
          let gap = nameCount > 1 ? Math.min((totalFieldWidth - (supportNames.length * px_fontSize)) / (nameCount - 1), px_fontSize * 1.5) : 0;
          gap = Math.max(0, gap);
          
          supportNames.forEach(name => {
            ctx.fillText(name, currentX, px_y);
            currentX += ctx.measureText(name).width + gap;
          });
        }
        continue;
      }

      // Handle Multiline Text (Content/Daily Report)
      if (field.id.includes('contentLine') || field.id.includes('dailyLine') || field.id === 'content' || field.id === 'summary') {
        const textValue = field.id.includes('contentLine') ? project.formData.content : 
                          (field.id.includes('dailyLine') ? project.formData.dailyReport : 
                          (field.id === 'content' ? project.formData.content : project.formData.summary));
            
        if (textValue) {
          const segments = textValue.split('\n');
          let currentY = px_y;
          const lineHeight = px_fontSize * 1.5;
          const align = field.align || (field.id.includes('content') ? 'center' : 'left');
          
          segments.forEach(segment => {
            drawTextOnCanvas(ctx, segment, px_x, currentY, px_width, px_fontSize, align, 5, isDebug);
            currentY += lineHeight;
          });
        }
        continue;
      }

      // Handle Receipt Image
      if (field.id === 'receipt') {
        if (project.receiptImage) {
          const rx_img = await loadImage(project.receiptImage);
          const frameW = px_width;
          const frameH = px_width * (field.heightRatio || 1.3);
          const imgAspect = rx_img.width / rx_img.height;
          const frameAspect = frameW / frameH;
          let drawW = (imgAspect > frameAspect) ? frameW : frameH * imgAspect;
          let drawH = (imgAspect > frameAspect) ? frameW / imgAspect : frameH;
          ctx.drawImage(rx_img, px_x + (frameW - drawW) / 2, px_y + (frameH - drawH) / 2, drawW, drawH);
        }
        continue;
      }

      // Default Field Handling
      let val = '';
      if (field.id === 'date') val = project.date || '';
      else if (field.id === 'workerName') val = project.workerName || '';
      else val = project.formData[field.id] || '';

      if (val || isDebug) {
        const align = field.align || (['date', 'orderNumber', 'totalAmount'].includes(field.id) ? 'center' : 'left');
        drawTextOnCanvas(ctx, String(val || (isDebug ? field.label : '')), px_x, px_y, px_width, px_fontSize, align, 1, isDebug);
      }
    }
  }

  return canvas;
}


export async function generateSinglePdf(project, backgroundImage, config) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const canvas = await drawProjectToCanvas(project, backgroundImage, config);
  doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  // Receipt is now drawn on the template at a fixed position defined in config.
  // We no longer add a separate page for it unless explicitly needed.
  return doc;
}

export async function generateBulkPdf(projects, templates, config) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  for (let i = 0; i < projects.length; i++) {
    if (i > 0) doc.addPage();
    const p = projects[i];
    const bg = templates[p.type];
    const canvas = await drawProjectToCanvas(p, bg, config);
    doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }
  return doc;
}
