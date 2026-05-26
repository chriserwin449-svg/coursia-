import sharp from 'sharp';
import fs from 'fs';

async function convertLogo() {
  const src = './public/logo-source.png';
  
  // Generate square logo (crop center, 1024x1024)
  await sharp(src)
    .resize(1024, 1024, { fit: 'cover', position: 'center' })
    .png()
    .toFile('./public/logo.png');
  console.log('✓ Created logo.png (1024x1024)');
  
  // Generate all sizes
  const sizes = [
    { name: 'logo-192.png', size: 192 },
    { name: 'logo-512.png', size: 512 },
    { name: 'favicon.ico', size: 64 },
  ];
  
  for (const { name, size } of sizes) {
    await sharp(src)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png()
      .toFile(`./public/${name}`);
    console.log(`✓ Created ${name} (${size}x${size})`);
  }
  
  // Apple touch icon
  await sharp(src)
    .resize(180, 180, { fit: 'cover', position: 'center' })
    .png()
    .toFile('./public/apple-touch-icon.png');
  console.log('✓ Created apple-touch-icon.png (180x180)');

  // Clean up source
  fs.unlinkSync('./public/logo-source.png');
  console.log('✓ Cleaned up source file');
}

convertLogo().catch(console.error);
