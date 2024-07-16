import { parse, Node } from 'luaparse'
import { expandLua } from './util'

export function parseLua (content: string): string[][] {
  const luaFiles: string[] = []
  const ast = parse(content, {
    luaVersion: '5.3',
    onCreateNode (node: Node) {
      if (node.type === 'CallExpression') {
        const { base, arguments: args } = node
        if (base.type === 'Identifier' &&
        (base.name === 'require' || base.name === 'dofile') &&
        args.length === 1) {
          const arg = args[0]
          if (arg.type === 'StringLiteral' && arg.raw.match(/'[_a-zA-Z0-9./]+'|"[_a-zA-Z0-9./]+"/)) {
            const module = arg.raw.slice(1, -1)
            luaFiles.push(`lua/${module.replaceAll('.', '/')}.lua`)
          }
        }
      }
    }
  })
  const result: string[][] = luaFiles.map(expandLua)
  for (const comment of ast.comments || []) {
    const m = (comment as any).raw.match(/@dependency +(.*)/)
    if (!m) {
      continue
    }
    const filename = m[1]
    result.push([filename])
  }
  return result
}
