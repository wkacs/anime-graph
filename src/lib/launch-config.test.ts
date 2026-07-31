import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('launch configuration', () => {
  it('a napi cronok kulon route-on futnak, self-fetch orchestrator nelkul', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8')) as {
      crons?: { path: string; schedule: string }[]
    }
    expect(config.crons?.map((cron) => cron.path)).toEqual([
      '/api/cron/sync-catalog',
      '/api/cron/airing-digest',
      '/api/cron/time-capsule',
    ])
    expect(config.crons?.some((cron) => cron.path.includes('/daily'))).toBe(false)
  })

  it('a build production env ellenorzessel indul', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    expect(pkg.scripts?.prebuild).toContain('validate-production-env.mjs')
  })

  it('a teljes katalogusszinkron csak kezzel indithato', () => {
    const workflow = readFileSync(resolve('.github/workflows/catalog.yml'), 'utf8')
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('inputs.media_type')
    expect(workflow).not.toMatch(/^\s*schedule:/m)
  })
})
