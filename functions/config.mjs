/**
 * 실제 Firebase 프로젝트(ryuso-game)의 Realtime Database 위치. 배포할 때 functions/.env.ryuso-game 값이 있으면 그 값을 쓴다.
 * 데이터베이스 트리거(onValueCreated 등)는 데이터베이스와 같은 지역에 배포해야 하므로 지역을 함께 맞춘다.
 */
export const PROJECT_ID = 'ryuso-game'
export const DEFAULT_REGION = 'asia-southeast1'
export const DEFAULT_INSTANCE = 'ryuso-game-default-rtdb'
export const databaseUrlOf = (instance, region) => (region === 'us-central1' ? `https://${instance}.firebaseio.com` : `https://${instance}.${region}.firebasedatabase.app`)
export const DEFAULT_DATABASE_URL = databaseUrlOf(DEFAULT_INSTANCE, DEFAULT_REGION)

/** 환경변수(배포 시 .env 파일)로 덮어쓴 값. 셋이 서로 맞지 않으면 배포 전에 멈춘다 */
export function dbConfig(env = process.env) {
  const region = env.FUNCTIONS_REGION || DEFAULT_REGION
  const instance = env.DATABASE_INSTANCE || DEFAULT_INSTANCE
  const databaseUrl = (env.DATABASE_URL || databaseUrlOf(instance, region)).replace(/\/+$/, '')
  if (databaseUrl !== databaseUrlOf(instance, region)) throw new Error(`DATABASE_URL(${databaseUrl}) does not match DATABASE_INSTANCE(${instance}) in FUNCTIONS_REGION(${region})`)
  return { region, instance, databaseUrl }
}
