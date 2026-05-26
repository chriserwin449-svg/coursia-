import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function main() {
  const zai = await ZAI.create();
  const img = fs.readFileSync('/home/z/my-project/upload/pasted_image_1779827977318.png');
  const b64 = img.toString('base64');
  
  const res = await zai.chat.completions.createVision({
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Read ALL text in this image exactly as shown. This is a small error bar.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } }
      ]
    }],
    thinking: { type: 'disabled' }
  });
  
  console.log(res.choices[0]?.message?.content);
}

main().catch(console.error);
