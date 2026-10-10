import { useState } from 'react'
import { useI18n } from '../i18n'
import { checkReply, SPEAKING_LESSONS, type ReplyCheck } from '../lib/speakingLessons'
import { isRestoring } from '../lib/restoreGuard'
import { Modal } from './Modal'
import { useSpeechPractice } from './useSpeechPractice'

const KEY = 'ryuso.speaking.v1'
function readProgress(): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!value || typeof value !== 'object') return {}
    return Object.fromEntries(Object.entries(value).filter(([id, count]) => SPEAKING_LESSONS.some(l => l.id === id) && typeof count === 'number' && Number.isFinite(count) && count > 0)) as Record<string, number>
  } catch { return {} }
}
export function SpeakingGame({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'words' | 'practice' | 'done'>('words')
  const [round, setRound] = useState(0)
  const [turnIndex, setTurnIndex] = useState(0)
  const [hint, setHint] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState<'matched' | 'almost' | 'retry' | 'self' | null>(null)
  const [check, setCheck] = useState<ReplyCheck | null>(null)
  const [progress, setProgress] = useState(readProgress)
  const [saveError, setSaveError] = useState(false)
  const lesson = SPEAKING_LESSONS.find(l => l.id === lessonId)
  const turn = lesson?.turns[turnIndex]
  const speech = useSpeechPractice(text => {
    setTranscript(text)
    const c = turn ? checkReply(text, turn) : null
    setCheck(c)
    setFeedback(c ? (c.level === 'match' ? 'matched' : c.level) : 'retry')
  })
  const btn = 'min-h-12 rounded-2xl px-4 py-2 text-sm font-bold'
  const resetTurn = () => { speech.stop(); setHint(false); setTranscript(''); setFeedback(null); setCheck(null) }
  const next = () => {
    resetTurn()
    if (turnIndex < 2) setTurnIndex(turnIndex + 1)
    else if (round < 2) { setRound(round + 1); setTurnIndex(0) }
    else {
      setPhase('done')
      const nextProgress = { ...progress, [lessonId!]: (progress[lessonId!] ?? 0) + 1 }
      try {
        if (isRestoring()) throw new Error('restore')
        localStorage.setItem(KEY, JSON.stringify(nextProgress)); setProgress(nextProgress)
      } catch { setSaveError(true) }
    }
  }
  return <Modal title={ko ? '한마디 영어 마을' : 'Speak a little English'} onClose={onClose}>
    {!lesson ? <>
      <p className="text-sm leading-relaxed">{ko ? '짧게라도 직접 말해봐요. 듣고 따라 말하기 → 단어 바꿔 말하기 → 예시 없이 대화하기. 시간제한은 없어요.' : 'Listen and repeat, change a word, then reply without a model. No time limit.'}</p>
      <div className="flex flex-col gap-3">{SPEAKING_LESSONS.map(l => <button key={l.id} className={`${btn} flex items-center justify-between bg-petal text-left`} onClick={() => {
        setLessonId(l.id); setPhase('words'); setRound(0); setTurnIndex(0); setSaveError(false); resetTurn()
      }}><span>{l.icon} {l.title[lang]}<span className="mt-1 block text-xs font-normal">{ko ? '단어 4개 · 짧은 대화 3개' : '4 words · 3 short replies'}</span></span><span className="text-xs">{progress[l.id] ? (ko ? `복습 · ${progress[l.id]}회 완료` : `Review · ${progress[l.id]} completed`) : (ko ? '시작 →' : 'Start →')}</span></button>)}</div>
      <p className="text-xs text-cocoa-soft">{ko ? '마이크 인식이 안 되어도 소리 내어 말한 뒤 직접 완료할 수 있어요. 마이크는 버튼을 누를 때만 켜져요.' : 'You can speak aloud and continue yourself when recognition is unavailable. The microphone starts only when tapped.'}</p>
    </> : <>
      <div className="my-3 flex items-center justify-between gap-2"><h2 className="text-base font-bold">{lesson.icon} {lesson.title[lang]}</h2><button className={`${btn} bg-petal`} onClick={() => { resetTurn(); setLessonId(null) }}>{ko ? '다른 미션' : 'Missions'}</button></div>
      {phase === 'words' ? <>
        <p className="text-sm">{ko ? '오늘 쓸 단어예요. 듣고 한 번씩 소리 내어 말해봐요.' : 'Listen to each word and say it aloud.'}</p>
        <div className="grid grid-cols-2 gap-2">{lesson.words.map(w => <div key={w.en} className="rounded-2xl bg-cream p-3"><p lang="en" className="m-0 text-lg font-bold">{w.en}</p><p className="my-1 text-sm">{w.ko}</p><button disabled={!speech.canListen} className={`${btn} mt-1 w-full bg-white disabled:opacity-50`} onClick={() => speech.speak(w.en)}>🔊 {ko ? '듣기' : 'Listen'}</button></div>)}</div>
        <button className={`${btn} mt-4 w-full bg-blush text-white`} onClick={() => { speech.stop(); setPhase('practice') }}>{ko ? '주민과 말해보기 →' : 'Talk to the resident →'}</button>
      </> : phase === 'done' ? <div className="rounded-2xl bg-cream p-4 text-center">
        <p className="text-4xl">🌷</p><p className="font-bold">{ko ? '오늘도 영어로 말을 꺼냈어요!' : 'You spoke English today!'}</p>
        <p className="text-sm">{ko ? '짧은 대화 3개를 세 번씩 연습했어요. 다음에는 예시 없이 다시 말해봐요.' : 'You practiced three replies three times. Review them without the model next time.'}</p>
        {saveError && <p role="alert" className="text-sm text-red-700">{ko ? '완료 기록을 저장하지 못했어요. 연습은 완료됐어요.' : 'Practice complete, but the record could not be saved.'}</p>}
        <button className={`${btn} bg-blush text-white`} onClick={() => { resetTurn(); setRound(2); setTurnIndex(0); setPhase('practice'); setSaveError(false) }}>{ko ? '예시 없이 다시 대화하기' : 'Review without the model'}</button>
      </div> : turn && <>
        <p className="text-sm font-bold text-blush-deep">{[ko ? '① 듣고 따라 말해요' : '① Listen and repeat', ko ? '② 단어를 바꿔 말해요' : '② Change the word', ko ? '③ 예시 없이 대화해요' : '③ Reply without the model'][round]} · {turnIndex + 1}/3</p>
        <div className="rounded-2xl bg-cream p-3"><p className="m-0 text-xs">{ko ? '주민이 물어요' : 'The resident asks'}</p><p lang="en" className="my-2 text-lg font-bold">{turn.question}</p><p className="text-xs">{turn.meaning}</p><button disabled={!speech.canListen} className={`${btn} bg-white disabled:opacity-50`} onClick={() => speech.speak(turn.question)}>🔊 {ko ? '질문 듣기' : 'Hear question'}</button></div>
        <p className="my-3 text-sm font-bold">{turn.cue}</p>
        {round === 0 || hint ? <div className="rounded-2xl bg-petal p-3"><p lang="en" className="m-0 text-lg font-bold">{turn.answer}</p><p className="my-1 text-xs">{turn.answerMeaning}</p><button disabled={!speech.canListen} className={`${btn} bg-white disabled:opacity-50`} onClick={() => speech.speak(turn.answer)}>🔊 {ko ? '예시 듣고 따라 말하기' : 'Hear and repeat'}</button></div> : <button className={`${btn} w-full bg-petal`} onClick={() => setHint(true)}>💡 {ko ? (round === 1 ? `${lesson.turns[0].answer} → 단어를 바꿔요 · 힌트 보기` : '막히면 예시 보기') : 'Show a model reply'}</button>}
        <div className="mt-3 flex flex-col gap-2">
          {speech.supported && <button disabled={!!feedback && feedback !== 'retry'} className={`${btn} bg-blush text-white disabled:opacity-50`} onClick={() => speech.listening ? speech.stop() : speech.start()}>{speech.listening ? (ko ? '⏹ 듣는 중 · 멈추기' : '⏹ Listening · stop') : (ko ? '🎤 내 차례 · 말하기' : '🎤 My turn · speak')}</button>}
          {speech.listening && <p role="status" className="m-0 text-center text-xs">{ko ? '짧게 말해주세요. 문장이 끝나면 인식을 마쳐요.' : 'Say a short reply. Recognition ends after you finish.'}</p>}
          <button className={`${btn} bg-petal`} onClick={() => { speech.stop(); setFeedback('self') }}>{ko ? '소리 내어 말했어요 · 직접 완료' : 'I said it aloud · continue myself'}</button>
        </div>
        {!speech.supported && <p className="text-xs">{ko ? '이 기기에서는 음성 인식을 사용할 수 없어요. 예시를 듣고 소리 내어 말한 뒤 직접 완료해주세요.' : 'Recognition is unavailable here. Say your reply aloud, then continue yourself.'}</p>}
        {speech.error && <p role="alert" className="text-xs text-red-700">{ko ? (speech.error === 'not-allowed' || speech.error === 'service-not-allowed' ? '마이크 권한이 없어요. 권한을 허용하거나 소리 내어 말한 뒤 직접 완료해주세요.' : '말을 인식하지 못했어요. 다시 시도하거나 직접 완료해주세요.') : 'Could not recognize speech. Retry or speak aloud and continue yourself.'}</p>}
        {transcript && <p className="text-sm">{ko ? '인식된 말: ' : 'Heard: '}<span lang="en">{transcript}</span></p>}
        {feedback && <div role="status" className="mt-3 rounded-2xl bg-cream p-3"><p className="m-0 text-sm font-bold">{feedback === 'matched' ? (ko ? '🌟 이번 답변과 잘 맞아요!' : '🌟 Your reply fits!') : feedback === 'self' ? (ko ? '🌷 직접 말하기를 완료했어요!' : '🌷 Speaking practice complete!') : feedback === 'almost' ? (ko ? '거의 다 왔어요! 빠진 단어만 더해서 다시 말해 볼까요?' : 'Almost! Add the missing words and try again.') : (ko ? '괜찮아요. 예시를 듣고 다시 말해볼까요?' : 'That is okay. Hear the model and try again.')}</p>{check && feedback !== 'matched' && feedback !== 'self' && <p lang="en" className="my-1 text-sm">{check.words.map((w, i) => <span key={i} className={w.heard ? 'font-bold text-emerald-700' : 'font-bold text-red-700 underline'}>{w.word}{' '}</span>)}</p>}<p className="mb-0 text-xs">{ko ? '음성 인식은 발음 점수가 아니에요. 인식이 틀릴 수도 있어요.' : 'Recognition checks words, not pronunciation. It can mishear you.'}</p></div>}
        {(feedback === 'matched' || feedback === 'self' || feedback === 'almost') && <button className={`${btn} mt-3 w-full bg-blush text-white`} onClick={next}>{turnIndex === 2 && round === 2 ? (ko ? '연습 마치기 🌷' : 'Finish practice 🌷') : (ko ? '다음 대화 →' : 'Next →')}</button>}
      </>}
    </>}
  </Modal>
}
