async function main() {
  const startTime = Date.now();
  try {
    const response = await fetch('http://localhost:3000/api/Sales/months');
    const duration = (Date.now() - startTime) / 1000;
    const text = await response.text();
    console.log(`Status: ${response.status} | Time: ${duration.toFixed(3)}s`);
    try {
      const data = JSON.parse(text);
      if (data.error) {
        console.error('❌ Error:', data.error, data.details);
      } else {
        console.log(`✅ ${data.data?.length} months returned:`);
        data.data?.forEach(m => console.log(`   ${m.year}-${String(m.month).padStart(2,'0')}  →  ${m.count.toLocaleString()} rows`));
      }
    } catch {
      console.log('Raw response:', text.substring(0, 300));
    }
  } catch (err) {
    console.error('❌ Fetch failed:', err.message);
  }
}
main();
