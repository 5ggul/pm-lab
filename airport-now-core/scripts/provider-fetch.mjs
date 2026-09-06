import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);

// Local/CI transport only. Curl's IPv4 connection path avoids runner-specific
// Node connection failures. Never propagate command lines containing service keys.
export async function providerFetch(url) {
  const u=new URL(url);
  if(u.protocol!=='https:'||!['apis.data.go.kr','apihub.kma.go.kr'].includes(u.hostname))throw new Error('INVALID_PROVIDER_URL');
  try {
    const {stdout}=await exec(process.platform==='win32'?'curl.exe':'curl',[
      '-4','--silent','--show-error','--max-time','25','--connect-timeout','10',
      '--write-out','\n%{http_code}',u.href
    ],{maxBuffer:8_500_000,windowsHide:true});
    const i=stdout.lastIndexOf('\n'),status=Number(stdout.slice(i+1));
    return new Response(stdout.slice(0,i),{status});
  }catch{throw new Error('PROVIDER_TRANSPORT_FAILED');}
}
