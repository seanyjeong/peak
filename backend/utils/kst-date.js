const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 한국 시간(KST) 기준 YYYY-MM-DD. toISOString()은 UTC라 00~09시에 하루 전 날짜가 나온다.
function getKstDateString(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().split('T')[0];
}

module.exports = {
  getKstDateString,
};
