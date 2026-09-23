// A temporary account can be issued before its auth is visible at all API edges.
// Retry only 401 responses, not successful writes or arbitrary failures.
const originalFetch=globalThis.fetch;
globalThis.fetch=async function(input,options){
  const address=String(input?.url||input);
  if(!address.startsWith('https://api.cloudflare.com/client/v4/accounts/')||!options?.headers?.Authorization)return originalFetch(input,options);
  for(let n=0;n<4;n++){
    const response=await originalFetch(input,options);
    if(response.status!==401||n===3)return response;
    await response.arrayBuffer();
    console.log('Temporary credentials not yet accepted; bounded auth retry '+(n+1));
    await new Promise(r=>setTimeout(r,[5000,20000,40000][n]));
  }
};
