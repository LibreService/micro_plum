import { expandLua } from './util'

export function parseSchema (schema: object): string[][] {
  const result: string[] = []

  function parseInclude (obj: object) {
    for (const [key, value] of Object.entries(obj)) { // also works for Array
      if (key === '__include' || key === '__patch') {
        let values: string[]
        if (typeof value === 'string') {
          values = [value]
        } else if (Array.isArray(value)) {
          values = value
        } else {
          return parseInclude(value)
        }
        for (const v of values) {
          if (typeof v === 'string') {
            const i = v.indexOf(':')
            if (i >= 0) {
              let file = v.slice(0, i)
              if (!file.endsWith('.yaml')) {
                file += '.yaml'
              }
              result.push(file)
            }
          } else if (v && typeof v === 'object') {
            parseInclude(v)
          }
        }
      } else if (value && typeof value === 'object') {
        parseInclude(value)
      }
    }
  }

  parseInclude(schema)

  for (const [key, value] of Object.entries(schema)) {
    switch (key) {
      case 'engine':
        for (const component of ['processor', 'segmentor', 'translator', 'filter']) {
          const name = component + 's'
          if (name in value) {
            const pattern = RegExp(`^lua_${component}@(\\*)?([_a-zA-Z0-9]+(/[_a-zA-Z0-9]+)*)(@[_a-zA-Z0-9]+)?$`)
            for (const item of value[name] as string[]) {
              const match = item.match(pattern)
              if (match) {
                if (match[1]) {
                  result.push(`lua/${match[2]}.lua`)
                } else {
                  !result.includes('rime.lua') && result.push('rime.lua')
                }
              }
            }
          }
        }
        break
      case 'translator': {
        if (value.dictionary) {
          const dictYaml = value.dictionary + '.dict.yaml'
          result.push(dictYaml)
        }
        break
      }
      case 'punctuator':
        if (value.import_preset && !['default', 'symbols'].includes(value.import_preset)) {
          result.push(value.import_preset + '.yaml')
        }
        break
    }
    if (value && typeof value === 'object' && 'opencc_config' in value) {
      result.push(value.opencc_config)
    }
  }
  return result.map(expandLua)
}
