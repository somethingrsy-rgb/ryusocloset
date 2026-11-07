export interface FlagCountry { code: string; ko: string; en: string }
export const FLAG_COUNTRIES: readonly FlagCountry[] = [
  { code: 'KR', ko: '대한민국', en: 'South Korea' },
  { code: 'JP', ko: '일본', en: 'Japan' },
  { code: 'CN', ko: '중국', en: 'China' },
  { code: 'US', ko: '미국', en: 'United States' },
  { code: 'CA', ko: '캐나다', en: 'Canada' },
  { code: 'GB', ko: '영국', en: 'United Kingdom' },
  { code: 'FR', ko: '프랑스', en: 'France' },
  { code: 'DE', ko: '독일', en: 'Germany' },
  { code: 'IT', ko: '이탈리아', en: 'Italy' },
  { code: 'ES', ko: '스페인', en: 'Spain' },
  { code: 'BR', ko: '브라질', en: 'Brazil' },
  { code: 'AR', ko: '아르헨티나', en: 'Argentina' },
  { code: 'AU', ko: '호주', en: 'Australia' },
  { code: 'NZ', ko: '뉴질랜드', en: 'New Zealand' },
  { code: 'IN', ko: '인도', en: 'India' },
  { code: 'TH', ko: '태국', en: 'Thailand' },
  { code: 'VN', ko: '베트남', en: 'Vietnam' },
  { code: 'ID', ko: '인도네시아', en: 'Indonesia' },
  { code: 'SE', ko: '스웨덴', en: 'Sweden' },
  { code: 'FI', ko: '핀란드', en: 'Finland' },
  { code: 'CH', ko: '스위스', en: 'Switzerland' },
  { code: 'GR', ko: '그리스', en: 'Greece' },
  { code: 'TR', ko: '튀르키예', en: 'Türkiye' },
  { code: 'ZA', ko: '남아프리카 공화국', en: 'South Africa' },
]
export interface FlagQuestion { country: FlagCountry; choices: FlagCountry[] }
export const FLAG_ROUNDS = 10
function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const out = [...values]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
/** 한 판에 같은 국기를 반복하지 않고 정답 하나와 서로 다른 오답 세 개를 섞는다. */
export function makeFlagQuiz(random: () => number = Math.random): FlagQuestion[] {
  return shuffled(FLAG_COUNTRIES, random).slice(0, FLAG_ROUNDS).map(country => ({
    country,
    choices: shuffled([country, ...shuffled(FLAG_COUNTRIES.filter(c => c.code !== country.code), random).slice(0, 3)], random),
  }))
}
