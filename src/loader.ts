import yaml from 'js-yaml'
import {
  parseDict,
  parseLua,
  parseOpenCC,
  parseSchema
} from './parser'

const decoder = new TextDecoder('utf-8', { fatal: true })

function u2s (u: Uint8Array) {
  return decoder.decode(u)
}

const generic: { [key: string]: string[][] } = {
  'rime/rime-emoji': [
    ['emoji_suggestion.yaml'],
    ['opencc/emoji.json']
  ],
  'rime/rime-essay': [
    ['essay.txt']
  ],
  'rime/rime-prelude': [
    ['default.yaml'],
    ['key_bindings.yaml'],
    ['punctuation.yaml'],
    ['symbols.yaml']
  ]
}

interface FileLoader {
  loadFile: (file: string) => Promise<Uint8Array>
  repo: string
  schemaIds: string[]
}

class Recipe {
  loader: FileLoader
  onLoadFailure: ((url: string, reason: number | string) => void) | undefined
  loadedFiles: { [key: string]: Uint8Array | undefined } = {}

  constructor (loader: FileLoader, options?: {
    onLoadFailure?: (url: string, reason: number | string) => void
  }) {
    this.loader = loader
    options ||= {}
    this.onLoadFailure = options.onLoadFailure
  }

  async loadFileGroup (fileGroup: string[]) {
    const errors: [string, (number | string)][] = []
    for (const file of fileGroup) {
      // Don't download emoji.json from current repo, unless this is the emoji repo
      if (file === 'opencc/emoji.json' && this.loader.repo !== 'rime/rime-emoji') {
        return
      }
      if (file in this.loadedFiles) {
        continue
      }
      this.loadedFiles[file] = undefined
      // const url = this.getURL(file)
      let content: Uint8Array
      try {
        content = await this.loader.loadFile(file)
        // content = await download(url)
      } catch (e) {
        errors.push([file, typeof e === 'number' ? e : (e as Error).message])
        continue
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
          const newFileGroups = parseSchema(obj)
          for (const newFileGroup of newFileGroups) {
            promises.push(this.loadFileGroup(newFileGroup.map(newFile => newFile.endsWith('.json') ? `opencc/${newFile}` : newFile)))
          }
        } else if (file.endsWith('.dict.yaml')) {
          let obj: object
          try {
            obj = yaml.loadAll(s)[0] as object
          } catch {
            const start = s.match(/(^|\n)---\n/)?.index
            obj = yaml.load(s.slice(start, s.indexOf('\n...'))) as object // some tables contain invalid syntax
          }
          const newFileGroups = parseDict(obj)
          for (const newFileGroup of newFileGroups) {
            promises.push(this.loadFileGroup(newFileGroup))
          }
        }
      } else if (file.endsWith('.json')) {
        const obj = JSON.parse(u2s(content))
        const newFileGroups = parseOpenCC(obj)
        for (const newFileGroup of newFileGroups) {
          promises.push(this.loadFileGroup(newFileGroup.map(newFile => `opencc/${newFile}`)))
        }
      } else if (file.endsWith('.lua')) {
        const newFileGroups = parseLua(u2s(content))
        for (const newFileGroup of newFileGroups) {
          promises.push(this.loadFileGroup(newFileGroup))
        }
      }
      return Promise.all(promises)
    }
    if (this.onLoadFailure) {
      for (const [url, error] of errors) {
        this.onLoadFailure(url, error)
      }
    }
  }

  async load () {
    if (this.loader.repo in generic) {
      await Promise.all(generic[this.loader.repo].map(fileGroup => this.loadFileGroup(fileGroup)))
    } else {
      await Promise.all(this.loader.schemaIds.map(async schemaId => {
        const file = `${schemaId}.schema.yaml`
        return this.loadFileGroup([file])
      }))
    }
    return Object.entries(this.loadedFiles).map(([file, content]) => ({ file, content }))
  }
}

export {
  u2s,
  type FileLoader,
  Recipe
}
