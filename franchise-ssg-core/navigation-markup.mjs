// Strict transform for our generated header, not a general-purpose HTML parser.
// Preserve every link and visible label; put the disclosure before its links.
export const NAV_ID = 'primary-navigation';
export function patchHeaderNavigation(html) {
  const headers = [...html.matchAll(/<header class="site-header"[^>]*>[\s\S]*?<\/header>/g)];
  if (headers.length !== 1) throw new Error('Expected exactly one site header');
  const old = headers[0][0];
  const navs = [...old.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/g)];
  const buttons = [...old.matchAll(/<button\b[^>]*class="nav-toggle"[^>]*>[\s\S]*?<\/button>/g)];
  if (navs.length !== 1 || buttons.length !== 1) throw new Error('Expected one primary nav and toggle');
  const outside = html.replace(old, '');
  if (outside.includes(`id="${NAV_ID}"`)) throw new Error('Primary navigation id collision');
  const set = (tag, name, value) => tag.replace(new RegExp('\\s'+name+'="[^"]*"','g'),'').replace('>',` ${name}="${value}">`);
  let nav = navs[0][0].replace(/^<nav\b[^>]*>/, tag => set(tag,'id',NAV_ID));
  const button = buttons[0][0].replace(/^<button\b[^>]*>/, tag => {
    for (const [name,value] of Object.entries({type:'button','aria-controls':NAV_ID,'aria-expanded':'false','aria-label':'메뉴 열기'})) tag=set(tag,name,value);
    return tag;
  });
  // Remove the old button before inserting it ahead of the unchanged link list.
  const next = old.replace(buttons[0][0], '').replace(navs[0][0], button + nav);
  return html.replace(old,next);
}
