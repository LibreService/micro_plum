import yaml from 'js-yaml'
import {
  parseDict,
  parseLua,
  parseOpenCC,
  parseSchema
} from './parser'

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
  const match = target.match(/(^https?:\/\/)?github\.com\/([-_a-zA-Z0-9]+\/[-_a-zA-Z0-9]+)\/blob\/([-_a-zA-Z0-9]+)\/(([-_a-zA-Z0-9]+\/)*)([-_a-zA-Z0-9]+)\.schema\.yaml$/)
  if (!match) {
    return undefined
  }
  const repo = match[2]
  const branch = match[3]
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

const decoder = new TextDecoder('utf-8', { fatal: true })

function u2s (u: Uint8Array) {
  return decoder.decode(u)
}

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

const generic: { [key: string]: string[] } = {
  'rime/rime-emoji': [
    'emoji_suggestion.yaml',
    'opencc/emoji.json'
  ],
  'rime/rime-essay': [
    'essay.txt'
  ],
  'rime/rime-prelude': [
    'default.yaml',
    'key_bindings.yaml',
    'punctuation.yaml',
    'symbols.yaml'
  ]
}

class Recipe {
  source: 'GitHub' | 'jsDelivr'
  repo: string
  branch: string | undefined
  path: string
  prefix: string
  schemaIds: string[]
  onDownloadFailure: ((url: string, reason: number | string) => void) | undefined
  loadedFiles: { [key: string]: Uint8Array | undefined } = {}

  constructor (target: string, options?: {
    source?: 'GitHub' | 'jsDelivr'
    schemaIds?: string[]
    onDownloadFailure?: (url: string, reason: number | string) => void
  }) {
    const normalized = normalizeTarget(target)
    if (!normalized) {
      throw new Error('Invalid target')
    }
    this.repo = normalized.repo
    this.branch = normalized.branch
    this.path = normalized.path
    options ||= {}
    if (normalized.schema) {
      this.schemaIds = [normalized.schema]
    } else {
      this.schemaIds = options.schemaIds || []
    }
    this.source = options.source || 'GitHub'
    this.prefix = this.getPrefix()
    this.onDownloadFailure = options.onDownloadFailure
  }

  getPrefix () {
    return this.source === 'jsDelivr'
      ? `https://cdn.jsdelivr.net/gh/${this.repo}${this.branch ? '@' + this.branch : ''}/${this.path}`
      : `https://raw.githubusercontent.com/${this.repo}/${this.branch || 'HEAD'}/${this.path}`
  }

  getURL (file: string) {
    if (builtinOpenCC.includes(file) || file.endsWith('.ocd2')) {
      return openccCDN + file
    }
    return this.prefix + file
  }

  async loadFile (file: string) {
    if (file === 'opencc/emoji.json') {
      return
    }
    if (file in this.loadedFiles) {
      return
    }
    this.loadedFiles[file] = undefined
    const url = this.getURL(file)
    let content: Uint8Array
    try {
      content = await download(url)
    } catch (e) {
      this.onDownloadFailure && this.onDownloadFailure(url, typeof e === 'number' ? e : (e as Error).message)
      return
    }
    this.loadedFiles[file] = content

    const promises: Promise<any>[] = []

    if (file.endsWith('.yaml')) {
      const s = u2s(content)
      let obj: object
      if (file.endsWith('.schema.yaml')) {
        try {
          obj = yaml.load(s) as object
        } catch {
          throw new Error(`Invalid ${file}`)
        }
        const newFiles = parseSchema(obj)
        for (const newFile of newFiles) {
          if (newFile.endsWith('.json')) {
            promises.push(this.loadFile('opencc/' + newFile))
          } else {
            promises.push(this.loadFile(newFile))
          }
        }
      } else if (file.endsWith('.dict.yaml')) {
        let obj: object
        try {
          obj = yaml.loadAll(s)[0] as object
        } catch {
          const start = s.match(/(^|\n)---\n/)?.index
          obj = yaml.load(s.slice(start, s.indexOf('\n...'))) as object // some tables contain invalid syntax
        }
        const newFiles = parseDict(obj)
        for (const newFile of newFiles) {
          promises.push(this.loadFile(newFile))
        }
      }
    } else if (file.endsWith('.json')) {
      const obj = JSON.parse(u2s(content))
      const newFiles = parseOpenCC(obj)
      for (const newFile of newFiles) {
        promises.push(this.loadFile('opencc/' + newFile))
      }
    } else if (file.endsWith('.lua')) {
      const newFiles = parseLua(u2s(content))
      for (const newFile of newFiles) {
        promises.push(this.loadFile(newFile))
      }
    }
    return Promise.all(promises)
  }

  async load () {
    if (this.repo in generic) {
      await Promise.all(generic[this.repo].map(file => this.loadFile(file)))
    } else {
      await Promise.all(this.schemaIds.map(async schemaId => {
        const file = `${schemaId}.schema.yaml`
        return this.loadFile(file)
      }))
    }
    return Object.entries(this.loadedFiles).map(([file, content]) => ({ file, content }))
  }
}

export {
  u2s,
  normalizeTarget,
  Recipe
}
