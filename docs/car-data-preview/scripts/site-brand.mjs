import {siteConfig} from './site-config.mjs';

export const brandName='픽마이카';
export function brandHtml(html,prefix='./',home=false){
  html=html.replaceAll('내차데이터',brandName);
  html=html.replace(/(<a\b[^>]*class="db-logo"[^>]*>)[\s\S]*?<\/a>/g,(_,open)=>`${open}<img class="site-brand-image" src="${prefix}assets/brand/peekmycar-logo.png" width="180" height="60" alt="픽마이카"></a>`);
  html=html.replace(/<link\b(?=[^>]*rel="(?:icon|shortcut icon|apple-touch-icon)")[^>]*>/g,'');
  html=html.replace(/<meta\b(?=[^>]*property="og:site_name")[^>]*>/g,'');
  html=html.replace('</head>',`<link rel="icon" type="image/png" sizes="96x96" href="${prefix}assets/brand/favicon-96.png"><link rel="apple-touch-icon" sizes="180x180" href="${prefix}assets/brand/apple-touch-icon.png"><meta property="og:site_name" content="픽마이카"></head>`);
  if(home){
    html=html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(_,open,raw,close)=>{
      const schema=JSON.parse(raw);
      const visit=value=>{
        if(!value||typeof value!=='object')return;
        if(value['@type']==='Organization'&&value.name===brandName)value.logo=new URL('assets/brand/icon-512.png',siteConfig.baseUrl).href;
        if(value['@type']==='WebSite'){value.name=brandName;value.alternateName='Peek My Car';}
        for(const child of Object.values(value))if(typeof child==='object')visit(child);
      };
      visit(schema);return open+JSON.stringify(schema)+close;
    });
  }
  return html;
}
