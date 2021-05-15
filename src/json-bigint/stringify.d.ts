type ReplacerFunction = ((key: string, value: any) => any)
type ReplacerArray = any[]
type Replacer = ReplacerFunction | ReplacerArray

export declare function stringify(value: any, replacer?: Replacer, space?: string | number): string
