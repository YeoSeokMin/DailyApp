/**
 * claude CLI 경량 호출 플래그 (2026-09-24)
 *
 * 분석 호출은 도구·프로젝트 설정·슬래시명령이 전혀 필요 없다. 이것들을 끄면
 * 호출당 기본 오버헤드가 20,979 → 3,784 토큰으로 준다(서버 실측).
 * 또한 .claude/settings.local.json 의 Bash 권한이 적용되지 않으므로,
 * 앱스토어 설명문 같은 외부 텍스트가 명령 실행으로 이어질 여지가 없다.
 *
 * ★빈 문자열 인자가 있으므로 반드시 spawn(..., { shell: false }) 로 호출할 것.
 *   shell: true 면 빈 인자가 사라져 다음 플래그를 값으로 먹는다.
 */
const CLAUDE_LEAN_FLAGS = [
  '--safe-mode',
  '--setting-sources', '',
  '--disable-slash-commands',
  '--no-session-persistence',
  '--tools', '',
];

module.exports = { CLAUDE_LEAN_FLAGS };
