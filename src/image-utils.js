/**
 * Image processing utilities for document scanning.
 */

/**
 * Adaptive Thresholding (Bradley-Roth algorithm)
 * Converts a grayscale image to black and white for a "scanner" look.
 */
export function adaptiveThreshold(imageData, s = 16, t = 18) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data.length);
  const gray = new Uint8ClampedArray(width * height);

  // 1. Convert to grayscale and Apply contrast stretching
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[i / 4] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  // Normalize grayscale (Contrast stretching)
  const range = max - min;
  if (range > 0) {
    for (let i = 0; i < gray.length; i++) {
      gray[i] = ((gray[i] - min) / range) * 255;
    }
  }

  // 2. Integral image
  const integralImage = new Int32Array(width * height);
  for (let i = 0; i < width; i++) {
    let sum = 0;
    for (let j = 0; j < height; j++) {
      const index = j * width + i;
      sum += gray[index];
      if (i === 0) {
        integralImage[index] = sum;
      } else {
        integralImage[index] = integralImage[index - 1] + sum;
      }
    }
  }

  // 3. Thresholding
  const S = Math.floor(width / s);
  const thresholdFactor = (100 - t) / 100;
  
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const index = j * width + i;
      const x1 = Math.max(i - S / 2, 0);
      const x2 = Math.min(i + S / 2, width - 1);
      const y1 = Math.max(j - S / 2, 0);
      const y2 = Math.min(j + S / 2, height - 1);
      const count = (x2 - x1) * (y2 - y1);
      
      const sum = integralImage[Math.floor(y2 * width + x2)] 
                - integralImage[Math.floor(y1 * width + x2)] 
                - integralImage[Math.floor(y2 * width + x1)] 
                + integralImage[Math.floor(y1 * width + x1)];

      // Sharp B&W
      const val = (gray[index] * count < sum * thresholdFactor) ? 0 : 255;
      
      const outIndex = index * 4;
      output[outIndex] = val;
      output[outIndex + 1] = val;
      output[outIndex + 2] = val;
      output[outIndex + 3] = 255;
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
