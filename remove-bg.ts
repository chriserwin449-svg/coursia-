import sharp from 'sharp';

async function removeBackground() {
  // The image likely has a white or light background - make it transparent
  // Since we can't do complex background removal, we'll use the PNG as-is
  // but add rounded corners + transparency for the dark UI
  
  const input = await sharp('./public/logo.png').raw().toBuffer();
  const meta = await sharp('./public/logo.png').metadata();
  const { width, height, channels } = meta;
  
  console.log(`Image: ${width}x${height}, ${channels} channels`);
  
  // Create output with alpha channel
  const output = Buffer.alloc(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    const r = input[i * channels];
    const g = input[i * channels + 1];
    const b = input[i * channels + 2];
    
    // Detect white/near-white background (r>240, g>240, b>240)
    // Also detect very light colors as background
    const isWhiteish = (r > 235 && g > 235 && b > 235);
    const isBlackish = (r < 25 && g < 25 && b < 25);
    
    let alpha = 255;
    if (isWhiteish || isBlackish) {
      alpha = 0; // transparent
    }
    
    output[i * 4] = r;
    output[i * 4 + 1] = g;
    output[i * 4 + 2] = b;
    output[i * 4 + 3] = alpha;
  }
  
  await sharp(output, {
    raw: { width, height, channels: 4 },
  }).png().toFile('./public/logo.png');
  
  console.log('✓ Background removed from logo.png');
  
  // Also process other sizes
  const sizes = ['logo-192.png', 'logo-512.png', 'apple-touch-icon.png', 'favicon.ico'];
  for (const name of sizes) {
    const inp = await sharp(`./public/${name}`).raw().toBuffer();
    const m = await sharp(`./public/${name}`).metadata();
    const w = m.width!, h = m.height!, ch = m.channels!;
    const out = Buffer.alloc(w * h * 4);
    
    for (let i = 0; i < w * h; i++) {
      const r = inp[i * ch];
      const g = inp[i * ch + 1];
      const b = inp[i * ch + 2];
      const isBg = (r > 235 && g > 235 && b > 235) || (r < 25 && g < 25 && b < 25);
      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
      out[i * 4 + 3] = isBg ? 0 : 255;
    }
    
    await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(`./public/${name}`);
    console.log(`✓ Background removed from ${name}`);
  }
}

removeBackground().catch(console.error);
