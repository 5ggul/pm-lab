export const siteConfig=Object.freeze({
  baseUrl:'https://5ggul.github.io/pm-lab/car-data-preview/',
  indexingEnabled:false,
  robots:'noindex,nofollow,noarchive'
});

export function pageUrl(relativePath){
  return new URL(relativePath.replace(/index\.html$/,''),siteConfig.baseUrl).href;
}
