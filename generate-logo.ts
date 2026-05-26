import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function generateLogo() {
  console.log('Initializing AI SDK...');
  const zai = await ZAI.create();
  
  console.log('Generating logo...');
  const response = await zai.images.generations.create({
    prompt: 'Minimalist modern app logo icon, a stylized letter C, vibrant purple to violet gradient, neon glow effect, on dark transparent background, clean geometric design, simple bold professional, vector-like, tech startup, no text no extra elements',
    size: '1024x1024'
  });

  const imageBase64 = response.data[0].base64;
  const buffer = Buffer.from(imageBase64, 'base64');
  fs.writeFileSync('./public/logo.png', buffer);
  
  console.log(`Logo saved! Size: ${buffer.length} bytes`);
}

generateLogo().catch(console.error);
