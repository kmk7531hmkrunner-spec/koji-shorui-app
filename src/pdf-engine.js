import { jsPDF } from 'jspdf';

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
    
    // Add cache buster only if it's not already a data URL
    if (src.startsWith('data:')) {
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
    typeConfig.fields.forEach(field => {
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
      
      // Standardize font size relative to CANVAS_WIDTH (reference 375px screen)
      const px_fontSize = (field.fontSize || 12) * (CANVAS_WIDTH / 375);

      // isDebug: Enable red bounding boxes when rendering to a targetCanvas (Editor Preview)
      const isDebug = targetCanvas !== null;

      if (field.isCircle) {
        let isSelected = false;
        if (field.id.startsWith('visitCount_')) {
          isSelected = project.formData.visitCount === field.id.split('_')[1];
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
        } else if (isDebug) {
          // Draw a light circle to help positioning even if not selected
          ctx.beginPath();
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
          const cx = px_x + (px_width / 2);
          const cy = px_y + (px_fontSize / 2);
          ctx.arc(cx, cy, 60, 0, 2 * Math.PI);
          ctx.stroke();
        }
        return;
      }

      // Special Handling for Multiple Support Names (Width-based spacing)
      if (field.id === 'supportSpot') {
        const supportNames = project.formData.supportName || [];
        if (Array.isArray(supportNames) && supportNames.length > 0) {
          const fontStack = `'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif`;
          ctx.font = `${px_fontSize}px ${fontStack}`;
          ctx.fillStyle = '#000000';
          ctx.textBaseline = 'top';
          
          const totalFieldWidth = px_width;
          let currentX = px_x;
          
          // Calculate spacing based on field width
          // If width is small, they bunch up. If wide, they spread out.
          const nameCount = supportNames.length;
          let gap = 0;
          
          if (nameCount > 1) {
              // Calculate total width of all names first
              let totalTextWidth = 0;
              supportNames.forEach(name => {
                  totalTextWidth += ctx.measureText(name).width;
              });
              // Gap is (Available Width - Text Width) / (Number of Gaps)
              gap = (totalFieldWidth - totalTextWidth) / (nameCount - 1);
              // Clamp gap to a minimum of 0 to avoid overlap if width is too small
              gap = Math.max(0, gap);
              // Also clamp to a maximum to avoid crazy spacing
              gap = Math.min(gap, px_fontSize * 2);
          }
          
          supportNames.forEach(name => {
            ctx.font = `${px_fontSize}px ${fontStack}`;
            ctx.fillText(name, currentX, px_y);
            const textWidth = ctx.measureText(name).width || px_fontSize;
            currentX += textWidth + gap;
          });

          if (isDebug) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.strokeRect(px_x, px_y, totalFieldWidth, px_fontSize);
          }
        }
        return;
      }

      // Handling Textareas
      if (field.id === 'field-content' || field.id === 'field-dailyReport' || field.id === 'content' || field.id === 'dailyReport') {
        const textAreaValue = (field.id.includes('content')) ? project.formData.content : project.formData.dailyReport;
            
        if (textAreaValue) {
          let maxLines = 10;
          if (project.type === 'marusan') maxLines = 3;
          else if (field.id === 'dailyReport') maxLines = 4;
          const segments = textAreaValue.split('\n');
          let currentY = px_y;
          const lineHeight = px_fontSize * 1.5;
          const isCenteredFlag = field.id.includes('content');
          
          let lineCount = 0;
          for (let segment of segments) {
            if (lineCount >= maxLines) break;
            drawTextOnCanvas(ctx, segment, px_x, currentY, px_width, px_fontSize, isCenteredFlag ? 'center' : 'left', maxLines - lineCount, isDebug);
            const measuredLines = Math.ceil(ctx.measureText(segment).width / px_width) || 1;
            currentY += measuredLines * lineHeight;
            lineCount += measuredLines;
          }
        } else if (isDebug) {
           // Show empty box for visibility
           ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
           ctx.strokeRect(px_x, px_y, px_width, px_fontSize * 4);
        }
        return;
      }

      // Special Handling for Receipt Image field in Config
      if (field.id === 'receipt') {
        if (project.receiptImage) {
           const rx_img = await loadImage(project.receiptImage);
           const rw = px_width;
           const rh = px_width * (field.heightRatio || 1.3); // Default aspect ratio if not specified
           ctx.drawImage(rx_img, px_x, px_y, rw, rh);
        } else if (isDebug) {
           ctx.strokeStyle = 'rgba(0, 0, 255, 0.4)';
           ctx.strokeRect(px_x, px_y, px_width, px_width * (field.heightRatio || 1.3));
           ctx.font = `40px sans-serif`;
           ctx.fillStyle = 'rgba(0,0,255,0.4)';
           ctx.fillText("領収書位置", px_x + 10, px_y + 10);
        }
        return;
      }

      if (value || isDebug) {
        // Default centering for specific fields, but respect field.align if explicitly set
        const defaultCentered = ['date', 'orderNumber'].includes(field.id);
        const align = field.align || (defaultCentered ? 'center' : 'left');
        
        drawTextOnCanvas(ctx, String(value || field.label), px_x, px_y, px_width, px_fontSize, align, 1, isDebug);
      }
    });
  }

  return canvas;
}


export async function generateSinglePdf(project, backgroundImage, config) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const canvas = await drawProjectToCanvas(project, backgroundImage, config);
  doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  if (project.receiptImage && !project.receiptPosition) {
    doc.addPage();
    doc.addImage(project.receiptImage, 'JPEG', 20, 30, 100, 150);
  }
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
    if (p.receiptImage && !p.receiptPosition) {
      doc.addPage();
      doc.addImage(p.receiptImage, 'JPEG', 20, 30, 100, 150);
    }
  }
  return doc;
}
