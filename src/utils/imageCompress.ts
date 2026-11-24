export async function compressImageForFirestore(
  dataUrl: string,
  maxDimension = 720,
  maxBytesLength = 190000
): Promise<string> {
  if (dataUrl.length <= maxBytesLength) {
    return dataUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);

      let quality = 0.82;
      let compressed = canvas.toDataURL('image/jpeg', quality);
      while (compressed.length > maxBytesLength && quality > 0.35) {
        quality -= 0.12;
        compressed = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Failed to load generated image for compression'));
    img.src = dataUrl;
  });
}
