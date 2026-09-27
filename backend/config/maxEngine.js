// PACA가 위임 계정과 원본 출결의 기준이다. 서비스 공유 키는 사용하지 않는다.
function sourceUrl() {
  const value = process.env.MAX_ENGINE_PACA_URL;
  if (!value) throw new Error('integration_disabled');
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('invalid_source');
  }
  return url.origin + '/paca/integrations/max-engine/full';
}
module.exports = { sourceUrl };
