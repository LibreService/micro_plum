export function parseOpenCC (config: {
  segmentation: {
    dict: {
      file: string
    }
  },
  conversion_chain: [
    {
      dict: {
        file?: string,
        dicts: [
          {
            file: string
          }
        ]
      }
    }
  ]
}) {
  const result: string[] = []
  const add = (file: string) => !result.includes(file) && result.push(file)
  add(config.segmentation.dict.file)
  for (const { dict } of config.conversion_chain) {
    const { dicts, file } = dict
    file && add(file)
    if (dicts) {
      for (const item of dicts) {
        add(item.file)
      }
    }
  }
  return result
}
