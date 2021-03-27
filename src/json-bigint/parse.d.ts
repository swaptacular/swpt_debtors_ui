type ParseOptions = {
  strict?: boolean;
  storeAsString?: boolean;
  protoAction?: 'error' | 'ignore' | 'preserve';
  constructorAction?: 'error' | 'ignore' | 'preserve';
}
type ReviverFunction = ((string, any) => any)
type ParseFunction = ((source: string, reviver?: ReviverFunction) => any)

export function json_parse(options?: ParseOptions): ParseFunction;
