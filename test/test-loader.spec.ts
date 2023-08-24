import { readFileSync } from 'fs'
import { expect, it } from 'vitest'
import {
  normalizeTarget,
  Recipe
} from '../src/loader'

const prefix = 'test/assets/'

const normalizeTargetCases = {
  '@foo': undefined,
  'luna-pinyin': {
    repo: 'rime/rime-luna-pinyin',
    branch: undefined,
    path: '',
    schema: undefined
  },
  'rime-luna-pinyin@foo': {
    repo: 'rime/rime-luna-pinyin',
    branch: 'foo',
    path: '',
    schema: undefined
  },
  'lotem/rime-zhengma': {
    repo: 'lotem/rime-zhengma',
    branch: undefined,
    path: '',
    schema: undefined
  },
  'lotem/rime-zhengma@foo': {
    repo: 'lotem/rime-zhengma',
    branch: 'foo',
    path: '',
    schema: undefined
  },
  'https://github.com/foo/bar/blob/master/path/to/baz.schema.yaml': {
    repo: 'foo/bar',
    branch: 'master',
    path: 'path/to/',
    schema: 'baz'
  },
  'http://github.com/foo/bar/blob/HEAD/%E4%B8%AD%E6%96%87/%E6%96%B9%E6%A1%88.schema.yaml': {
    repo: 'foo/bar',
    branch: undefined,
    path: '%E4%B8%AD%E6%96%87/',
    schema: '%E6%96%B9%E6%A1%88'
  },
  'https://raw.githubusercontent.com/foo/bar/master/path/to/baz.schema.yaml': {
    repo: 'foo/bar',
    branch: 'master',
    path: 'path/to/',
    schema: 'baz'
  }
}

it('Normalize target', () => {
  for (const [raw, normalized] of Object.entries(normalizeTargetCases)) {
    expect(normalizeTarget(raw)).toEqual(normalized)
  }
})

it('OpenCC URL', () => {
  const recipe = new Recipe('foo/bar', {
    source: 'jsDelivr'
  })
  for (const [file, url] of [
    ['opencc/t2tw.json', 'https://cdn.jsdelivr.net/npm/@libreservice/my-opencc@0.2.0/dist/opencc/t2tw.json'],
    ['opencc/TWPhrases.ocd2', 'https://cdn.jsdelivr.net/npm/@libreservice/my-opencc@0.2.0/dist/opencc/TWPhrases.ocd2'],
    ['opencc/random.json', 'https://cdn.jsdelivr.net/gh/foo/bar/opencc/random.json']
  ]) {
    expect(recipe.getURL(file)).toEqual(url)
  }
})

// Mock fetch so that it returns content for files that exist under test/assets, otherwise 404
// @ts-ignore
globalThis.fetch = async (url: string) => {
  if (url.indexOf('network_error') >= 0) {
    throw new Error('Network Error')
  }
  const match = url.match(/(lua|opencc)\//)
  const path = url.slice(match?.index || (url.lastIndexOf('/') + 1))
  try {
    const ab = new Uint8Array(readFileSync(prefix + path)).buffer
    return {
      ok: true,
      async arrayBuffer () {
        return ab
      }
    }
  } catch {
    return {
      ok: false,
      status: 404
    }
  }
}

it('Invalid recipe', () => {
  expect(() => new Recipe('@foo')).toThrowError('Invalid target')
})

const cdnUrlCases: {
  source: 'GitHub' | 'jsDelivr'
  target: string
  prefix: string
}[] = [
  { source: 'GitHub', target: 'user/repo', prefix: 'https://raw.githubusercontent.com/user/repo/HEAD/' },
  { source: 'GitHub', target: 'user/repo@branch', prefix: 'https://raw.githubusercontent.com/user/repo/branch/' },
  { source: 'jsDelivr', target: 'user/repo', prefix: 'https://cdn.jsdelivr.net/gh/user/repo/' },
  { source: 'jsDelivr', target: 'user/repo@branch', prefix: 'https://cdn.jsdelivr.net/gh/user/repo@branch/' }
]

it('CDN prefix', () => {
  for (const { source, target, prefix } of cdnUrlCases) {
    const recipe = new Recipe(target, { source })
    expect(recipe.getPrefix()).toEqual(prefix)
  }
})

const genericRecipeTestCases = {
  essay: ['essay.txt'],
  emoji: ['emoji_suggestion.yaml', 'opencc/emoji.json']
}

it('Load generic recipe', async () => {
  for (const [target, files] of Object.entries(genericRecipeTestCases)) {
    const recipe = new Recipe(target)
    const result = await recipe.load()
    expect(result.map(item => item.file).sort()).toEqual(files)
  }
})

it('Load recipe', async () => {
  const recipe = new Recipe('random', { schemaIds: ['base', 'base_dup'] })
  const result = await recipe.load()
  expect(result.map(item => item.file).sort()).toEqual([
    'base.schema.yaml',
    'base_dup.schema.yaml',
    'child.dict.yaml',
    'lua/external.lua',
    'lua/external/init.lua',
    'lua/processor.lua',
    'lua/processor/init.lua',
    'lua/segmentors/segmentor.lua',
    // no lua/segmentors/segmentor/init.lua as segmentor.lua exists
    'lua/sub_dir/module_name.lua',
    'lua/sub_dir/module_name/init.lua',
    'lua/sub_dir/module_name_1.lua',
    'lua/sub_dir/module_name_1/init.lua',
    'lua/utils/util.lua',
    'lua/utils/util/init.lua',
    'my-essay.txt',
    'nested.yaml',
    'opencc/a.txt',
    'opencc/b.txt',
    'opencc/c.txt',
    'opencc/oc.json',
    'parent.dict.yaml',
    'pinyin.yaml',
    'rime.lua',
    'sym.yaml'
  ])
})

const downloadFailureCases = {
  not_exist: 404,
  network_error: 'Network Error'
}

it('Download failure', async () => {
  for (const [schema, reason] of Object.entries(downloadFailureCases)) {
    let _reason: any
    const recipe = new Recipe('random', {
      schemaIds: [schema],
      onDownloadFailure (url: string, reason: number | string) {
        _reason = reason
      }
    })
    expect(await recipe.load()).toEqual([{
      content: undefined,
      file: `${schema}.schema.yaml`
    }])
    expect(_reason).toEqual(reason)
  }
})

it('Invalid .schema.yaml', () => {
  expect(() => new Recipe('https://github.com/foo/bar/blob/master/wrong.schema.yaml').load()).rejects.toThrow('Invalid wrong.schema.yaml')
})
