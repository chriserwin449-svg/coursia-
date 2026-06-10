import ZAI from 'z-ai-web-dev-sdk';

async function main() {
  const zai = await ZAI.create();

  const queries = [
    'payment gateway API webhook mobile money withdrawal DRC Congo Africa 2025',
    'best payment processor international cards API webhook DRC RD Congo mobile money',
    'Paystack Africa DRC Congo mobile money M-Pesa Visa Mastercard API',
    'fintech platform accept international payments withdraw mobile money Congo Kinshasa',
    'Paygops PayTech Africa DRC payment gateway developer API'
  ];

  for (const q of queries) {
    console.log(`\n=== QUERY: ${q} ===\n`);
    try {
      const results = await zai.functions.invoke('web_search', { query: q, num: 10 });
      if (Array.isArray(results)) {
        results.forEach((item: any, i: number) => {
          console.log(`${i+1}. ${item.name}`);
          console.log(`   URL: ${item.url}`);
          console.log(`   Snippet: ${item.snippet}`);
          console.log('');
        });
      } else {
        console.log('Unexpected:', results);
      }
    } catch (e: any) {
      console.error('Error:', e?.message || e);
    }
  }
}

main();
