// Network availability is audited separately by audit-live-vehicle-photos.mjs.
export async function newQaPage(browser,options){
  const page=await browser.newPage(options);
  await page.route(/https:\/\/(?:thumb|upload|commons)\.wikimedia\.org\//,route=>route.fulfill({
    contentType:'image/svg+xml',
    body:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#ddd"/></svg>'
  }));
  return page;
}
