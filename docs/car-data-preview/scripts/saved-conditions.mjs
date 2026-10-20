const start = '<!-- SAVED-CONDITIONS:START -->';
const end = '<!-- SAVED-CONDITIONS:END -->';
const runtimeStart = '<!-- SAVED-CONDITIONS:RUNTIME -->';
const runtimeEnd = '<!-- /SAVED-CONDITIONS:RUNTIME -->';
export function patchSavedConditions(html, route) {
  html = html.replace(/<!-- SAVED-CONDITIONS:START -->[\s\S]*?<!-- SAVED-CONDITIONS:END -->/g, '').replace(/<!-- SAVED-CONDITIONS:RUNTIME -->[\s\S]*?<!-- \/SAVED-CONDITIONS:RUNTIME -->/g, '');
  if (route === 'privacy/index.html' && !html.includes('id="condition-storage-disclosure"')) {
    html = html.replace(/(<h2>계산 입력값<\/h2><p>[\s\S]*?<\/p>)/, '$1<p id="condition-storage-disclosure">「현재 조건 저장」을 누르면 조건 이름과 계산 주소를 이 기기의 브라우저 저장 공간(localStorage)에 최대 12개 저장합니다. 사용자 계정이나 다른 기기로 동기화하지 않으며, 저장한 조건의 삭제 버튼이나 브라우저의 사이트 데이터 삭제로 지울 수 있습니다. 계산 조건이 포함된 주소를 다른 사람에게 공유하면 해당 입력값도 전달됩니다.</p>');
  }
  const hub = route === 'tools/index.html';
  const eligible = hub || /^tools\/[^/]+\/index\.html$/.test(route) || (route.startsWith('compare/') && !/http-equiv=["']refresh["']/i.test(html)) || route === 'cars/family/index.html' || /^cars\/[^/]+\/[^/]+\/(?:[^/]+\/)*index\.html$/.test(route);
  if (!eligible || !html.includes('</main>')) return html;
  const save = hub ? '' : '<div class="saved-conditions-form"><label>조건 이름<input type="text" maxlength="60" data-saved-name placeholder="예: 출퇴근 2만 km"></label><button type="button" data-save-condition>현재 조건 저장</button></div>';
  const widget = `${start}<section class="db-section saved-conditions-section"><div class="db-shell"><details class="saved-conditions" data-saved-conditions><summary>저장한 조건</summary><div class="saved-conditions-body">${save}<p class="saved-conditions-status" role="status" data-saved-status>최대 12개를 이 브라우저에만 저장합니다. 다른 기기와 공유되지 않습니다.</p><ul data-saved-list><li class="saved-conditions-empty">저장한 조건이 없습니다.</li></ul></div></details></div></section>${end}`;
  const prefix = '../'.repeat(route.split('/').length - 1);
  return html.replace('</main>', widget + '</main>').replace('</body>', `${runtimeStart}<script type="module" src="${prefix}assets/saved-conditions.js"></script>${runtimeEnd}</body>`);
}
