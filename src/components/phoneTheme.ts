/** 카페 휴대폰 색: 유엘은 파란색, 그 밖(유하 등)은 분홍색. Tailwind 가 찾을 수 있게 클래스 이름을 통째로 적는다 */
export interface PhoneTheme { bezel: string; screen: string; ping: string; ring: string; ink: string; me: string; border: string; key: string; accent: string }
export const PHONE_THEMES: Record<'pink' | 'blue', PhoneTheme> = {
  pink: { bezel: 'bg-[#f7a8bf]', screen: 'bg-gradient-to-b from-[#fde6ec] via-[#fff6ef] to-[#e8f4dc]', ping: 'bg-[#f6a6b8]/60', ring: 'ring-[#f6c3cf]', ink: 'text-[#8a4b55]', me: 'bg-[#ff8fab]', border: 'border-[#f6c3cf]', key: 'bg-[#fff0f4]', accent: 'bg-[#ff8fab]' },
  blue: { bezel: 'bg-[#8cc3f5]', screen: 'bg-gradient-to-b from-[#e3f1ff] via-[#f5faff] to-[#e6f6ee]', ping: 'bg-[#9ccdf6]/60', ring: 'ring-[#bcdcf8]', ink: 'text-[#33597f]', me: 'bg-[#5aa8ec]', border: 'border-[#bcdcf8]', key: 'bg-[#eef6ff]', accent: 'bg-[#5aa8ec]' },
}
/** 아바타에 맞는 휴대폰 색 */
export const phoneThemeFor = (avatarId: string) => PHONE_THEMES[avatarId === 'yuel' ? 'blue' : 'pink']
