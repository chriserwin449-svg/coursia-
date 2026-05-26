const sharp = require('sharp');

async function processLogo() {
  const input = 'upload/ChatGPT Image 26 mai 2026, 11_18_44.png';
  
  // Get metadata to understand the image
  const meta = await sharp(input).metadata();
  console.log(`Original: ${meta.width}x${meta.height}, ${meta.channels} channels, hasAlpha: ${meta.hasAlpha}`);
  
  // Create a square version by taking the center
  const size = Math.min(meta.width, meta.height);
  const offsetX = Math.round((meta.width - size) / 2);
  const offsetY = Math.round((meta.height - size) / 2);
  
  console.log(`Cropping to ${size}x${size} from offset (${offsetX}, ${offsetY})`);
  
  // Extract and resize to square PNGs
  const sizes = [
    { name: 'public/logo.png', size: 512 },
    { name: 'public/logo-192.png', size: 192 },
    { name: 'public/logo-512.png', size: 512 },
    { name: 'public/favicon.ico', size: 64 },
    { name: 'public/apple-touch-icon.png', size: 180 },
  ];
  
  for (const { name, size } of sizes) {
    await sharp(input)
      .extract({ left: offsetX, top: offsetY, width: size, height: size })
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(name);
    console.log(`✓ Created ${name} (${size}x${size})`);
  }
  
  // Also save a high-res version of the full image for the hero
  await sharp(input)
    .png()
    .toFile('public/logo-hero.png');
  console.log(`✓ Created public/logo-hero.png (${meta.width}x${meta.height})`);
}

processLogo().catch(console.error);
