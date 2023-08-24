import { readFileSync } from 'fs'
import yaml from 'js-yaml'
import { expect, it } from 'vitest'
import {
  parseOpenCC,
  parseSchema,
  parseDict,
  parseLua
} from '../src/parser'

const prefix = 'test/assets/'

it('Parse OpenCC config', () => {
  const content = readFileSync(prefix + 'opencc/oc.json', { encoding: 'utf-8' })
  const obj = JSON.parse(content)
  expect(parseOpenCC(obj)).toEqual([
    ['a.txt'],
    ['b.txt'],
    ['c.txt']
  ])
})

function loadYaml (file: string) {
  return yaml.loadAll(readFileSync(prefix + file, { encoding: 'utf-8' }))[0] as object
}

const schemaCases = {
  'base.schema.yaml': [
    ['pinyin.yaml'],
    ['rime.lua'],
    ['lua/sub_dir/module_name.lua', 'lua/sub_dir/module_name/init.lua'],
    ['lua/sub_dir/module_name_1.lua', 'lua/sub_dir/module_name_1/init.lua'],
    ['parent.dict.yaml'],
    ['oc.json'],
    ['emoji.json'],
    ['sym.yaml']
  ],
  'derivative.schema.yaml': [
    ['base.schema.yaml'],
    ['default.yaml']
  ]
}

it('Parse schema', () => {
  for (const [file, expected] of Object.entries(schemaCases)) {
    const obj = loadYaml(file)
    expect(parseSchema(obj)).toEqual(expected)
  }
})

const dictCases = {
  'parent.dict.yaml': [
    ['my-essay.txt'],
    ['child.dict.yaml']
  ]
}

it('Parse dict', () => {
  for (const [file, expected] of Object.entries(dictCases)) {
    const obj = loadYaml(file)
    expect(parseDict(obj)).toEqual(expected)
  }
})

const luaCases = {
  'rime.lua': [
    ['lua/processor.lua', 'lua/processor/init.lua'],
    ['lua/segmentors/segmentor.lua', 'lua/segmentors/segmentor/init.lua']
  ],
  'lua/segmentors/segmentor.lua': [
    ['lua/external.lua', 'lua/external/init.lua'],
    ['lua/utils/util.lua', 'lua/utils/util/init.lua']
  ]
}

it('Parse Lua', () => {
  for (const [file, expected] of Object.entries(luaCases)) {
    const content = readFileSync(prefix + file, { encoding: 'utf-8' })
    expect(parseLua(content)).toEqual(expected)
  }
})
