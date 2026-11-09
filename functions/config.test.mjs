import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_DATABASE_URL, dbConfig } from './config.mjs'

test('기본값은 실제 프로젝트(asia-southeast1)', () => {
  assert.equal(DEFAULT_DATABASE_URL, 'https://ryuso-game-default-rtdb.asia-southeast1.firebasedatabase.app')
  assert.deepEqual(dbConfig({}), { region: 'asia-southeast1', instance: 'ryuso-game-default-rtdb', databaseUrl: DEFAULT_DATABASE_URL })
})
test('.env 예시 값이 서로 맞는다', async () => {
  const { readFileSync } = await import('node:fs')
  const env = Object.fromEntries(readFileSync(new URL('./.env.example', import.meta.url), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2)))
  assert.deepEqual(dbConfig(env), dbConfig({}))
})
test('지역과 주소가 다르면 멈춘다', () => {
  assert.throws(() => dbConfig({ FUNCTIONS_REGION: 'us-central1', DATABASE_URL: DEFAULT_DATABASE_URL }))
  assert.throws(() => dbConfig({ DATABASE_URL: 'https://ryuso-game-default-rtdb.firebaseio.com' }))
})
