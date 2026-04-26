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
  const gray = new Uint8Array(width * height);

  // 1. Grayscale Conversion
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = (data[idx] * 77 + data[idx + 1] * 151 + data[idx + 2] * 28) >> 8;
  }

  // 2. Compute Integral Image (1-indexed for robust boundary math)
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  // 3. Adaptive Threshold Pass
  const S = Math.floor(width / 8);
  const T = 0.15;
  const S2 = Math.floor(S / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(1, x - S2 + 1);
      const y1 = Math.max(1, y - S2 + 1);
      const x2 = Math.min(width, x + S2 + 1);
      const y2 = Math.min(height, y + S2 + 1);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = integral[y2 * (width + 1) + x2] 
                - integral[(y1 - 1) * (width + 1) + x2] 
                - integral[y2 * (width + 1) + (x1 - 1)] 
                + integral[(y1 - 1) * (width + 1) + (x1 - 1)];

      const grayVal = gray[y * width + x];
      const val = (grayVal * count < sum * (1.0 - T)) ? 0 : 255;
      
      const idx = (y * width + x) * 4;
      data[idx] = data[idx + 1] = data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  return imageData;
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
