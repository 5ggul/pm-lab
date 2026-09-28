// Public document availability only; no customer data or credentials.
const sources = [
  'https://store.ohou.se/today_deals',
  'https://store.ohou.se/goods/2271162',
  'https://www.11st.co.kr/products/8369421713',
  'https://deal.11st.co.kr/browsing/DealAction.tmall?method=getShockingDealMain'
];
for (const url of sources) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const html = await r.text();
    console.log(JSON.stringify({ url, status: r.status, bytes: html.length, goodsData: html.includes('__NEXT_DATA__'), productData: html.includes('var productPrdInfo') }));
  } catch (e) { console.log(JSON.stringify({ url, error: e.message })); }
}
