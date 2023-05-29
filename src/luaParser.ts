import { parse, Node } from 'luaparse'

export function parseLua (content: string) {
  const result: string[] = []
  parse(content, {
    luaVersion: '5.3',
    onCreateNode (node: Node) {
      if (node.type === 'CallExpression') {
        const { base, arguments: args } = node
        if (base.type === 'Identifier' &&
        base.name === 'require' &&
        args.length === 1) {
          const arg = args[0]
          if (arg.type === 'StringLiteral' && arg.raw.match(/'[_a-zA-Z0-9.]+'|"[_a-zA-Z0-9.]+"/)) {
            const module = arg.raw.slice(1, -1)
            result.push(`lua/${module.split('.').join('/')}.lua`)
          }
        }
      }
    }
  })
  return result
}
