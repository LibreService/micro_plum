import { FileLoader } from './loader'

const builtinOpenCC = [
  'hk2s.json',
  'hk2t.json',
  'jp2t.json',
  's2hk.json',
  's2t.json',
  's2tw.json',
  's2twp.json',
  't2hk.json',
  't2jp.json',
  't2s.json',
  't2tw.json',
  'tw2s.json',
  'tw2sp.json',
  'tw2t.json'
]

for (let i = 0; i < builtinOpenCC.length; ++i) {
  builtinOpenCC[i] = 'opencc/' + builtinOpenCC[i]
}

const openccCDN = 'https://cdn.jsdelivr.net/npm/@libreservice/my-opencc@0.2.0/dist/'

function matchPlum (target: string) {
  const match = target.match(/^([-_a-zA-Z0-9]+)(\/[-_a-zA-Z0-9]+)?(@[-_a-zA-Z0-9]+)?$/)
  if (!match) {
    return undefined
  }
  const repo = match[2] ? match[1] + match[2] : 'rime/' + (match[1].startsWith('rime-') ? match[1] : `rime-${match[1]}`)
  const branch = match[3] ? match[3].slice(1) : undefined
  return { repo, branch, path: '', schema: undefined }
}

function matchSchema (target: string) {
  const match = target.match(/(^https?:\/\/)?github\.com\/([-_a-zA-Z0-9]+\/[-_a-zA-Z0-9]+)\/blob\/([-_a-zA-Z0-9]+)\/(([-_a-zA-Z0-9%]+\/)*)([-_a-zA-Z0-9%]+)\.schema\.yaml$/) ||
    target.match(/(^https?:\/\/)?raw\.githubusercontent\.com\/([-_a-zA-Z0-9]+\/[-_a-zA-Z0-9]+)\/([-_a-zA-Z0-9]+)\/(([-_a-zA-Z0-9%]+\/)*)([-_a-zA-Z0-9%]+)\.schema\.yaml$/)
  if (!match) {
    return undefined
  }
  const repo = match[2]
  const branch = match[3] === 'HEAD' ? undefined : match[3]
  const path = match[4] || ''
  const schema = match[6]
  return { repo, branch, path, schema }
}

function normalizeTarget (target: string): {
  repo: string,
  branch: string | undefined
  path: string
  schema: string | undefined
} | undefined {
  return matchPlum(target) || matchSchema(target)
}

async function download (url: string) {
  const response = await fetch(url)
  if (response.ok) {
    return new Uint8Array(await response.arrayBuffer())
  }
  throw response.status
}

abstract class Downloader implements FileLoader {
  repo: string
  branch: string | undefined
  path: string
  prefix: string
  schemaIds: string[]

  abstract getPrefix (): string

  constructor (target: string, schemaIds?: string[]) {
    const normalized = normalizeTarget(target)
    if (!normalized) {
      throw new Error('Invalid target')
    }
    this.repo = normalized.repo
    this.branch = normalized.branch
    this.path = normalized.path
    this.prefix = this.getPrefix()
    if (normalized.schema) {
      this.schemaIds = [normalized.schema]
    } else {
      this.schemaIds = schemaIds || []
    }
  }

  getURL (file: string) {
    if (builtinOpenCC.includes(file) || file.endsWith('.ocd2')) {
      return openccCDN + file
    }
    return this.prefix + file
  }

  loadFile (file: string): Promise<Uint8Array> {
    const url = this.getURL(file)
    return download(url)
  }
}

class GitHubDownloader extends Downloader {
  getPrefix () {
    return `https://raw.githubusercontent.com/${this.repo}/${this.branch || 'HEAD'}/${this.path}`
  }
}

class JsDelivrDownloader extends Downloader {
  getPrefix () {
    return `https://cdn.jsdelivr.net/gh/${this.repo}${this.branch ? '@' + this.branch : ''}/${this.path}`
  }
}

export {
  normalizeTarget,
  Downloader,
  GitHubDownloader,
  JsDelivrDownloader
}
