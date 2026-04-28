// Standalone PDF Engine (Global Version)
// Does not use import/export. Depends on window.jspdf

(function() {
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
            if (!src) return reject(new Error(`Image source is undefined or null`));
            
            // Add cache buster
            if (String(src).startsWith('data:')) {
                img.src = src;
            } else {
                const separator = src.includes('?') ? '&' : '?';
                img.src = `${src}${separator}t=${new Date().getTime()}`;
            }
        });
    }

    function drawTextOnCanvas(ctx, text, x, y, width, fontSize, align = 'left', maxLines = 1) {
        ctx.font = `${fontSize}px 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        const chars = String(text).split('');
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
        if (lines.length < maxLines && currentLine !== '') lines.push(currentLine);
        const lineHeight = fontSize * 1.5;
        lines.forEach((line, i) => {
            let drawX = x;
            if (align === 'center') {
                const metrics = ctx.measureText(line);
                drawX = x + (width - metrics.width) / 2;
            }
            ctx.fillText(line, drawX, y + (i * lineHeight));
        });
    }

    window.drawProjectToCanvas = async (project, backgroundImage, config, targetCanvas = null) => {
        const CANVAS_WIDTH = 1754; // Optimized for mobile
        const CANVAS_HEIGHT = 2480;
        const canvas = targetCanvas || document.createElement('canvas');
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext('2d');
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
                    value = (project.formData && project.formData[field.id]) || '';
                }
                const px_x = (field.x / 100) * CANVAS_WIDTH;
                const px_y = (field.y / 100) * CANVAS_HEIGHT;
                const px_width = (field.width / 100) * CANVAS_WIDTH;
                const px_fontSize = (field.fontSize || 12) * (CANVAS_WIDTH / 375);

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

                if (field.id === 'receipt' && project.receiptImage) {
                    const rx_img = await loadImage(project.receiptImage);
                    const frameW = px_width;
                    const frameH = px_width * (field.heightRatio || 1.3);
                    const imgAspect = rx_img.width / rx_img.height;
                    const frameAspect = frameW / frameH;
                    let drawW = (imgAspect > frameAspect) ? frameW : frameH * imgAspect;
                    let drawH = (imgAspect > frameAspect) ? frameW / imgAspect : frameH;
                    ctx.drawImage(rx_img, px_x + (frameW - drawW) / 2, px_y + (frameH - drawH) / 2, drawW, drawH);
                    continue;
                }

                const align = field.align || (['date', 'orderNumber', 'totalAmount'].includes(field.id) ? 'center' : 'left');
                drawTextOnCanvas(ctx, String(value), px_x, px_y, px_width, px_fontSize, align, field.id.includes('content') ? 5 : 1);
            }
        }
        return canvas;
    };

    window.generateSinglePdf = async (project, backgroundImage, config) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const canvas = await window.drawProjectToCanvas(project, backgroundImage, config);
        doc.addImage(canvas.toDataURL('image/jpeg', 0.8), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        return doc;
    };

    window.generateBulkPdf = async (projects, templates, config, onProgress = null) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        for (let i = 0; i < projects.length; i++) {
            if (onProgress) onProgress(i + 1, projects.length);
            if (i > 0) doc.addPage();
            const p = projects[i];
            const bg = templates[p.type];
            try {
                const canvas = await window.drawProjectToCanvas(p, bg, config);
                doc.addImage(canvas.toDataURL('image/jpeg', 0.7), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
                canvas.width = 1; canvas.height = 1; // Cleanup
            } catch (err) {
                console.error(`Page ${i+1} failed:`, err);
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return doc;
    };
})();
