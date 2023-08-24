function expandLua (file: string): string[] {
  const match = file.match(/^(lua\/.+)\.lua$/)
  if (match) {
    return [file, `${match[1]}/init.lua`]
  }
  return [file]
}

export {
  expandLua
}
