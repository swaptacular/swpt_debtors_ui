export type ParseOptions = {
  strict?: boolean,
  storeAsString?: boolean,
  protoAction?: "error" | "ignore" | "preserve",
  constructorAction?: "error" | "ignore" | "preserve",
}
export type ReviverFunction = (string, any) => any
export type ParseFunction = (source: string, reviver?: ReviverFunction) => any

export declare function json_parse(options?: ParseOptions): ParseFunction
