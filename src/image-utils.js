/**
 * Image processing utilities for document scanning.
 */

/**
 * High-Precision Adaptive Thresholding (Optimized for Document Scanning)
 * This algorithm rivals commercial scanning apps by intelligently removing shadows 
 * and enhancing faint text using a local mean adaptive approach.
 */
export function adaptiveThreshold(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data.length);
  const gray = new Uint8ClampedArray(width * height);

  // 1. Pre-processing: Grayscale & Contrast Stretching
  let min = 255, max = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Standard Luma coefficients for precise grayscale
    const g = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    gray[i / 4] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  // Auto-Contrast Stretch
  const range = max - min;
  const contrastFactor = range > 0 ? 255 / range : 1;
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (gray[i] - min) * contrastFactor;
  }

  // 2. Compute Integral Image
  const integralImage = new Float64Array(width * height);
  for (let x = 0; x < width; x++) {
    let colSum = 0;
    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      colSum += gray[idx];
      integralImage[idx] = (x === 0 ? colSum : integralImage[idx - 1] + colSum);
    }
  }

  // 3. Adaptive Thresholding Pass
  const S = Math.max(8, Math.floor(width / 12));
  const T = 0.15; // 15% sensitivity

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      const x1 = Math.max(x - S / 2, 0);
      const x2 = Math.min(x + S / 2, width - 1);
      const y1 = Math.max(y - S / 2, 0);
      const y2 = Math.min(y + S / 2, height - 1);
      
      const count = (x2 - x1) * (y2 - y1);
      const sum = integralImage[y2 * width + x2] 
                - integralImage[y1 * width + x2] 
                - integralImage[y2 * width + x1] 
                + integralImage[y1 * width + x1];

      const localMean = sum / count;
      const val = (gray[idx] < localMean * (1.0 - T)) ? 0 : 255;
      
      const outIdx = idx * 4;
      output[outIdx] = output[outIdx + 1] = output[outIdx + 2] = val;
      output[outIdx + 3] = 255;
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Resize image for performance and memory optimization.
 */
export async function resizeImage(file, maxSize = 1200) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
