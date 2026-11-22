/**
 * 애원복지 웹진 수정 요청 접수
 * - 이 스크립트를 "수정요청" 구글 시트의 [확장 프로그램 > Apps Script]에 붙여 넣고
 *   웹앱으로 배포합니다. (실행: 나, 액세스 권한: 모든 사용자)
 * - 시트 탭 "수정요청"은 처음 요청이 들어올 때 자동으로 만들어집니다.
 * - 상태 칸은 접수 / 반영함 / 보류 중에서 고릅니다. "반영함"은 웹진 화면 표시에서 빠집니다.
 */
var SHEET_NAME = '수정요청';
var HEADERS = ['접수일시', '호수', '꼭지', '위치번호', '해당 내용', '요청 유형', '요청 내용', '요청자', '상태', '처리 메모', '페이지'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f4ebdf');
    sh.setColumnWidth(5, 280);
    sh.setColumnWidth(7, 320);
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(['접수', '반영함', '보류'], true).build();
    sh.getRange('I2:I').setDataValidation(rule);
  }
  return sh;
}

function clip_(v, n) {
  return String(v == null ? '' : v).slice(0, n);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d.text) return json_({ ok: false, error: 'empty' });
    getSheet_().appendRow([
      new Date(),
      clip_(d.issue, 10),
      clip_(d.section, 120),
      clip_(d.blockId, 60),
      clip_(d.excerpt, 300),
      clip_(d.type, 20),
      clip_(d.text, 2000),
      clip_(d.who, 20),
      '접수',
      '',
      clip_(d.page, 200)
    ]);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var issue = String((e && e.parameter && e.parameter.issue) || '');
  var rows = getSheet_().getDataRange().getValues().slice(1);
  var items = rows
    .filter(function (r) { return String(r[1]) === issue && r[8] !== '반영함'; })
    .map(function (r) { return { blockId: r[3], type: r[5], text: r[6], who: r[7], status: r[8] }; });
  return json_({ ok: true, items: items });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
