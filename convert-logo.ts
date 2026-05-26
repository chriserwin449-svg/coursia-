import sharp from 'sharp';
import fs from 'fs';

async function convertLogo() {
  const svg = fs.readFileSync('./public/logo.svg');
  
  // Generate multiple sizes
  const sizes = [
    { name: 'logo.png', size: 512 },
    { name: 'logo-192.png', size: 192 },
    { name: 'logo-512.png', size: 512 },
    { name: 'favicon.ico', size: 64 },
  ];
  
  for (const { name, size } of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(`./public/${name}`);
    console.log(`✓ Created ${name} (${size}x${size})`);
  }
  
  // Also create apple-touch-icon
  await sharp(svg)
    .resize(180, 180)
    .png()
    .toFile('./public/apple-touch-icon.png');
  console.log('✓ Created apple-touch-icon.png (180x180)');
}

convertLogo().catch(console.error);
