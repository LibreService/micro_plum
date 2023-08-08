export function parseDict (schema: object) {
  const result: string[] = []
  for (const [key, value] of Object.entries(schema)) {
    switch (key) {
      case 'import_tables':
        for (const file of value || []) {
          result.push(file + '.dict.yaml')
        }
        break
      case 'vocabulary':
        result.push(value + '.txt')
        break
    }
  }
  return result
}
