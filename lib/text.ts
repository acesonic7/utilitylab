// Small copy helpers shared by the UI and the generated text (signature, methods paragraph).

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The separator before item i of n in a prose list: "", ", " or " and ". */
export function listSeparator(i: number, n: number): string {
  return i === 0 ? '' : i === n - 1 ? ' and ' : ', '
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  return names.map((name, i) => listSeparator(i, names.length) + name).join('')
}
