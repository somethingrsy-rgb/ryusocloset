/**
 * 동물 전화 대사를 AI 목소리로 미리 녹음한다.
 *   npx tsx scripts/call-voices.ts list   → docs/call-voice-lines.md (녹음할 대사 목록)
 *   OPENAI_API_KEY=... npx tsx scripts/call-voices.ts make   → public/cafe/voice/<동물>/<번호>.mp3 + manifest.json
 * 이미 있는 파일은 건너뛰므로, 대사를 고치거나 더한 뒤 다시 돌리면 바뀐 것만 새로 녹음한다.
 * 앱은 manifest.json 에 있는 대사만 파일로 틀고, 없는 대사는 기기 음성으로 읽는다.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AVATARS } from '../src/lib/avatars'
import { CALL_ANIMALS, allCallLines } from '../src/lib/animalCalls'

const OUT = 'public/cafe/voice'
const kidNames = AVATARS.map((a) => a.name.ko)
const lines = allCallLines(kidNames)

/** 동물마다 OpenAI 목소리와 말투 지시(동물 그림 이름 기준) */
const VOICES: Record<string, { voice: string; style: string }> = {
  bear: { voice: 'ash', style: '느릿느릿하고 포근한 아기 곰. 낮고 따뜻한 목소리로 다정하게.' },
  bunny: { voice: 'shimmer', style: '수줍지만 상냥한 아기 토끼. 높고 맑은 목소리로 사랑스럽게.' },
  cat: { voice: 'nova', style: '살짝 새침하지만 다정한 아기 고양이. 귀엽고 부드럽게, 말끝을 살짝 늘이며.' },
  dog: { voice: 'coral', style: '신나서 꼬리를 흔드는 강아지. 밝고 힘차고 반갑게.' },
  chick: { voice: 'shimmer', style: '아주 작은 병아리. 가장 높고 빠르고 통통 튀는 목소리로.' },
  duck: { voice: 'fable', style: '장난꾸러기 오리. 명랑하고 익살스럽게.' },
  squirrel: { voice: 'nova', style: '바쁘고 호기심 많은 다람쥐. 빠르고 재잘재잘 귀엽게.' },
  panda: { voice: 'sage', style: '느긋하고 순한 판다. 천천히, 졸린 듯 포근하게.' },
}

function list() {
  const md = ['# 동물 전화 녹음 대사', '', `모두 ${lines.length}줄 (아이 이름: ${kidNames.join(', ')})`, '']
  CALL_ANIMALS.forEach((a, i) => {
    const mine = lines.filter((l) => l.animal === i)
    md.push(`## ${a.name} (${a.img}) · ${mine.length}줄`, '', ...mine.map((l) => `- \`${l.id}\` ${l.text}`), '')
  })
  mkdirSync('docs', { recursive: true })
  writeFileSync('docs/call-voice-lines.md', md.join('\n'))
  console.log(`docs/call-voice-lines.md: ${lines.length}줄`)
}

async function make() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY 가 없어요')
  let made = 0
  for (const l of lines) {
    const a = CALL_ANIMALS[l.animal]
    const dir = join(OUT, a.img)
    const file = join(dir, `${l.id}.mp3`)
    if (existsSync(file)) continue
    mkdirSync(dir, { recursive: true })
    const v = VOICES[a.img]
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: v.voice,
        input: l.text,
        instructions: `한국어로 말해요. 여섯 살 아이와 전화하는 동물 친구 ${a.name}예요. ${v.style} 동화책 읽어 주듯 자연스럽고 생기 있게, 기계처럼 딱딱하지 않게.`,
        response_format: 'mp3',
      }),
    })
    if (!res.ok) throw new Error(`${a.name} ${l.id}: ${res.status} ${await res.text()}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    made++
    console.log(`${a.name} ${l.id} ${l.text}`)
  }
  // 녹음 파일이 있는 대사만 앱에 알려 준다
  const manifest: Record<string, string[]> = {}
  for (const l of lines) {
    const img = CALL_ANIMALS[l.animal].img
    if (existsSync(join(OUT, img, `${l.id}.mp3`))) (manifest[img] ??= []).push(l.id)
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest))
  console.log(`새로 녹음 ${made}줄, 전체 ${Object.values(manifest).flat().length}/${lines.length}줄`)
}

const cmd = process.argv[2]
if (cmd === 'list') list()
else if (cmd === 'make') await make()
else console.log('사용법: npx tsx scripts/call-voices.ts list | make')
