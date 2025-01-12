import he from 'he';
import { selectAll, selectOne } from 'css-select';
import Node from './node';
import NodeType from './type';
import TextNode from './text';
import Matcher from '../matcher';
import arr_back from '../back';
import CommentNode from './comment';
function decode(val) {
    // clone string
    return JSON.parse(JSON.stringify(he.decode(val)));
}
// https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements
const Htags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup'];
const Dtags = ['details', 'dialog', 'dd', 'div', 'dt'];
const Ftags = ['fieldset', 'figcaption', 'figure', 'footer', 'form'];
const tableTags = ['table', 'td', 'tr'];
const htmlTags = ['address', 'article', 'aside', 'blockquote', 'br', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'ul'];
const kBlockElements = new Set();
function addToKBlockElement(...args) {
    const addToSet = (array) => {
        for (let index = 0; index < array.length; index++) {
            const element = array[index];
            kBlockElements.add(element);
            kBlockElements.add(element.toUpperCase());
        }
    };
    for (const arg of args)
        addToSet(arg);
}
addToKBlockElement(Htags, Dtags, Ftags, tableTags, htmlTags);
class DOMTokenList {
    constructor(valuesInit = [], afterUpdate = () => null) {
        this._set = new Set(valuesInit);
        this._afterUpdate = afterUpdate;
    }
    _validate(c) {
        if (/\s/.test(c)) {
            throw new Error(`DOMException in DOMTokenList.add: The token '${c}' contains HTML space characters, which are not valid in tokens.`);
        }
    }
    add(c) {
        this._validate(c);
        this._set.add(c);
        this._afterUpdate(this); // eslint-disable-line @typescript-eslint/no-unsafe-call
    }
    replace(c1, c2) {
        this._validate(c2);
        this._set.delete(c1);
        this._set.add(c2);
        this._afterUpdate(this); // eslint-disable-line @typescript-eslint/no-unsafe-call
    }
    remove(c) {
        this._set.delete(c) && this._afterUpdate(this); // eslint-disable-line @typescript-eslint/no-unsafe-call
    }
    toggle(c) {
        this._validate(c);
        if (this._set.has(c))
            this._set.delete(c);
        else
            this._set.add(c);
        this._afterUpdate(this); // eslint-disable-line @typescript-eslint/no-unsafe-call
    }
    contains(c) {
        return this._set.has(c);
    }
    get length() {
        return this._set.size;
    }
    values() {
        return this._set.values();
    }
    get value() {
        return Array.from(this._set.values());
    }
    toString() {
        return Array.from(this._set.values()).join(' ');
    }
}
/**
 * HTMLElement, which contains a set of children.
 *
 * Note: this is a minimalist implementation, no complete tree
 *   structure provided (no parentNode, nextSibling,
 *   previousSibling etc).
 * @class HTMLElement
 * @extends {Node}
 */
export default class HTMLElement extends Node {
    /**
     * Creates an instance of HTMLElement.
     * @param keyAttrs	id and class attribute
     * @param [rawAttrs]	attributes in string
     *
     * @memberof HTMLElement
     */
    constructor(tagName, keyAttrs, rawAttrs = '', parentNode, range) {
        super(parentNode, range);
        this.rawAttrs = rawAttrs;
        /**
         * Node Type declaration.
         */
        this.nodeType = NodeType.ELEMENT_NODE;
        this.rawTagName = tagName;
        this.rawAttrs = rawAttrs || '';
        this.id = keyAttrs.id || '';
        this.childNodes = [];
        this.classList = new DOMTokenList(keyAttrs.class ? keyAttrs.class.split(/\s+/) : [], (classList) => this.setAttribute('class', classList.toString()) // eslint-disable-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        );
        if (keyAttrs.id) {
            if (!rawAttrs) {
                this.rawAttrs = `id="${keyAttrs.id}"`;
            }
        }
        if (keyAttrs.class) {
            if (!rawAttrs) {
                const cls = `class="${this.classList.toString()}"`;
                if (this.rawAttrs) {
                    this.rawAttrs += ` ${cls}`;
                }
                else {
                    this.rawAttrs = cls;
                }
            }
        }
    }
    /**
     * Quote attribute values
     * @param attr attribute value
     * @returns {string} quoted value
     */
    quoteAttribute(attr) {
        if (attr === null) {
            return 'null';
        }
        return JSON.stringify(attr.replace(/"/g, '&quot;'));
    }
    /**
     * Remove current element
     */
    remove() {
        if (this.parentNode) {
            const children = this.parentNode.childNodes;
            this.parentNode.childNodes = children.filter((child) => {
                return this !== child;
            });
        }
    }
    /**
     * Remove Child element from childNodes array
     * @param {HTMLElement} node     node to remove
     */
    removeChild(node) {
        this.childNodes = this.childNodes.filter((child) => {
            return child !== node;
        });
    }
    /**
     * Exchanges given child with new child
     * @param {HTMLElement} oldNode     node to exchange
     * @param {HTMLElement} newNode     new node
     */
    exchangeChild(oldNode, newNode) {
        const children = this.childNodes;
        this.childNodes = children.map((child) => {
            if (child === oldNode) {
                return newNode;
            }
            return child;
        });
    }
    get tagName() {
        return this.rawTagName ? this.rawTagName.toUpperCase() : this.rawTagName;
    }
    get localName() {
        return this.rawTagName.toLowerCase();
    }
    /**
     * Get escpaed (as-it) text value of current node and its children.
     * @return {string} text content
     */
    get rawText() {
        return this.childNodes.reduce((pre, cur) => {
            return (pre += cur.rawText);
        }, '');
    }
    get textContent() {
        return decode(this.rawText);
    }
    set textContent(val) {
        const content = [new TextNode(val, this)];
        this.childNodes = content;
    }
    setText(val) {
        const content = [new TextNode(val, this)];
        this.childNodes = content;
    }
    /**
     * Get unescaped text value of current node and its children.
     * @return {string} text content
     */
    get text() {
        return decode(this.rawText);
    }
    /**
     * Get structured Text (with '\n' etc.)
     * @return {string} structured text
     */
    get structuredText() {
        let currentBlock = [];
        const blocks = [currentBlock];
        function dfs(node) {
            if (node.nodeType === NodeType.ELEMENT_NODE) {
                if (kBlockElements.has(node.rawTagName)) {
                    if (currentBlock.length > 0) {
                        blocks.push((currentBlock = []));
                    }
                    node.childNodes.forEach(dfs);
                    if (currentBlock.length > 0) {
                        blocks.push((currentBlock = []));
                    }
                }
                else {
                    node.childNodes.forEach(dfs);
                }
            }
            else if (node.nodeType === NodeType.TEXT_NODE) {
                if (node.isWhitespace) {
                    // Whitespace node, postponed output
                    currentBlock.prependWhitespace = true;
                }
                else {
                    let text = node.trimmedText;
                    if (currentBlock.prependWhitespace) {
                        text = ` ${text}`;
                        currentBlock.prependWhitespace = false;
                    }
                    currentBlock.push(text);
                }
            }
        }
        dfs(this);
        return blocks
            .map((block) => {
            return block.join('').replace(/\s{2,}/g, ' '); // Normalize each line's whitespace
        })
            .join('\n')
            .replace(/\s+$/, ''); // trimRight;
    }
    toString() {
        const tag = this.rawTagName;
        if (tag) {
            // const void_tags = new Set('area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr'.split('|'));
            // const is_void = void_tags.has(tag);
            const is_void = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tag);
            const attrs = this.rawAttrs ? ` ${this.rawAttrs}` : '';
            if (is_void) {
                return `<${tag}${attrs}>`;
            }
            return `<${tag}${attrs}>${this.innerHTML}</${tag}>`;
        }
        return this.innerHTML;
    }
    get innerHTML() {
        return this.childNodes
            .map((child) => {
            return child.toString();
        })
            .join('');
    }
    set innerHTML(content) {
        //const r = parse(content, global.options); // TODO global.options ?
        const r = parse(content);
        this.childNodes = r.childNodes.length ? r.childNodes : [new TextNode(content, this)];
    }
    set_content(content, options = {}) {
        if (content instanceof Node) {
            content = [content];
        }
        else if (typeof content == 'string') {
            const r = parse(content, options);
            content = r.childNodes.length ? r.childNodes : [new TextNode(content, this)];
        }
        this.childNodes = content;
    }
    replaceWith(...nodes) {
        const content = nodes
            .map((node) => {
            if (node instanceof Node) {
                return [node];
            }
            else if (typeof node == 'string') {
                // const r = parse(content, global.options); // TODO global.options ?
                const r = parse(node);
                return r.childNodes.length ? r.childNodes : [new TextNode(node, this)];
            }
            return [];
        })
            .flat();
        const idx = this.parentNode.childNodes.findIndex((child) => {
            return child === this;
        });
        this.parentNode.childNodes = [
            ...this.parentNode.childNodes.slice(0, idx),
            ...content,
            ...this.parentNode.childNodes.slice(idx + 1),
        ];
    }
    get outerHTML() {
        return this.toString();
    }
    /**
     * Trim element from right (in block) after seeing pattern in a TextNode.
     * @param  {RegExp} pattern pattern to find
     * @return {HTMLElement}    reference to current node
     */
    trimRight(pattern) {
        for (let i = 0; i < this.childNodes.length; i++) {
            const childNode = this.childNodes[i];
            if (childNode.nodeType === NodeType.ELEMENT_NODE) {
                childNode.trimRight(pattern);
            }
            else {
                const index = childNode.rawText.search(pattern);
                if (index > -1) {
                    childNode.rawText = childNode.rawText.substr(0, index);
                    // trim all following nodes.
                    this.childNodes.length = i + 1;
                }
            }
        }
        return this;
    }
    /**
     * Get DOM structure
     * @return {string} strucutre
     */
    get structure() {
        const res = [];
        let indention = 0;
        function write(str) {
            res.push('  '.repeat(indention) + str);
        }
        function dfs(node) {
            const idStr = node.id ? `#${node.id}` : '';
            const classStr = node.classList.length ? `.${node.classList.value.join('.')}` : ''; // eslint-disable-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-call
            write(`${node.rawTagName}${idStr}${classStr}`);
            indention++;
            node.childNodes.forEach((childNode) => {
                if (childNode.nodeType === NodeType.ELEMENT_NODE) {
                    dfs(childNode);
                }
                else if (childNode.nodeType === NodeType.TEXT_NODE) {
                    if (!childNode.isWhitespace) {
                        write('#text');
                    }
                }
            });
            indention--;
        }
        dfs(this);
        return res.join('\n');
    }
    /**
     * Remove whitespaces in this sub tree.
     * @return {HTMLElement} pointer to this
     */
    removeWhitespace() {
        let o = 0;
        this.childNodes.forEach((node) => {
            if (node.nodeType === NodeType.TEXT_NODE) {
                if (node.isWhitespace) {
                    return;
                }
                node.rawText = node.trimmedRawText;
            }
            else if (node.nodeType === NodeType.ELEMENT_NODE) {
                node.removeWhitespace();
            }
            this.childNodes[o++] = node;
        });
        this.childNodes.length = o;
        return this;
    }
    /**
     * Query CSS selector to find matching nodes.
     * @param  {string}         selector Simplified CSS selector
     * @return {HTMLElement[]}  matching elements
     */
    querySelectorAll(selector) {
        return selectAll(selector, this, {
            xmlMode: true,
            adapter: Matcher,
        });
        // let matcher: Matcher;
        // if (selector instanceof Matcher) {
        // 	matcher = selector;
        // 	matcher.reset();
        // } else {
        // 	if (selector.includes(',')) {
        // 		const selectors = selector.split(',');
        // 		return Array.from(selectors.reduce((pre, cur) => {
        // 			const result = this.querySelectorAll(cur.trim());
        // 			return result.reduce((p, c) => {
        // 				return p.add(c);
        // 			}, pre);
        // 		}, new Set<HTMLElement>()));
        // 	}
        // 	matcher = new Matcher(selector);
        // }
        // interface IStack {
        // 	0: Node;	// node
        // 	1: number;	// children
        // 	2: boolean;	// found flag
        // }
        // const stack = [] as IStack[];
        // return this.childNodes.reduce((res, cur) => {
        // 	stack.push([cur, 0, false]);
        // 	while (stack.length) {
        // 		const state = arr_back(stack);	// get last element
        // 		const el = state[0];
        // 		if (state[1] === 0) {
        // 			// Seen for first time.
        // 			if (el.nodeType !== NodeType.ELEMENT_NODE) {
        // 				stack.pop();
        // 				continue;
        // 			}
        // 			const html_el = el as HTMLElement;
        // 			state[2] = matcher.advance(html_el);
        // 			if (state[2]) {
        // 				if (matcher.matched) {
        // 					res.push(html_el);
        // 					res.push(...(html_el.querySelectorAll(selector)));
        // 					// no need to go further.
        // 					matcher.rewind();
        // 					stack.pop();
        // 					continue;
        // 				}
        // 			}
        // 		}
        // 		if (state[1] < el.childNodes.length) {
        // 			stack.push([el.childNodes[state[1]++], 0, false]);
        // 		} else {
        // 			if (state[2]) {
        // 				matcher.rewind();
        // 			}
        // 			stack.pop();
        // 		}
        // 	}
        // 	return res;
        // }, [] as HTMLElement[]);
    }
    /**
     * Query CSS Selector to find matching node.
     * @param  {string}         selector Simplified CSS selector
     * @return {HTMLElement}    matching node
     */
    querySelector(selector) {
        return selectOne(selector, this, {
            xmlMode: true,
            adapter: Matcher,
        });
        // let matcher: Matcher;
        // if (selector instanceof Matcher) {
        // 	matcher = selector;
        // 	matcher.reset();
        // } else {
        // 	matcher = new Matcher(selector);
        // }
        // const stack = [] as { 0: Node; 1: 0 | 1; 2: boolean }[];
        // for (const node of this.childNodes) {
        // 	stack.push([node, 0, false]);
        // 	while (stack.length) {
        // 		const state = arr_back(stack);
        // 		const el = state[0];
        // 		if (state[1] === 0) {
        // 			// Seen for first time.
        // 			if (el.nodeType !== NodeType.ELEMENT_NODE) {
        // 				stack.pop();
        // 				continue;
        // 			}
        // 			state[2] = matcher.advance(el as HTMLElement);
        // 			if (state[2]) {
        // 				if (matcher.matched) {
        // 					return el as HTMLElement;
        // 				}
        // 			}
        // 		}
        // 		if (state[1] < el.childNodes.length) {
        // 			stack.push([el.childNodes[state[1]++], 0, false]);
        // 		} else {
        // 			if (state[2]) {
        // 				matcher.rewind();
        // 			}
        // 			stack.pop();
        // 		}
        // 	}
        // }
        // return null;
    }
    /**
     * traverses the Element and its parents (heading toward the document root) until it finds a node that matches the provided selector string. Will return itself or the matching ancestor. If no such element exists, it returns null.
     * @param selector a DOMString containing a selector list
     */
    closest(selector) {
        const mapChild = new Map();
        let el = this;
        let old = null;
        function findOne(test, elems) {
            let elem = null;
            for (let i = 0, l = elems.length; i < l && !elem; i++) {
                const el = elems[i];
                if (test(el)) {
                    elem = el;
                }
                else {
                    const child = mapChild.get(el);
                    if (child) {
                        elem = findOne(test, [child]);
                    }
                }
            }
            return elem;
        }
        while (el) {
            mapChild.set(el, old);
            old = el;
            el = el.parentNode;
        }
        el = this;
        while (el) {
            const e = selectOne(selector, el, {
                xmlMode: true,
                adapter: {
                    ...Matcher,
                    getChildren(node) {
                        const child = mapChild.get(node);
                        return child && [child];
                    },
                    getSiblings(node) {
                        return [node];
                    },
                    findOne,
                    findAll() {
                        return [];
                    },
                },
            });
            if (e) {
                return e;
            }
            el = el.parentNode;
        }
        return null;
    }
    /**
     * Append a child node to childNodes
     * @param  {Node} node node to append
     * @return {Node}      node appended
     */
    appendChild(node) {
        // node.parentNode = this;
        this.childNodes.push(node);
        node.parentNode = this;
        return node;
    }
    /**
     * Get first child node
     * @return {Node} first child node
     */
    get firstChild() {
        return this.childNodes[0];
    }
    /**
     * Get last child node
     * @return {Node} last child node
     */
    get lastChild() {
        return arr_back(this.childNodes);
    }
    /**
     * Get attributes
     * @access private
     * @return {Object} parsed and unescaped attributes
     */
    get attrs() {
        if (this._attrs) {
            return this._attrs;
        }
        this._attrs = {};
        const attrs = this.rawAttributes;
        for (const key in attrs) {
            const val = attrs[key] || '';
            this._attrs[key.toLowerCase()] = decode(val);
        }
        return this._attrs;
    }
    get attributes() {
        const ret_attrs = {};
        const attrs = this.rawAttributes;
        for (const key in attrs) {
            const val = attrs[key] || '';
            ret_attrs[key] = decode(val);
        }
        return ret_attrs;
    }
    /**
     * Get escaped (as-it) attributes
     * @return {Object} parsed attributes
     */
    get rawAttributes() {
        if (this._rawAttrs) {
            return this._rawAttrs;
        }
        const attrs = {};
        if (this.rawAttrs) {
            const re = /([a-z()#][a-z0-9-_:()#]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/gi;
            let match;
            while ((match = re.exec(this.rawAttrs))) {
                attrs[match[1]] = match[2] || match[3] || match[4] || null;
            }
        }
        this._rawAttrs = attrs;
        return attrs;
    }
    removeAttribute(key) {
        const attrs = this.rawAttributes;
        delete attrs[key];
        // Update this.attribute
        if (this._attrs) {
            delete this._attrs[key];
        }
        // Update rawString
        this.rawAttrs = Object.keys(attrs)
            .map((name) => {
            const val = JSON.stringify(attrs[name]);
            if (val === undefined || val === 'null') {
                return name;
            }
            return `${name}=${val}`;
        })
            .join(' ');
        // Update this.id
        if (key === 'id') {
            this.id = '';
        }
    }
    hasAttribute(key) {
        return key.toLowerCase() in this.attrs;
    }
    /**
     * Get an attribute
     * @return {string} value of the attribute
     */
    getAttribute(key) {
        return this.attrs[key.toLowerCase()];
    }
    /**
     * Set an attribute value to the HTMLElement
     * @param {string} key The attribute name
     * @param {string} value The value to set, or null / undefined to remove an attribute
     */
    setAttribute(key, value) {
        if (arguments.length < 2) {
            throw new Error("Failed to execute 'setAttribute' on 'Element'");
        }
        const k2 = key.toLowerCase();
        const attrs = this.rawAttributes;
        for (const k in attrs) {
            if (k.toLowerCase() === k2) {
                key = k;
                break;
            }
        }
        attrs[key] = String(value);
        // update this.attrs
        if (this._attrs) {
            this._attrs[k2] = decode(attrs[key]);
        }
        // Update rawString
        this.rawAttrs = Object.keys(attrs)
            .map((name) => {
            const val = this.quoteAttribute(attrs[name]);
            if (val === 'null' || val === '""')
                return name;
            return `${name}=${val}`;
        })
            .join(' ');
        // Update this.id
        if (key === 'id') {
            this.id = value;
        }
    }
    /**
     * Replace all the attributes of the HTMLElement by the provided attributes
     * @param {Attributes} attributes the new attribute set
     */
    setAttributes(attributes) {
        // Invalidate current this.attributes
        if (this._attrs) {
            delete this._attrs;
        }
        // Invalidate current this.rawAttributes
        if (this._rawAttrs) {
            delete this._rawAttrs;
        }
        // Update rawString
        this.rawAttrs = Object.keys(attributes)
            .map((name) => {
            const val = attributes[name];
            if (val === 'null' || val === '""')
                return name;
            return `${name}=${this.quoteAttribute(String(val))}`;
        })
            .join(' ');
    }
    insertAdjacentHTML(where, html) {
        if (arguments.length < 2) {
            throw new Error('2 arguments required');
        }
        const p = parse(html);
        if (where === 'afterend') {
            const idx = this.parentNode.childNodes.findIndex((child) => {
                return child === this;
            });
            this.parentNode.childNodes.splice(idx + 1, 0, ...p.childNodes);
            p.childNodes.forEach((n) => {
                if (n instanceof HTMLElement) {
                    n.parentNode = this.parentNode;
                }
            });
        }
        else if (where === 'afterbegin') {
            this.childNodes.unshift(...p.childNodes);
        }
        else if (where === 'beforeend') {
            p.childNodes.forEach((n) => {
                this.appendChild(n);
            });
        }
        else if (where === 'beforebegin') {
            const idx = this.parentNode.childNodes.findIndex((child) => {
                return child === this;
            });
            this.parentNode.childNodes.splice(idx, 0, ...p.childNodes);
            p.childNodes.forEach((n) => {
                if (n instanceof HTMLElement) {
                    n.parentNode = this.parentNode;
                }
            });
        }
        else {
            throw new Error(`The value provided ('${where}') is not one of 'beforebegin', 'afterbegin', 'beforeend', or 'afterend'`);
        }
        // if (!where || html === undefined || html === null) {
        // 	return;
        // }
    }
    get nextSibling() {
        if (this.parentNode) {
            const children = this.parentNode.childNodes;
            let i = 0;
            while (i < children.length) {
                const child = children[i++];
                if (this === child)
                    return children[i] || null;
            }
            return null;
        }
    }
    get nextElementSibling() {
        if (this.parentNode) {
            const children = this.parentNode.childNodes;
            let i = 0;
            let find = false;
            while (i < children.length) {
                const child = children[i++];
                if (find) {
                    if (child instanceof HTMLElement) {
                        return child || null;
                    }
                }
                else if (this === child) {
                    find = true;
                }
            }
            return null;
        }
    }
    get classNames() {
        return this.classList.toString();
    }
}
// https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
const kMarkupPattern = /<!--[^]*?(?=-->)-->|<(\/?)([a-z][-.:0-9_a-z]*)\s*((?=[/>]*?)|(?:.*?[\s\d/'"])|(?:.*?[\w]))(\/?)>/gi;
// <(?<tag>[^\s]*)(.*)>(.*)</\k<tag>>
// <([a-z][-.:0-9_a-z]*)\s*\/>
// <(area|base|br|col|hr|img|input|link|meta|source)\s*(.*)\/?>
// <(area|base|br|col|hr|img|input|link|meta|source)\s*(.*)\/?>|<(?<tag>[^\s]*)(.*)>(.*)</\k<tag>>
const kAttributePattern = /(^|\s)(id|class)\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/gi;
const kSelfClosingElements = {
    area: true,
    AREA: true,
    base: true,
    BASE: true,
    br: true,
    BR: true,
    col: true,
    COL: true,
    hr: true,
    HR: true,
    img: true,
    IMG: true,
    input: true,
    INPUT: true,
    link: true,
    LINK: true,
    meta: true,
    META: true,
    source: true,
    SOURCE: true,
    embed: true,
    EMBED: true,
    param: true,
    PARAM: true,
    track: true,
    TRACK: true,
    wbr: true,
    WBR: true,
};
const kElementsClosedByOpening = {
    li: { li: true, LI: true },
    LI: { li: true, LI: true },
    p: { p: true, div: true, P: true, DIV: true },
    P: { p: true, div: true, P: true, DIV: true },
    b: { div: true, DIV: true },
    B: { div: true, DIV: true },
    td: { td: true, th: true, TD: true, TH: true },
    TD: { td: true, th: true, TD: true, TH: true },
    th: { td: true, th: true, TD: true, TH: true },
    TH: { td: true, th: true, TD: true, TH: true },
    h1: { h1: true, H1: true },
    H1: { h1: true, H1: true },
    h2: { h2: true, H2: true },
    H2: { h2: true, H2: true },
    h3: { h3: true, H3: true },
    H3: { h3: true, H3: true },
    h4: { h4: true, H4: true },
    H4: { h4: true, H4: true },
    h5: { h5: true, H5: true },
    H5: { h5: true, H5: true },
    h6: { h6: true, H6: true },
    H6: { h6: true, H6: true },
};
const kElementsClosedByClosing = {
    li: { ul: true, ol: true, UL: true, OL: true },
    LI: { ul: true, ol: true, UL: true, OL: true },
    a: { div: true, DIV: true },
    A: { div: true, DIV: true },
    b: { div: true, DIV: true },
    B: { div: true, DIV: true },
    i: { div: true, DIV: true },
    I: { div: true, DIV: true },
    p: { div: true, DIV: true },
    P: { div: true, DIV: true },
    td: { tr: true, table: true, TR: true, TABLE: true },
    TD: { tr: true, table: true, TR: true, TABLE: true },
    th: { tr: true, table: true, TR: true, TABLE: true },
    TH: { tr: true, table: true, TR: true, TABLE: true },
};
const frameflag = 'documentfragmentcontainer';
/**
 * Parses HTML and returns a root element
 * Parse a chuck of HTML source.
 * @param  {string} data      html
 * @return {HTMLElement}      root element
 */
export function base_parse(data, options = { lowerCaseTagName: false, comment: false }) {
    const elements = options.blockTextElements || {
        script: true,
        noscript: true,
        style: true,
        pre: true,
    };
    const element_names = Object.keys(elements);
    const kBlockTextElements = element_names.map((it) => new RegExp(it, 'i'));
    const kIgnoreElements = element_names.filter((it) => elements[it]).map((it) => new RegExp(it, 'i'));
    function element_should_be_ignore(tag) {
        return kIgnoreElements.some((it) => it.test(tag));
    }
    function is_block_text_element(tag) {
        return kBlockTextElements.some((it) => it.test(tag));
    }
    const createRange = (startPos, endPos) => [startPos - frameFlagOffset, endPos - frameFlagOffset];
    const root = new HTMLElement(null, {}, '', null, [0, data.length]);
    let currentParent = root;
    const stack = [root];
    let lastTextPos = -1;
    let noNestedTagIndex = undefined;
    let match;
    // https://github.com/taoqf/node-html-parser/issues/38
    data = `<${frameflag}>${data}</${frameflag}>`;
    const dataEndPos = data.length - (frameflag.length + 2);
    const frameFlagOffset = frameflag.length + 2;
    while ((match = kMarkupPattern.exec(data))) {
        const tagStartPos = kMarkupPattern.lastIndex - match[0].length;
        const tagEndPos = kMarkupPattern.lastIndex;
        // Add TextNode if content
        if (lastTextPos > -1) {
            if (lastTextPos + match[0].length < tagEndPos) {
                const text = data.substring(lastTextPos, tagStartPos);
                currentParent.appendChild(new TextNode(text, currentParent, createRange(lastTextPos, tagStartPos)));
            }
        }
        lastTextPos = kMarkupPattern.lastIndex;
        // https://github.com/taoqf/node-html-parser/issues/38
        // Skip frameflag node
        if (match[2] === frameflag)
            continue;
        // Handle comments
        if (match[0][1] === '!') {
            if (options.comment) {
                // Only keep what is in between <!-- and -->
                const text = data.substring(tagStartPos + 4, tagEndPos - 3);
                currentParent.appendChild(new CommentNode(text, currentParent, createRange(tagStartPos, tagEndPos)));
            }
            continue;
        }
        /* -- Handle tag matching -- */
        // Fix tag casing if necessary
        if (options.lowerCaseTagName)
            match[2] = match[2].toLowerCase();
        // Handle opening tags (ie. <this> not </that>)
        if (!match[1]) {
            /* Populate attributes */
            const attrs = {};
            for (let attMatch; (attMatch = kAttributePattern.exec(match[3]));) {
                attrs[attMatch[2].toLowerCase()] = attMatch[4] || attMatch[5] || attMatch[6];
            }
            const tagName = currentParent.rawTagName;
            if (!match[4] && kElementsClosedByOpening[tagName]) {
                if (kElementsClosedByOpening[tagName][match[2]]) {
                    stack.pop();
                    currentParent = arr_back(stack);
                }
            }
            // Prevent nested A tags by terminating the last A and starting a new one : see issue #144
            if (match[2] === 'a' || match[2] === 'A') {
                if (noNestedTagIndex !== undefined) {
                    stack.splice(noNestedTagIndex);
                    currentParent = arr_back(stack);
                }
                noNestedTagIndex = stack.length;
            }
            const tagEndPos = kMarkupPattern.lastIndex;
            const tagStartPos = tagEndPos - match[0].length;
            currentParent = currentParent.appendChild(
            // Initialize range (end position updated later for closed tags)
            new HTMLElement(match[2], attrs, match[3], null, createRange(tagStartPos, tagEndPos)));
            stack.push(currentParent);
            if (is_block_text_element(match[2])) {
                // Find closing tag
                const closeMarkup = `</${match[2]}>`;
                const closeIndex = options.lowerCaseTagName
                    ? data.toLocaleLowerCase().indexOf(closeMarkup, kMarkupPattern.lastIndex)
                    : data.indexOf(closeMarkup, kMarkupPattern.lastIndex);
                const textEndPos = closeIndex === -1 ? dataEndPos : closeIndex;
                if (element_should_be_ignore(match[2])) {
                    const text = data.substring(tagEndPos, textEndPos);
                    if (text.length > 0 && /\S/.test(text)) {
                        currentParent.appendChild(new TextNode(text, currentParent, createRange(tagEndPos, textEndPos)));
                    }
                }
                if (closeIndex === -1) {
                    lastTextPos = kMarkupPattern.lastIndex = data.length + 1;
                }
                else {
                    lastTextPos = kMarkupPattern.lastIndex = closeIndex + closeMarkup.length;
                    // Cause to be treated as self-closing, because no close found
                    match[1] = 'true';
                }
            }
        }
        // Handle closing tags or self-closed elements (ie </tag> or <br>)
        if (match[1] || match[4] || kSelfClosingElements[match[2]]) {
            while (true) {
                if (match[2] === 'a' || match[2] === 'A')
                    noNestedTagIndex = undefined;
                if (currentParent.rawTagName === match[2]) {
                    // Update range end for closed tag
                    currentParent.range[1] = createRange(-1, Math.max(lastTextPos, tagEndPos))[1];
                    stack.pop();
                    currentParent = arr_back(stack);
                    break;
                }
                else {
                    const tagName = currentParent.tagName;
                    // Trying to close current tag, and move on
                    if (kElementsClosedByClosing[tagName]) {
                        if (kElementsClosedByClosing[tagName][match[2]]) {
                            stack.pop();
                            currentParent = arr_back(stack);
                            continue;
                        }
                    }
                    // Use aggressive strategy to handle unmatching markups.
                    break;
                }
            }
        }
    }
    return stack;
}
/**
 * Parses HTML and returns a root element
 * Parse a chuck of HTML source.
 */
export function parse(data, options = { lowerCaseTagName: false, comment: false }) {
    const stack = base_parse(data, options);
    const [root] = stack;
    while (stack.length > 1) {
        // Handle each error elements.
        const last = stack.pop();
        const oneBefore = arr_back(stack);
        if (last.parentNode && last.parentNode.parentNode) {
            if (last.parentNode === oneBefore && last.tagName === oneBefore.tagName) {
                // Pair error case <h3> <h3> handle : Fixes to <h3> </h3>
                oneBefore.removeChild(last);
                last.childNodes.forEach((child) => {
                    oneBefore.parentNode.appendChild(child);
                });
                stack.pop();
            }
            else {
                // Single error  <div> <h3> </div> handle: Just removes <h3>
                oneBefore.removeChild(last);
                last.childNodes.forEach((child) => {
                    oneBefore.appendChild(child);
                });
            }
        }
        else {
            // If it's final element just skip.
        }
    }
    // response.childNodes.forEach((node) => {
    // 	if (node instanceof HTMLElement) {
    // 		node.parentNode = null;
    // 	}
    // });
    return root;
}
