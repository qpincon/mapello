import RgbQuant from 'rgbquant';

const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.82;
const PALETTE_COLORS = 256;
const MAX_OUTPUT_BYTES = 100 * 1024; // 100 KB

export async function processUploadedImage(file: File): Promise<string> {
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        return readAsDataURL(file);
    }

    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    const { width, height } = scaledDimensions(img.naturalWidth, img.naturalHeight, MAX_DIMENSION);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);

    // Color quantization
    const q = new RgbQuant({ colors: PALETTE_COLORS });
    q.sample(canvas);
    const reduced = q.reduce(canvas);
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(reduced);

    // Detect alpha
    let hasAlpha = false;
    for (let i = 3; i < reduced.length; i += 4) {
        if (reduced[i] < 255) { hasAlpha = true; break; }
    }

    ctx.putImageData(imageData, 0, 0);

    const content = hasAlpha
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', JPEG_QUALITY);

    const beforeKB = (file.size / 1024).toFixed(1);
    const afterBytes = Math.round(content.length * 0.75);
    const afterKB = (afterBytes / 1024).toFixed(1);
    console.log(`[imageProcess] ${file.name}: ${beforeKB} KB → ${afterKB} KB (${width}×${height}px, ${hasAlpha ? 'png' : 'jpeg'})`);

    if (afterBytes > MAX_OUTPUT_BYTES) {
        throw new Error(`Image is too large. Please use a smaller or simpler image.`);
    }

    return content;
}

function readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function scaledDimensions(w: number, h: number, max: number): { width: number; height: number } {
    if (w <= max && h <= max) return { width: w, height: h };
    return w >= h
        ? { width: max, height: Math.round(h * max / w) }
        : { width: Math.round(w * max / h), height: max };
}
