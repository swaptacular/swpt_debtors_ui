type ReplacerFunction = ((key: string, value: any) => any)
type ReplacerArray = any[]
type Replacer = ReplacerFunction | ReplacerArray

export function stringify(value: any, replacer?: Replacer, space?: string | number): string;
