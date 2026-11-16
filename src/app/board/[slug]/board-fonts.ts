import { Barlow_Condensed, Black_Han_Sans, Do_Hyeon, Inter, Orbitron, Oswald } from 'next/font/google';

// 전광판 테마 글꼴. 빌드할 때 내려받아 같이 싣는다(사이트 보안 설정상 외부 글꼴 주소를 쓸 수 없다).
// 본문 글꼴은 사이트 기본 Pretendard(--font-sans)를 쓴다.
const hansans = Black_Han_Sans({ weight: '400', subsets: ['latin'], preload: false, variable: '--pb-hansans' });
const dohyeon = Do_Hyeon({ weight: '400', subsets: ['latin'], preload: false, variable: '--pb-dohyeon' });
const inter = Inter({ weight: ['600', '800'], subsets: ['latin'], preload: false, variable: '--pb-inter' });
const oswald = Oswald({ weight: ['500', '700'], subsets: ['latin'], preload: false, variable: '--pb-oswald' });
const orbitron = Orbitron({ weight: ['700', '900'], subsets: ['latin'], preload: false, variable: '--pb-orbitron' });
const barlow = Barlow_Condensed({ weight: ['600', '800'], subsets: ['latin'], preload: false, variable: '--pb-barlow' });

export const boardFontClassName = [hansans, dohyeon, inter, oswald, orbitron, barlow].map((font) => font.variable).join(' ');
