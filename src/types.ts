
// Optional configuration accepted by the CETEI constructor.
export interface CETEIOptions {
  documentObject?: Document;
  base?: string;
  debug?: boolean;
  discardContent?: boolean;
  omitDefaultBehaviors?: boolean;
  ignoreFragmentId?: boolean;
}

// Map of namespace URIs (or null) to prefixes, mirroring CETEI.namespaces.
export type NamespaceMap = Map<string | null, string>;

// Structure that describes an item from the prefixDefs array.
export interface PrefixDef {
  matchPattern: string;
  replacementPattern: string;
}

// Helper methods bound onto `this.utilities` so behaviors can call them.
export interface UtilitiesAPI {
  [name: string]: any;
  rw?(url: string): string;
  resolveURI?(uri: string): string;
  getPrefixDef?(prefix: string): PrefixDef | undefined;
  hideContent?(elt: Element, rewriteIds?: boolean): void;
  serialize?(elt: Element | DocumentFragment, stripElt?: boolean, ws?: string | boolean): string;
}

// for the perElementFn parameter in getHTML5/makeHTML5/preprocess/domToHTML5
export type PerElementCallback = (converted: Element, source: Element) => void;


export type BehaviorFunction = (elt: Element) => Node | void;
// A css selector-based rule
export type BehaviorRule = [string, BehaviorDefinition];
export type BehaviorTemplate = [string] | [string, string] | BehaviorRule[];
export type BehaviorDefinition = BehaviorFunction | BehaviorTemplate;

// Record of element names to behavior definitions
export interface BehaviorDefinitionMap {
  [elementName: string]: BehaviorDefinition;
}

/**
 * Top-level behaviors object that can include namespace declarations and
 * per-prefix behavior maps. Additional keys (e.g., "tei", "teieg") map to
 * BehaviorDefinitionMap entries.
 */
type BehaviorNamespaces = Record<string, string>;
type BehaviorFunctions = Record<string, (...args: any[]) => any>;

export interface BehaviorsMap {
  namespaces?: BehaviorNamespaces;
  functions?: BehaviorFunctions;
  [prefix: string]: BehaviorDefinitionMap | BehaviorNamespaces | BehaviorFunctions | undefined;
}

/** Function type returned by getHandler/getFallback. */
export type HandlerFunction = (this: HTMLElement) => void;

/** Public surface of CETEI instances exposed through the generated d.ts. */
export interface CETEIInstance {
  document: Document;
  options: CETEIOptions;
  utilities: UtilitiesAPI;
  addBehaviors(map: BehaviorsMap): void;
  addBehavior(ns: string | Record<string, string>, element: string, behavior: BehaviorDefinition): void;
  removeBehavior(ns: string | Record<string, string>, element: string): void;
  getHTML5(url: string, callback?: (dom: DocumentFragment, cet: CETEIInstance) => void, perElement?: PerElementCallback): Promise<DocumentFragment | void>;
  makeHTML5(xml: string, callback?: (dom: DocumentFragment, cet: CETEIInstance) => void, perElement?: PerElementCallback): DocumentFragment | void;
  domToHTML5(doc: Document, callback?: (dom: DocumentFragment, cet: CETEIInstance) => void, perElement?: PerElementCallback): DocumentFragment | void;
  setBaseUrl(base: string): void;
}
