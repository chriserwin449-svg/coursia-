import ZAI from 'z-ai-web-dev-sdk';

async function main() {
  const zai = await ZAI.create();
  try {
    const results = await zai.functions.invoke('web_search', { query: 'payment gateway DRC Congo mobile money API webhook international 2025', num: 10 });
    if (Array.isArray(results)) {
      results.forEach((item: any, i: number) => {
        console.log(`${i+1}. ${item.name}`);
        console.log(`   URL: ${item.url}`);
        console.log(`   Snippet: ${item.snippet}`);
        console.log('');
      });
    } else {
      console.log(JSON.stringify(results));
    }
  } catch (e: any) {
    console.error('Error:', e?.message || e);
  }
}
main();
