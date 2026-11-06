import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { resetShadowSession } from '../src/shadow-session.js'

const dbPath = process.env.RADAR_DB_PATH ?? 'meme-radar-shadow.sqlite'

if (!fs.existsSync(dbPath)) {
  console.log(JSON.stringify({ type: 'SHADOW_SESSION_RESET', dbPath, restored: false, learningPreserved: { entries: 0, outcomes: 0 } }))
  process.exit(0)
}

const db = new DatabaseSync(dbPath)
try {
  const result = resetShadowSession(db)
  console.log(JSON.stringify({ type: 'SHADOW_SESSION_RESET', dbPath, restored: true, ...result }))
} finally {
  db.close()
}
