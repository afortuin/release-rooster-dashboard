import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import type { Area, AreasConfig, Source } from '@release-rooster/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function configPath(): string {
  return process.env.AREAS_CONFIG_PATH ?? resolve(__dirname, '../../../config/areas.yaml')
}

export function loadConfig(): AreasConfig {
  const raw = readFileSync(configPath(), 'utf8')
  const parsed = parse(raw) as AreasConfig
  if (!parsed?.areas?.length) {
    throw new Error(`No areas found in ${configPath()}`)
  }
  return parsed
}

export function listAreas(): Area[] {
  return loadConfig().areas
}

export function getArea(areaId: string): Area | undefined {
  return listAreas().find((a) => a.id === areaId)
}

export function listSources(areaId?: string): Source[] {
  return listAreas()
    .filter((a) => !areaId || a.id === areaId)
    .flatMap((a) => a.sources)
}

export function getSource(sourceId: string): Source | undefined {
  return listSources().find((s) => s.id === sourceId)
}
