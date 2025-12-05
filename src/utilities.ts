import type { CETEIInstance, CETEINode, UtilitiesAPI, HandlerFunction, PrefixDef } from "./types.js";

const ELEMENT_NODE = 1;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;

const isElement = (node: Node | null): node is Element => {
  return !!node && node.nodeType === ELEMENT_NODE;
};

const isDocument = (node: Node | null): node is Document => {
  return !!node && node.nodeType === DOCUMENT_NODE;
};

const isDocumentFragment = (node: Node | null): node is DocumentFragment => {
  return !!node && node.nodeType === DOCUMENT_FRAGMENT_NODE;
};

export function getOrdinality(elt: Element | null, name?: string): number {
  let pos = 1;
  let e = elt;
  while (e && e.previousElementSibling !== null && (name ? e.previousElementSibling.localName == name : true)) {
    pos++;
    e = e.previousElementSibling;
    if (!e.previousElementSibling) {
      break;
    }
  }
  return pos;
}

/* 
  Performs a deep copy operation of the input node while stripping
  out child elements introduced by CETEIcean.
*/ 
export function copyAndReset<T extends CETEINode>(node: T): T {
  const doc = node.ownerDocument || (node as Document);
  const clone = (n: Node): Node => {    
    let result: Node;
    switch (n.nodeType) {
      case ELEMENT_NODE:
        result = doc.createElement((n as Element).nodeName);
        break;
      case DOCUMENT_NODE:
        result = (n as Document).implementation.createDocument(
          null,
          (n as Document).documentElement?.nodeName ?? "",
          null
        );
        break;
      case DOCUMENT_FRAGMENT_NODE:
        result = doc.createDocumentFragment();
        break;
      default:
        result = n.cloneNode(true);
    }
    if (isElement(n) && isElement(result)) {
      for (const att of Array.from(n.attributes)) {
        if (att.name !== "data-processed") {
          result.setAttribute(att.name, att.value);
        }
      }
    }
    for (const nd of Array.from(n.childNodes)){
      if (isElement(nd)) {
        if (nd.hasAttribute("data-original")) {
          for (const childNode of Array.from(nd.childNodes)) {
            const child = result.appendChild(clone(childNode));
            if (isElement(child) && child.hasAttribute("data-origid")) {
              const orig = child.getAttribute("data-origid") || "";
              child.setAttribute("id", orig);
              child.removeAttribute("data-origid");
            }
          }
          return result;
        } else if (nd.hasAttribute("data-origname")) {
          result.appendChild(clone(nd));
        }
      } else {
        result.appendChild(nd.cloneNode());
      }
    }
    return result;
  }
  return clone(node) as T;
}

/* 
  Given a space-separated list of URLs (e.g. in a ref with multiple
  targets), returns just the first one.
*/
export function first(urls: string): string {
  return urls.replace(/ .*$/, "");
}

/* 
  Wraps the content of the element parameter in a hidden <cetei-original data-original>
*/
export function hideContent(elt: Element, rewriteIds = true): void {
  const doc = elt.ownerDocument;
  if (elt.childNodes.length > 0) {
    let hidden = doc.createElement("cetei-original");
    elt.appendChild(hidden);
    hidden.setAttribute("hidden", "");
    hidden.setAttribute("data-original", "");
    hidden.setAttribute("role", "none");
    const children = Array.from(elt.childNodes);
    for (let node of children) {
      if (node === hidden) {
        continue;
      }
      if (isElement(node)) {
        node.setAttribute("data-processed", "");
        for (let e of Array.from(node.querySelectorAll("*"))) {
          e.setAttribute("data-processed", "");
        }
      }
      hidden.appendChild(elt.removeChild(node));
    }
    if (rewriteIds) {
      for (let e of Array.from(hidden.querySelectorAll("*"))) {
        if (e.hasAttribute("id")) {
          e.setAttribute("data-origid", e.getAttribute("id"));
          e.removeAttribute("id");
        }
      }
    }
  }
}

export function normalizeURI(this: UtilitiesAPI, urls: string): string {
  const firstUrl = this.first ? this.first(urls) : first(urls);
  const rewriter = this.rw as ((url: string) => string) | undefined;
  return rewriter ? rewriter(firstUrl) : firstUrl;
}

/* 
  Takes a string and a number and returns the original string
  printed that number of times.
*/
export function repeat(str: string, times: number): string {
  let result = "";
  for (let i = 0; i < times; i++) {
    result += str;
  }
  return result;
}

/* 
  Resolves URIs that use TEI prefixDefs into full URIs.
  See https://www.tei-c.org/release/doc/tei-p5-doc/en/html/ref-prefixDef.html
*/
export function resolveURI(this: CETEIInstance, uri: string): string {
  const colonIndex = uri.indexOf(":");
  if (colonIndex === -1) {
    return uri;
  }
  const prefix = uri.substring(0, colonIndex);
  const prefixdef = this.prefixDefs[prefix];
  if (!prefixdef) {
    return uri;
  }
  return uri.replace(new RegExp(prefixdef.matchPattern), prefixdef.replacementPattern);
}

/*
  Convenience function for getting prefix definitions, Takes a prefix
  and returns an object with "matchPattern" and "replacementPattern"
  keys.
*/
export function getPrefixDef(this: CETEIInstance, prefix: string): PrefixDef | undefined {
  return this.prefixDefs[prefix];
}

/* 
  Takes a relative URL and rewrites it based on the base URL of the
  HTML document
*/
export function rw(this: CETEIInstance, url: string): string {
  if (!url.trim().match(/^(?:http|mailto|file|\/|#).*$/)) {
    return (this.base || "") + first(url.trim());
  }
  return url;
}

/*
  Combines the functionality of copyAndReset() and serialize() to return
  a "clean" version of the XML markup.
 */
export function resetAndSerialize(el: Element, stripElt?: boolean, ws?: string | boolean): string {
  return serialize(copyAndReset(el), stripElt, ws);
}

/* 
  Takes an element and serializes it to an XML string or, if the stripElt
  parameter is set, serializes the element's content. The ws parameter, if
  set, will switch on minimal "pretty-printing" and indenting of the serialized
  result.
*/
export function serialize(el: CETEINode, stripElt?: boolean, ws?: string | boolean): string {
  let str = "";
  const ignorable = (txt: string | null | undefined): boolean => {
    return !txt ? true : !(/[^\t\n\r ]/.test(txt));
  }
  const isRootLike = isDocument(el) || isDocumentFragment(el);
  if (isRootLike) {
    str += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  }
  if (!stripElt && isElement(el)) {
    if ((typeof ws === "string") && ws !== "") {
      str += "\n" + ws + "<";
    } else  {
      str += "<";
    }
    str += el.getAttribute("data-origname");
    const attrNames = el.hasAttribute("data-origatts") ? (el.getAttribute("data-origatts") || "").split(" ") : [];
    for (let attr of Array.from(el.attributes)) {
      if (!attr.name.startsWith("data-") 
        && !attr.name.startsWith("tei-") 
        && !attr.name.startsWith("aria-")
        && !( ["id", "lang", "class"].includes(attr.name))) {
        const originalName = attrNames.find((e) => e.toLowerCase() == attr.name) || attr.name;
        str += ` ${originalName}="${attr.value}"`;
      }
      if (attr.name == "data-xmlns") {
        str += ` xmlns="${attr.value}"`;
      }
      if (attr.name.startsWith("tei-")) {
        const originalName = attrNames.find((e) => e.toLowerCase() == attr.name.replace("tei-", "")) || attr.name.replace("tei-", "");
        str += ` ${originalName}="${attr.value}"`;
      }
    }
    if (el.childNodes.length > 0) {
      str += ">";
    } else {
      str += "/>";
    }
  }
  for (let node of Array.from(el.childNodes)) {
    switch (node.nodeType) {
      case ELEMENT_NODE:
        if (typeof ws === "string") {
          str += serialize(node as Element, false, ws + "  ");
        } else {
          str += serialize(node as Element, false, ws);
        }
        break;
      case PROCESSING_INSTRUCTION_NODE:
        str += `<?${node.nodeName} ${node.nodeValue ?? ""}?>`;
        if (isRootLike) {
          str += "\n";
        }
        break;
      case COMMENT_NODE:
        str += `<!--${node.nodeValue ?? ""}-->`;
        if (isRootLike) {
          str += "\n";
        }
        break;
      default:
        const value = node.nodeValue ?? "";
        if (stripElt && ignorable(value)) {
          str += value.replace(/^\s*\n/, "");
        }
        if ((typeof ws === "string") && ignorable(value)) {
          break;
        }
        str += value;
    }
  }
  if (!stripElt && isElement(el) && el.childNodes.length > 0) {
    if (typeof ws === "string") {
      str += "\n" + ws + "</";
    } else  {
      str += "</";
    }
    str += `${el.getAttribute("data-origname")}>`;
  }
  if (isRootLike) {
    str += "\n";
  }
  return str;
}

/* 
  Write out the HTML markup to a string, using HTML conventions.
 */
export function serializeHTML(el: CETEINode, stripElt?: boolean, ws?: string | boolean): string {
  const EMPTY_ELEMENTS = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  let str = "";
  const ignorable = (txt: string | null | undefined) => {
    return !txt ? true : !(/[^	\n\r ]/.test(txt));
  }
  const isRootLike = isDocument(el) || isDocumentFragment(el);
  if (!stripElt && isElement(el)) {
    if ((typeof ws === "string") && ws !== "") {
      str += "\n" + ws + "<";
    } else  {
      str += "<";
    }
    str += el.nodeName;
    for (let attr of Array.from(el.attributes)) {
      str += ` ${attr.name}="${attr.value}"`;
    }
    str += ">";
  }
  for (let node of Array.from(el.childNodes)) {
    switch (node.nodeType) {
      case ELEMENT_NODE:
        if (typeof ws === "string") {
          str += serializeHTML(node as Element, false, ws + "  ");
        } else {
          str += serializeHTML(node as Element, false, ws);
        }
        break;
      case PROCESSING_INSTRUCTION_NODE:
        str += `<?${node.nodeName} ${node.nodeValue ?? ""}?>`;
        if (isRootLike) {
          str += "\n";
        }
        break;
      case COMMENT_NODE:
        str += `<!--${node.nodeValue ?? ""}-->`;
        if (isRootLike) {
          str += "\n";
        }
        break;
      default:
        const value = node.nodeValue ?? "";
        if (stripElt && ignorable(value)) {
          str += value.replace(/^\s*\n/, "");
        }
        if ((typeof ws === "string") && ignorable(value)) {
          break;
        }
        str += value.replace(/</g, "&lt;");
    }
  }
  if (isElement(el)) {
    const nodeName = el.nodeName.toLowerCase();
    if (!EMPTY_ELEMENTS.includes(nodeName)) {
      if (!stripElt) {
        if (typeof ws === "string") {
          str += `\n${ws}</`;
        } else  {
          str += "</";
        }
        str += `${el.nodeName}>`;
      }
    }
  }
  if (isRootLike) {
    str += "\n";
  }
  return str;
}

export function unEscapeEntities(str: string): string {
  return str.replace(/&gt;/, ">")
            .replace(/&quot;/, "\"")
            .replace(/&apos;/, "'")
            .replace(/&amp;/, "&");
}

// Given a qualified name (e.g. tei:text), return the element name
export function tagName(name: string): string {
  if (name.includes(":"), 1) { //this comma operator makes it always true??
    return name.replace(/:/,"-").toLowerCase();
  } else {
    return "ceteicean-" + name.toLowerCase();
  }
}

export function defineCustomElement(name: string, behavior: HandlerFunction | null = null, debug = false): void {
  /* 
  Registers the list of elements provided with the browser.
  Called by makeHTML5(), but can be called independently if, for example,
  you've created Custom Elements via an XSLT transformation instead.
  */
  try {
    window.customElements.define(tagName(name), class extends HTMLElement {
      constructor() {
        super(); 
        if (!this.matches(":defined")) { // "Upgraded" undefined elements can have attributes & children; new elements can't
          if (behavior) {
            behavior.call(this);
            // We don't want to double-process elements, so add a flag
            this.setAttribute("data-processed", "");
          }
        }
      }
      // Process new elements when they are connected to the browser DOM
      connectedCallback() {
        if (!this.hasAttribute("data-processed")) {
          if (behavior) {
            behavior.call(this);
            this.setAttribute("data-processed", "");
          }
        }
      };
    });
  } catch (error) {
    // When using the same CETEIcean instance for multiple TEI files, this error becomes very common. 
    // It's muted by default unless the debug option is set.
    if (debug) {
        console.log(tagName(name) + " couldn't be registered or is already registered.");
        console.log(error);
    }
  }
}
