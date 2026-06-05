async function main() {
  const startTime = Date.now();
  try {
    const response = await fetch('http://localhost:3000/api/Sales/months');
    const data = await response.json();
    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ API response in ${duration.toFixed(3)}s`);
    if (data.error) {
      console.error('❌ Error:', data.error, data.details);
    } else {
      console.log(`📊 ${data.data?.length} months returned:`);
      data.data?.forEach(m => console.log(`   ${m.year}-${String(m.month).padStart(2,'0')}  →  ${m.count.toLocaleString()} rows`));
    }
  } catch (err) {
    console.error('❌ Fetch failed:', err.message);
  }
}
main();
