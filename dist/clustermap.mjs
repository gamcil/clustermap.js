/** Cubic-in-out animation; returns a cancellation function. */
function animate(duration, update, complete) {
  const startedAt = performance.now();
  let cancelled = false;
  const tick = (now) => {
    const elapsed = duration ? Math.min(1, (now - startedAt) / duration) : 1;
    update(elapsed < 0.5 ? 4 * elapsed * elapsed * elapsed : 1 - Math.pow(-2 * elapsed + 2, 3) / 2);
    if (cancelled) return;
    if (elapsed < 1) frame = requestAnimationFrame(tick);
    else { frame = null; complete?.(); }
  };
  let frame = requestAnimationFrame(tick);
  return () => { cancelled = true; if (frame !== null) cancelAnimationFrame(frame); frame = null; };
}

/** Allow a queued preview to paint before preparing its committed scene. */
function afterPaint(action) {
  let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(action); });
  return () => cancelAnimationFrame(frame);
}

var xhtml = "http://www.w3.org/1999/xhtml";

var namespaces = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

function namespace(name) {
  var prefix = name += "", i = prefix.indexOf(":");
  if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
  return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name; // eslint-disable-line no-prototype-builtins
}

function creatorInherit(name) {
  return function() {
    var document = this.ownerDocument,
        uri = this.namespaceURI;
    return uri === xhtml && document.documentElement.namespaceURI === xhtml
        ? document.createElement(name)
        : document.createElementNS(uri, name);
  };
}

function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}

function creator(name) {
  var fullname = namespace(name);
  return (fullname.local
      ? creatorFixed
      : creatorInherit)(fullname);
}

function none() {}

function selector(selector) {
  return selector == null ? none : function() {
    return this.querySelector(selector);
  };
}

function selection_select(select) {
  if (typeof select !== "function") select = selector(select);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
      }
    }
  }

  return new Selection$1(subgroups, this._parents);
}

// Given something array like (or null), returns something that is strictly an
// array. This is used to ensure that array-like objects passed to d3.selectAll
// or selection.selectAll are converted into proper arrays when creating a
// selection; we don’t ever want to create a selection backed by a live
// HTMLCollection or NodeList. However, note that selection.selectAll will use a
// static NodeList as a group, since it safely derived from querySelectorAll.
function array(x) {
  return x == null ? [] : Array.isArray(x) ? x : Array.from(x);
}

function empty() {
  return [];
}

function selectorAll(selector) {
  return selector == null ? empty : function() {
    return this.querySelectorAll(selector);
  };
}

function arrayAll(select) {
  return function() {
    return array(select.apply(this, arguments));
  };
}

function selection_selectAll(select) {
  if (typeof select === "function") select = arrayAll(select);
  else select = selectorAll(select);

  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        subgroups.push(select.call(node, node.__data__, i, group));
        parents.push(node);
      }
    }
  }

  return new Selection$1(subgroups, parents);
}

function matcher(selector) {
  return function() {
    return this.matches(selector);
  };
}

function childMatcher(selector) {
  return function(node) {
    return node.matches(selector);
  };
}

var find = Array.prototype.find;

function childFind(match) {
  return function() {
    return find.call(this.children, match);
  };
}

function childFirst() {
  return this.firstElementChild;
}

function selection_selectChild(match) {
  return this.select(match == null ? childFirst
      : childFind(typeof match === "function" ? match : childMatcher(match)));
}

var filter = Array.prototype.filter;

function children() {
  return Array.from(this.children);
}

function childrenFilter(match) {
  return function() {
    return filter.call(this.children, match);
  };
}

function selection_selectChildren(match) {
  return this.selectAll(match == null ? children
      : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}

function selection_filter(match) {
  if (typeof match !== "function") match = matcher(match);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }

  return new Selection$1(subgroups, this._parents);
}

function sparse(update) {
  return new Array(update.length);
}

function selection_enter() {
  return new Selection$1(this._enter || this._groups.map(sparse), this._parents);
}

function EnterNode(parent, datum) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum;
}

EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
  insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
  querySelector: function(selector) { return this._parent.querySelector(selector); },
  querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
};

function constant$3(x) {
  return function() {
    return x;
  };
}

function bindIndex(parent, group, enter, update, exit, data) {
  var i = 0,
      node,
      groupLength = group.length,
      dataLength = data.length;

  // Put any non-null nodes that fit into update.
  // Put any null nodes into enter.
  // Put any remaining data into enter.
  for (; i < dataLength; ++i) {
    if (node = group[i]) {
      node.__data__ = data[i];
      update[i] = node;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }

  // Put any non-null nodes that don’t fit into exit.
  for (; i < groupLength; ++i) {
    if (node = group[i]) {
      exit[i] = node;
    }
  }
}

function bindKey(parent, group, enter, update, exit, data, key) {
  var i,
      node,
      nodeByKeyValue = new Map,
      groupLength = group.length,
      dataLength = data.length,
      keyValues = new Array(groupLength),
      keyValue;

  // Compute the key for each node.
  // If multiple nodes have the same key, the duplicates are added to exit.
  for (i = 0; i < groupLength; ++i) {
    if (node = group[i]) {
      keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
      if (nodeByKeyValue.has(keyValue)) {
        exit[i] = node;
      } else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }

  // Compute the key for each datum.
  // If there a node associated with this key, join and add it to update.
  // If there is not (or the key is a duplicate), add it to enter.
  for (i = 0; i < dataLength; ++i) {
    keyValue = key.call(parent, data[i], i, data) + "";
    if (node = nodeByKeyValue.get(keyValue)) {
      update[i] = node;
      node.__data__ = data[i];
      nodeByKeyValue.delete(keyValue);
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }

  // Add any remaining nodes that were not bound to data to exit.
  for (i = 0; i < groupLength; ++i) {
    if ((node = group[i]) && (nodeByKeyValue.get(keyValues[i]) === node)) {
      exit[i] = node;
    }
  }
}

function datum(node) {
  return node.__data__;
}

function selection_data(value, key) {
  if (!arguments.length) return Array.from(this, datum);

  var bind = key ? bindKey : bindIndex,
      parents = this._parents,
      groups = this._groups;

  if (typeof value !== "function") value = constant$3(value);

  for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
    var parent = parents[j],
        group = groups[j],
        groupLength = group.length,
        data = arraylike(value.call(parent, parent && parent.__data__, j, parents)),
        dataLength = data.length,
        enterGroup = enter[j] = new Array(dataLength),
        updateGroup = update[j] = new Array(dataLength),
        exitGroup = exit[j] = new Array(groupLength);

    bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

    // Now connect the enter nodes to their following update node, such that
    // appendChild can insert the materialized enter node before this node,
    // rather than at the end of the parent node.
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength);
        previous._next = next || null;
      }
    }
  }

  update = new Selection$1(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}

// Given some data, this returns an array-like view of it: an object that
// exposes a length property and allows numeric indexing. Note that unlike
// selectAll, this isn’t worried about “live” collections because the resulting
// array will only be used briefly while data is being bound. (It is possible to
// cause the data to change while iterating by using a key function, but please
// don’t; we’d rather avoid a gratuitous copy.)
function arraylike(data) {
  return typeof data === "object" && "length" in data
    ? data // Array, TypedArray, NodeList, array-like
    : Array.from(data); // Map, Set, iterable, string, or anything else
}

function selection_exit() {
  return new Selection$1(this._exit || this._groups.map(sparse), this._parents);
}

function selection_join(onenter, onupdate, onexit) {
  var enter = this.enter(), update = this, exit = this.exit();
  if (typeof onenter === "function") {
    enter = onenter(enter);
    if (enter) enter = enter.selection();
  } else {
    enter = enter.append(onenter + "");
  }
  if (onupdate != null) {
    update = onupdate(update);
    if (update) update = update.selection();
  }
  if (onexit == null) exit.remove(); else onexit(exit);
  return enter && update ? enter.merge(update).order() : update;
}

function selection_merge(context) {
  var selection = context.selection ? context.selection() : context;

  for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }

  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }

  return new Selection$1(merges, this._parents);
}

function selection_order() {

  for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
    for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
      if (node = group[i]) {
        if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }

  return this;
}

function selection_sort(compare) {
  if (!compare) compare = ascending$1;

  function compareNode(a, b) {
    return a && b ? compare(a.__data__, b.__data__) : !a - !b;
  }

  for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        sortgroup[i] = node;
      }
    }
    sortgroup.sort(compareNode);
  }

  return new Selection$1(sortgroups, this._parents).order();
}

function ascending$1(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function selection_call() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}

function selection_nodes() {
  return Array.from(this);
}

function selection_node() {

  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
      var node = group[i];
      if (node) return node;
    }
  }

  return null;
}

function selection_size() {
  let size = 0;
  for (const node of this) ++size; // eslint-disable-line no-unused-vars
  return size;
}

function selection_empty() {
  return !this.node();
}

function selection_each(callback) {

  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) callback.call(node, node.__data__, i, group);
    }
  }

  return this;
}

function attrRemove$1(name) {
  return function() {
    this.removeAttribute(name);
  };
}

function attrRemoveNS$1(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}

function attrConstant$1(name, value) {
  return function() {
    this.setAttribute(name, value);
  };
}

function attrConstantNS$1(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}

function attrFunction$1(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttribute(name);
    else this.setAttribute(name, v);
  };
}

function attrFunctionNS$1(fullname, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
    else this.setAttributeNS(fullname.space, fullname.local, v);
  };
}

function selection_attr(name, value) {
  var fullname = namespace(name);

  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local
        ? node.getAttributeNS(fullname.space, fullname.local)
        : node.getAttribute(fullname);
  }

  return this.each((value == null
      ? (fullname.local ? attrRemoveNS$1 : attrRemove$1) : (typeof value === "function"
      ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)
      : (fullname.local ? attrConstantNS$1 : attrConstant$1)))(fullname, value));
}

function defaultView(node) {
  return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
      || (node.document && node) // node is a Window
      || node.defaultView; // node is a Document
}

function styleRemove$1(name) {
  return function() {
    this.style.removeProperty(name);
  };
}

function styleConstant$1(name, value, priority) {
  return function() {
    this.style.setProperty(name, value, priority);
  };
}

function styleFunction$1(name, value, priority) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.style.removeProperty(name);
    else this.style.setProperty(name, v, priority);
  };
}

function selection_style(name, value, priority) {
  return arguments.length > 1
      ? this.each((value == null
            ? styleRemove$1 : typeof value === "function"
            ? styleFunction$1
            : styleConstant$1)(name, value, priority == null ? "" : priority))
      : styleValue(this.node(), name);
}

function styleValue(node, name) {
  return node.style.getPropertyValue(name)
      || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
}

function propertyRemove(name) {
  return function() {
    delete this[name];
  };
}

function propertyConstant(name, value) {
  return function() {
    this[name] = value;
  };
}

function propertyFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) delete this[name];
    else this[name] = v;
  };
}

function selection_property(name, value) {
  return arguments.length > 1
      ? this.each((value == null
          ? propertyRemove : typeof value === "function"
          ? propertyFunction
          : propertyConstant)(name, value))
      : this.node()[name];
}

function classArray(string) {
  return string.trim().split(/^|\s+/);
}

function classList(node) {
  return node.classList || new ClassList(node);
}

function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}

ClassList.prototype = {
  add: function(name) {
    var i = this._names.indexOf(name);
    if (i < 0) {
      this._names.push(name);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name) {
    var i = this._names.indexOf(name);
    if (i >= 0) {
      this._names.splice(i, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name) {
    return this._names.indexOf(name) >= 0;
  }
};

function classedAdd(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.add(names[i]);
}

function classedRemove(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.remove(names[i]);
}

function classedTrue(names) {
  return function() {
    classedAdd(this, names);
  };
}

function classedFalse(names) {
  return function() {
    classedRemove(this, names);
  };
}

function classedFunction(names, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
  };
}

function selection_classed(name, value) {
  var names = classArray(name + "");

  if (arguments.length < 2) {
    var list = classList(this.node()), i = -1, n = names.length;
    while (++i < n) if (!list.contains(names[i])) return false;
    return true;
  }

  return this.each((typeof value === "function"
      ? classedFunction : value
      ? classedTrue
      : classedFalse)(names, value));
}

function textRemove() {
  this.textContent = "";
}

function textConstant$1(value) {
  return function() {
    this.textContent = value;
  };
}

function textFunction$1(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.textContent = v == null ? "" : v;
  };
}

function selection_text(value) {
  return arguments.length
      ? this.each(value == null
          ? textRemove : (typeof value === "function"
          ? textFunction$1
          : textConstant$1)(value))
      : this.node().textContent;
}

function htmlRemove() {
  this.innerHTML = "";
}

function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}

function htmlFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.innerHTML = v == null ? "" : v;
  };
}

function selection_html(value) {
  return arguments.length
      ? this.each(value == null
          ? htmlRemove : (typeof value === "function"
          ? htmlFunction
          : htmlConstant)(value))
      : this.node().innerHTML;
}

function raise() {
  if (this.nextSibling) this.parentNode.appendChild(this);
}

function selection_raise() {
  return this.each(raise);
}

function lower() {
  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}

function selection_lower() {
  return this.each(lower);
}

function selection_append(name) {
  var create = typeof name === "function" ? name : creator(name);
  return this.select(function() {
    return this.appendChild(create.apply(this, arguments));
  });
}

function constantNull() {
  return null;
}

function selection_insert(name, before) {
  var create = typeof name === "function" ? name : creator(name),
      select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
  return this.select(function() {
    return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
  });
}

function remove() {
  var parent = this.parentNode;
  if (parent) parent.removeChild(this);
}

function selection_remove() {
  return this.each(remove);
}

function selection_cloneShallow() {
  var clone = this.cloneNode(false), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}

function selection_cloneDeep() {
  var clone = this.cloneNode(true), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}

function selection_clone(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

function selection_datum(value) {
  return arguments.length
      ? this.property("__data__", value)
      : this.node().__data__;
}

function contextListener(listener) {
  return function(event) {
    listener.call(this, event, this.__data__);
  };
}

function parseTypenames$1(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    return {type: t, name: name};
  });
}

function onRemove(typename) {
  return function() {
    var on = this.__on;
    if (!on) return;
    for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
      if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
      } else {
        on[++i] = o;
      }
    }
    if (++i) on.length = i;
    else delete this.__on;
  };
}

function onAdd(typename, value, options) {
  return function() {
    var on = this.__on, o, listener = contextListener(value);
    if (on) for (var j = 0, m = on.length; j < m; ++j) {
      if ((o = on[j]).type === typename.type && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
        this.addEventListener(o.type, o.listener = listener, o.options = options);
        o.value = value;
        return;
      }
    }
    this.addEventListener(typename.type, listener, options);
    o = {type: typename.type, name: typename.name, value: value, listener: listener, options: options};
    if (!on) this.__on = [o];
    else on.push(o);
  };
}

function selection_on(typename, value, options) {
  var typenames = parseTypenames$1(typename + ""), i, n = typenames.length, t;

  if (arguments.length < 2) {
    var on = this.node().__on;
    if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
      for (i = 0, o = on[j]; i < n; ++i) {
        if ((t = typenames[i]).type === o.type && t.name === o.name) {
          return o.value;
        }
      }
    }
    return;
  }

  on = value ? onAdd : onRemove;
  for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
  return this;
}

function dispatchEvent(node, type, params) {
  var window = defaultView(node),
      event = window.CustomEvent;

  if (typeof event === "function") {
    event = new event(type, params);
  } else {
    event = window.document.createEvent("Event");
    if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
    else event.initEvent(type, false, false);
  }

  node.dispatchEvent(event);
}

function dispatchConstant(type, params) {
  return function() {
    return dispatchEvent(this, type, params);
  };
}

function dispatchFunction(type, params) {
  return function() {
    return dispatchEvent(this, type, params.apply(this, arguments));
  };
}

function selection_dispatch(type, params) {
  return this.each((typeof params === "function"
      ? dispatchFunction
      : dispatchConstant)(type, params));
}

function* selection_iterator() {
  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) yield node;
    }
  }
}

var root = [null];

function Selection$1(groups, parents) {
  this._groups = groups;
  this._parents = parents;
}

function selection() {
  return new Selection$1([[document.documentElement]], root);
}

function selection_selection() {
  return this;
}

Selection$1.prototype = selection.prototype = {
  constructor: Selection$1,
  select: selection_select,
  selectAll: selection_selectAll,
  selectChild: selection_selectChild,
  selectChildren: selection_selectChildren,
  filter: selection_filter,
  data: selection_data,
  enter: selection_enter,
  exit: selection_exit,
  join: selection_join,
  merge: selection_merge,
  selection: selection_selection,
  order: selection_order,
  sort: selection_sort,
  call: selection_call,
  nodes: selection_nodes,
  node: selection_node,
  size: selection_size,
  empty: selection_empty,
  each: selection_each,
  attr: selection_attr,
  style: selection_style,
  property: selection_property,
  classed: selection_classed,
  text: selection_text,
  html: selection_html,
  raise: selection_raise,
  lower: selection_lower,
  append: selection_append,
  insert: selection_insert,
  remove: selection_remove,
  clone: selection_clone,
  datum: selection_datum,
  on: selection_on,
  dispatch: selection_dispatch,
  [Symbol.iterator]: selection_iterator
};

function select(selector) {
  return typeof selector === "string"
      ? new Selection$1([[document.querySelector(selector)]], [document.documentElement])
      : new Selection$1([[selector]], root);
}

function create$1(name) {
  return select(creator(name).call(document.documentElement));
}

function sourceEvent(event) {
  let sourceEvent;
  while (sourceEvent = event.sourceEvent) event = sourceEvent;
  return event;
}

function pointer(event, node) {
  event = sourceEvent(event);
  if (node === undefined) node = event.currentTarget;
  if (node) {
    var svg = node.ownerSVGElement || node;
    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      point.x = event.clientX, point.y = event.clientY;
      point = point.matrixTransform(node.getScreenCTM().inverse());
      return [point.x, point.y];
    }
    if (node.getBoundingClientRect) {
      var rect = node.getBoundingClientRect();
      return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
    }
  }
  return [event.pageX, event.pageY];
}

var noop = {value: () => {}};

function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || (t in _) || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}

function Dispatch(_) {
  this._ = _;
}

function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return {type: t, name: name};
  });
}

Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._,
        T = parseTypenames(typename + "", _),
        t,
        i = -1,
        n = T.length;

    // If no callback was specified, return the callback of the given type and name.
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get$1(_[t], typename.name))) return t;
      return;
    }

    // If a type was specified, set the callback for the given type and name.
    // Otherwise, if a null callback was specified, remove callbacks of the given name.
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set$1(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set$1(_[t], typename.name, null);
    }

    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type, that, args) {
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};

function get$1(type, name) {
  for (var i = 0, n = type.length, c; i < n; ++i) {
    if ((c = type[i]).name === name) {
      return c.value;
    }
  }
}

function set$1(type, name, callback) {
  for (var i = 0, n = type.length; i < n; ++i) {
    if (type[i].name === name) {
      type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
      break;
    }
  }
  if (callback != null) type.push({name: name, value: callback});
  return type;
}

var frame = 0, // is an animation frame pending?
    timeout$1 = 0, // is a timeout pending?
    interval = 0, // are any timers active?
    pokeDelay = 1000, // how frequently we check for clock skew
    taskHead,
    taskTail,
    clockLast = 0,
    clockNow = 0,
    clockSkew = 0,
    clock = typeof performance === "object" && performance.now ? performance : Date,
    setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}

function clearNow() {
  clockNow = 0;
}

function Timer() {
  this._call =
  this._time =
  this._next = null;
}

Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};

function timer(callback, delay, time) {
  var t = new Timer;
  t.restart(callback, delay, time);
  return t;
}

function timerFlush() {
  now(); // Get the current time, if not already set.
  ++frame; // Pretend we’ve set an alarm, if we haven’t already.
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(undefined, e);
    t = t._next;
  }
  --frame;
}

function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout$1 = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}

function poke() {
  var now = clock.now(), delay = now - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
}

function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}

function sleep(time) {
  if (frame) return; // Soonest alarm already set, or will be.
  if (timeout$1) timeout$1 = clearTimeout(timeout$1);
  var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
  if (delay > 24) {
    if (time < Infinity) timeout$1 = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

function timeout(callback, delay, time) {
  var t = new Timer;
  delay = delay == null ? 0 : +delay;
  t.restart(elapsed => {
    t.stop();
    callback(elapsed + delay);
  }, delay, time);
  return t;
}

var emptyOn = dispatch("start", "end", "cancel", "interrupt");
var emptyTween = [];

var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;

function schedule(node, name, id, index, group, timing) {
  var schedules = node.__transition;
  if (!schedules) node.__transition = {};
  else if (id in schedules) return;
  create(node, id, {
    name: name,
    index: index, // For context during callback.
    group: group, // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}

function init(node, id) {
  var schedule = get(node, id);
  if (schedule.state > CREATED) throw new Error("too late; already scheduled");
  return schedule;
}

function set(node, id) {
  var schedule = get(node, id);
  if (schedule.state > STARTED) throw new Error("too late; already running");
  return schedule;
}

function get(node, id) {
  var schedule = node.__transition;
  if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
  return schedule;
}

function create(node, id, self) {
  var schedules = node.__transition,
      tween;

  // Initialize the self timer when the transition is created.
  // Note the actual delay is not known until the first callback!
  schedules[id] = self;
  self.timer = timer(schedule, 0, self.time);

  function schedule(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start, self.delay, self.time);

    // If the elapsed delay is less than our first sleep, start immediately.
    if (self.delay <= elapsed) start(elapsed - self.delay);
  }

  function start(elapsed) {
    var i, j, n, o;

    // If the state is not SCHEDULED, then we previously errored on start.
    if (self.state !== SCHEDULED) return stop();

    for (i in schedules) {
      o = schedules[i];
      if (o.name !== self.name) continue;

      // While this element already has a starting transition during this frame,
      // defer starting an interrupting transition until that transition has a
      // chance to tick (and possibly end); see d3/d3-transition#54!
      if (o.state === STARTED) return timeout(start);

      // Interrupt the active transition, if any.
      if (o.state === RUNNING) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("interrupt", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }

      // Cancel any pre-empted transitions.
      else if (+i < id) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("cancel", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }
    }

    // Defer the first tick to end of the current frame; see d3/d3#1576.
    // Note the transition may be canceled after start and before the first tick!
    // Note this must be scheduled before the start event; see d3/d3-transition#16!
    // Assuming this is successful, subsequent callbacks go straight to tick.
    timeout(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });

    // Dispatch the start event.
    // Note this must be done before the tween are initialized.
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING) return; // interrupted
    self.state = STARTED;

    // Initialize the tween, deleting null tween.
    tween = new Array(n = self.tween.length);
    for (i = 0, j = -1; i < n; ++i) {
      if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j] = o;
      }
    }
    tween.length = j + 1;
  }

  function tick(elapsed) {
    var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1),
        i = -1,
        n = tween.length;

    while (++i < n) {
      tween[i].call(node, t);
    }

    // Dispatch the end event.
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }

  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id];
    for (var i in schedules) return; // eslint-disable-line no-unused-vars
    delete node.__transition;
  }
}

function interrupt(node, name) {
  var schedules = node.__transition,
      schedule,
      active,
      empty = true,
      i;

  if (!schedules) return;

  name = name == null ? null : name + "";

  for (i in schedules) {
    if ((schedule = schedules[i]).name !== name) { empty = false; continue; }
    active = schedule.state > STARTING && schedule.state < ENDING;
    schedule.state = ENDED;
    schedule.timer.stop();
    schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
    delete schedules[i];
  }

  if (empty) delete node.__transition;
}

function selection_interrupt(name) {
  return this.each(function() {
    interrupt(this, name);
  });
}

function define(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}

function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

function Color() {}

var darker = 0.7;
var brighter = 1 / darker;

var reI = "\\s*([+-]?\\d+)\\s*",
    reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*",
    reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
    reHex = /^#([0-9a-f]{3,8})$/,
    reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`),
    reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`),
    reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`),
    reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`),
    reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`),
    reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);

var named = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkgrey: 0xa9a9a9,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkslategrey: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgray: 0x696969,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategray: 0x708090,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32
};

define(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor, this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex, // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});

function color_formatHex() {
  return this.rgb().formatHex();
}

function color_formatHex8() {
  return this.rgb().formatHex8();
}

function color_formatHsl() {
  return hslConvert(this).formatHsl();
}

function color_formatRgb() {
  return this.rgb().formatRgb();
}

function color(format) {
  var m, l;
  format = (format + "").trim().toLowerCase();
  return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) // #ff0000
      : l === 3 ? new Rgb((m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1) // #f00
      : l === 8 ? rgba$1(m >> 24 & 0xff, m >> 16 & 0xff, m >> 8 & 0xff, (m & 0xff) / 0xff) // #ff000000
      : l === 4 ? rgba$1((m >> 12 & 0xf) | (m >> 8 & 0xf0), (m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), (((m & 0xf) << 4) | (m & 0xf)) / 0xff) // #f000
      : null) // invalid hex
      : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
      : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
      : (m = reRgbaInteger.exec(format)) ? rgba$1(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
      : (m = reRgbaPercent.exec(format)) ? rgba$1(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
      : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
      : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
      : named.hasOwnProperty(format) ? rgbn(named[format]) // eslint-disable-line no-prototype-builtins
      : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
      : null;
}

function rgbn(n) {
  return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
}

function rgba$1(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}

function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb;
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}

function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}

function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}

define(Rgb, rgb, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return (-0.5 <= this.r && this.r < 255.5)
        && (-0.5 <= this.g && this.g < 255.5)
        && (-0.5 <= this.b && this.b < 255.5)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex, // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));

function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}

function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}

function rgb_formatRgb() {
  const a = clampa(this.opacity);
  return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
}

function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}

function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}

function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}

function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}

function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl;
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      h = NaN,
      s = max - min,
      l = (max + min) / 2;
  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;
    else if (g === max) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}

function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}

function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hsl, hsl, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360,
        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
        l = this.l,
        m2 = l + (l < 0.5 ? l : 1 - l) * s,
        m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s))
        && (0 <= this.l && this.l <= 1)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
  }
}));

function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}

function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}

/* From FvD 13.37, CSS Color Module Level 3 */
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60
      : h < 180 ? m2
      : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
      : m1) * 255;
}

const radians = Math.PI / 180;
const degrees$1 = 180 / Math.PI;

var A = -0.14861,
    B = +1.78277,
    C = -0.29227,
    D = -0.90649,
    E = +1.97294,
    ED = E * D,
    EB = E * B,
    BC_DA = B * C - D * A;

function cubehelixConvert(o) {
  if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
      bl = b - l,
      k = (E * (g - l) - C * bl) / D,
      s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
      h = s ? Math.atan2(k, bl) * degrees$1 - 120 : NaN;
  return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
}

function cubehelix$1(h, s, l, opacity) {
  return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
}

function Cubehelix(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Cubehelix, cubehelix$1, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = isNaN(this.h) ? 0 : (this.h + 120) * radians,
        l = +this.l,
        a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
        cosh = Math.cos(h),
        sinh = Math.sin(h);
    return new Rgb(
      255 * (l + a * (A * cosh + B * sinh)),
      255 * (l + a * (C * cosh + D * sinh)),
      255 * (l + a * (E * cosh)),
      this.opacity
    );
  }
}));

function basis(t1, v0, v1, v2, v3) {
  var t2 = t1 * t1, t3 = t2 * t1;
  return ((1 - 3 * t1 + 3 * t2 - t3) * v0
      + (4 - 6 * t2 + 3 * t3) * v1
      + (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2
      + t3 * v3) / 6;
}

function basis$1(values) {
  var n = values.length - 1;
  return function(t) {
    var i = t <= 0 ? (t = 0) : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n),
        v1 = values[i],
        v2 = values[i + 1],
        v0 = i > 0 ? values[i - 1] : 2 * v1 - v2,
        v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

var constant$2 = x => () => x;

function linear$1(a, d) {
  return function(t) {
    return a + t * d;
  };
}

function exponential(a, b, y) {
  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
    return Math.pow(a + t * b, y);
  };
}

function hue(a, b) {
  var d = b - a;
  return d ? linear$1(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant$2(isNaN(a) ? b : a);
}

function gamma(y) {
  return (y = +y) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y) : constant$2(isNaN(a) ? b : a);
  };
}

function nogamma(a, b) {
  var d = b - a;
  return d ? linear$1(a, d) : constant$2(isNaN(a) ? b : a);
}

var interpolateRgb = (function rgbGamma(y) {
  var color = gamma(y);

  function rgb$1(start, end) {
    var r = color((start = rgb(start)).r, (end = rgb(end)).r),
        g = color(start.g, end.g),
        b = color(start.b, end.b),
        opacity = nogamma(start.opacity, end.opacity);
    return function(t) {
      start.r = r(t);
      start.g = g(t);
      start.b = b(t);
      start.opacity = opacity(t);
      return start + "";
    };
  }

  rgb$1.gamma = rgbGamma;

  return rgb$1;
})(1);

function rgbSpline(spline) {
  return function(colors) {
    var n = colors.length,
        r = new Array(n),
        g = new Array(n),
        b = new Array(n),
        i, color;
    for (i = 0; i < n; ++i) {
      color = rgb(colors[i]);
      r[i] = color.r || 0;
      g[i] = color.g || 0;
      b[i] = color.b || 0;
    }
    r = spline(r);
    g = spline(g);
    b = spline(b);
    color.opacity = 1;
    return function(t) {
      color.r = r(t);
      color.g = g(t);
      color.b = b(t);
      return color + "";
    };
  };
}

var rgbBasis = rgbSpline(basis$1);

function numberArray(a, b) {
  if (!b) b = [];
  var n = a ? Math.min(b.length, a.length) : 0,
      c = b.slice(),
      i;
  return function(t) {
    for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
    return c;
  };
}

function isNumberArray(x) {
  return ArrayBuffer.isView(x) && !(x instanceof DataView);
}

function genericArray(a, b) {
  var nb = b ? b.length : 0,
      na = a ? Math.min(nb, a.length) : 0,
      x = new Array(na),
      c = new Array(nb),
      i;

  for (i = 0; i < na; ++i) x[i] = interpolate$1(a[i], b[i]);
  for (; i < nb; ++i) c[i] = b[i];

  return function(t) {
    for (i = 0; i < na; ++i) c[i] = x[i](t);
    return c;
  };
}

function date(a, b) {
  var d = new Date;
  return a = +a, b = +b, function(t) {
    return d.setTime(a * (1 - t) + b * t), d;
  };
}

function interpolateNumber$1(a, b) {
  return a = +a, b = +b, function(t) {
    return a * (1 - t) + b * t;
  };
}

function object$2(a, b) {
  var i = {},
      c = {},
      k;

  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};

  for (k in b) {
    if (k in a) {
      i[k] = interpolate$1(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }

  return function(t) {
    for (k in i) c[k] = i[k](t);
    return c;
  };
}

var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
    reB = new RegExp(reA.source, "g");

function zero$1(b) {
  return function() {
    return b;
  };
}

function one(b) {
  return function(t) {
    return b(t) + "";
  };
}

function interpolateString(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
      am, // current match in a
      bm, // current match in b
      bs, // string preceding current number in b, if any
      i = -1, // index in s
      s = [], // string constants and placeholders
      q = []; // number interpolators

  // Coerce inputs to strings.
  a = a + "", b = b + "";

  // Interpolate pairs of numbers in a & b.
  while ((am = reA.exec(a))
      && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) { // a string precedes the next number in b
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
      if (s[i]) s[i] += bm; // coalesce with previous string
      else s[++i] = bm;
    } else { // interpolate non-matching numbers
      s[++i] = null;
      q.push({i: i, x: interpolateNumber$1(am, bm)});
    }
    bi = reB.lastIndex;
  }

  // Add remains of b.
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs; // coalesce with previous string
    else s[++i] = bs;
  }

  // Special optimization for only a single match.
  // Otherwise, interpolate each of the numbers and rejoin the string.
  return s.length < 2 ? (q[0]
      ? one(q[0].x)
      : zero$1(b))
      : (b = q.length, function(t) {
          for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
          return s.join("");
        });
}

function interpolate$1(a, b) {
  var t = typeof b, c;
  return b == null || t === "boolean" ? constant$2(b)
      : (t === "number" ? interpolateNumber$1
      : t === "string" ? ((c = color(b)) ? (b = c, interpolateRgb) : interpolateString)
      : b instanceof color ? interpolateRgb
      : b instanceof Date ? date
      : isNumberArray(b) ? numberArray
      : Array.isArray(b) ? genericArray
      : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object$2
      : interpolateNumber$1)(a, b);
}

function interpolateRound(a, b) {
  return a = +a, b = +b, function(t) {
    return Math.round(a * (1 - t) + b * t);
  };
}

var degrees = 180 / Math.PI;

var identity$3 = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};

function decompose(a, b, c, d, e, f) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * degrees,
    skewX: Math.atan(skewX) * degrees,
    scaleX: scaleX,
    scaleY: scaleY
  };
}

var svgNode;

/* eslint-disable no-undef */
function parseCss(value) {
  const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
  return m.isIdentity ? identity$3 : decompose(m.a, m.b, m.c, m.d, m.e, m.f);
}

function parseSvg(value) {
  if (value == null) return identity$3;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return identity$3;
  value = value.matrix;
  return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
}

function interpolateTransform(parse, pxComma, pxParen, degParen) {

  function pop(s) {
    return s.length ? s.pop() + " " : "";
  }

  function translate(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push("translate(", null, pxComma, null, pxParen);
      q.push({i: i - 4, x: interpolateNumber$1(xa, xb)}, {i: i - 2, x: interpolateNumber$1(ya, yb)});
    } else if (xb || yb) {
      s.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }

  function rotate(a, b, s, q) {
    if (a !== b) {
      if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
      q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: interpolateNumber$1(a, b)});
    } else if (b) {
      s.push(pop(s) + "rotate(" + b + degParen);
    }
  }

  function skewX(a, b, s, q) {
    if (a !== b) {
      q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: interpolateNumber$1(a, b)});
    } else if (b) {
      s.push(pop(s) + "skewX(" + b + degParen);
    }
  }

  function scale(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q.push({i: i - 4, x: interpolateNumber$1(xa, xb)}, {i: i - 2, x: interpolateNumber$1(ya, yb)});
    } else if (xb !== 1 || yb !== 1) {
      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
    }
  }

  return function(a, b) {
    var s = [], // string constants and placeholders
        q = []; // number interpolators
    a = parse(a), b = parse(b);
    translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
    rotate(a.rotate, b.rotate, s, q);
    skewX(a.skewX, b.skewX, s, q);
    scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
    a = b = null; // gc
    return function(t) {
      var i = -1, n = q.length, o;
      while (++i < n) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };
}

var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

var epsilon2 = 1e-12;

function cosh(x) {
  return ((x = Math.exp(x)) + 1 / x) / 2;
}

function sinh(x) {
  return ((x = Math.exp(x)) - 1 / x) / 2;
}

function tanh(x) {
  return ((x = Math.exp(2 * x)) - 1) / (x + 1);
}

var interpolateZoom = (function zoomRho(rho, rho2, rho4) {

  // p0 = [ux0, uy0, w0]
  // p1 = [ux1, uy1, w1]
  function zoom(p0, p1) {
    var ux0 = p0[0], uy0 = p0[1], w0 = p0[2],
        ux1 = p1[0], uy1 = p1[1], w1 = p1[2],
        dx = ux1 - ux0,
        dy = uy1 - uy0,
        d2 = dx * dx + dy * dy,
        i,
        S;

    // Special case for u0 ≅ u1.
    if (d2 < epsilon2) {
      S = Math.log(w1 / w0) / rho;
      i = function(t) {
        return [
          ux0 + t * dx,
          uy0 + t * dy,
          w0 * Math.exp(rho * t * S)
        ];
      };
    }

    // General case.
    else {
      var d1 = Math.sqrt(d2),
          b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1),
          b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1),
          r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0),
          r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (r1 - r0) / rho;
      i = function(t) {
        var s = t * S,
            coshr0 = cosh(r0),
            u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
        return [
          ux0 + u * dx,
          uy0 + u * dy,
          w0 * coshr0 / cosh(rho * s + r0)
        ];
      };
    }

    i.duration = S * 1000 * rho / Math.SQRT2;

    return i;
  }

  zoom.rho = function(_) {
    var _1 = Math.max(1e-3, +_), _2 = _1 * _1, _4 = _2 * _2;
    return zoomRho(_1, _2, _4);
  };

  return zoom;
})(Math.SQRT2, 2, 4);

function cubehelix(hue) {
  return (function cubehelixGamma(y) {
    y = +y;

    function cubehelix(start, end) {
      var h = hue((start = cubehelix$1(start)).h, (end = cubehelix$1(end)).h),
          s = nogamma(start.s, end.s),
          l = nogamma(start.l, end.l),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.h = h(t);
        start.s = s(t);
        start.l = l(Math.pow(t, y));
        start.opacity = opacity(t);
        return start + "";
      };
    }

    cubehelix.gamma = cubehelixGamma;

    return cubehelix;
  })(1);
}

cubehelix(hue);
var cubehelixLong = cubehelix(nogamma);

function quantize(interpolator, n) {
  var samples = new Array(n);
  for (var i = 0; i < n; ++i) samples[i] = interpolator(i / (n - 1));
  return samples;
}

function tweenRemove(id, name) {
  var tween0, tween1;
  return function() {
    var schedule = set(this, id),
        tween = schedule.tween;

    // If this node shared tween with the previous node,
    // just assign the updated shared tween and we’re done!
    // Otherwise, copy-on-write.
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1 = tween1.slice();
          tween1.splice(i, 1);
          break;
        }
      }
    }

    schedule.tween = tween1;
  };
}

function tweenFunction(id, name, value) {
  var tween0, tween1;
  if (typeof value !== "function") throw new Error;
  return function() {
    var schedule = set(this, id),
        tween = schedule.tween;

    // If this node shared tween with the previous node,
    // just assign the updated shared tween and we’re done!
    // Otherwise, copy-on-write.
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t = {name: name, value: value}, i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1[i] = t;
          break;
        }
      }
      if (i === n) tween1.push(t);
    }

    schedule.tween = tween1;
  };
}

function transition_tween(name, value) {
  var id = this._id;

  name += "";

  if (arguments.length < 2) {
    var tween = get(this.node(), id).tween;
    for (var i = 0, n = tween.length, t; i < n; ++i) {
      if ((t = tween[i]).name === name) {
        return t.value;
      }
    }
    return null;
  }

  return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
}

function tweenValue(transition, name, value) {
  var id = transition._id;

  transition.each(function() {
    var schedule = set(this, id);
    (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
  });

  return function(node) {
    return get(node, id).value[name];
  };
}

function interpolate(a, b) {
  var c;
  return (typeof b === "number" ? interpolateNumber$1
      : b instanceof color ? interpolateRgb
      : (c = color(b)) ? (b = c, interpolateRgb)
      : interpolateString)(a, b);
}

function attrRemove(name) {
  return function() {
    this.removeAttribute(name);
  };
}

function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}

function attrConstant(name, interpolate, value1) {
  var string00,
      string1 = value1 + "",
      interpolate0;
  return function() {
    var string0 = this.getAttribute(name);
    return string0 === string1 ? null
        : string0 === string00 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, value1);
  };
}

function attrConstantNS(fullname, interpolate, value1) {
  var string00,
      string1 = value1 + "",
      interpolate0;
  return function() {
    var string0 = this.getAttributeNS(fullname.space, fullname.local);
    return string0 === string1 ? null
        : string0 === string00 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, value1);
  };
}

function attrFunction(name, interpolate, value) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttribute(name);
    string0 = this.getAttribute(name);
    string1 = value1 + "";
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}

function attrFunctionNS(fullname, interpolate, value) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
    string0 = this.getAttributeNS(fullname.space, fullname.local);
    string1 = value1 + "";
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}

function transition_attr(name, value) {
  var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
  return this.attrTween(name, typeof value === "function"
      ? (fullname.local ? attrFunctionNS : attrFunction)(fullname, i, tweenValue(this, "attr." + name, value))
      : value == null ? (fullname.local ? attrRemoveNS : attrRemove)(fullname)
      : (fullname.local ? attrConstantNS : attrConstant)(fullname, i, value));
}

function attrInterpolate(name, i) {
  return function(t) {
    this.setAttribute(name, i.call(this, t));
  };
}

function attrInterpolateNS(fullname, i) {
  return function(t) {
    this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
  };
}

function attrTweenNS(fullname, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
    return t0;
  }
  tween._value = value;
  return tween;
}

function attrTween(name, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolate(name, i);
    return t0;
  }
  tween._value = value;
  return tween;
}

function transition_attrTween(name, value) {
  var key = "attr." + name;
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  var fullname = namespace(name);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

function delayFunction(id, value) {
  return function() {
    init(this, id).delay = +value.apply(this, arguments);
  };
}

function delayConstant(id, value) {
  return value = +value, function() {
    init(this, id).delay = value;
  };
}

function transition_delay(value) {
  var id = this._id;

  return arguments.length
      ? this.each((typeof value === "function"
          ? delayFunction
          : delayConstant)(id, value))
      : get(this.node(), id).delay;
}

function durationFunction(id, value) {
  return function() {
    set(this, id).duration = +value.apply(this, arguments);
  };
}

function durationConstant(id, value) {
  return value = +value, function() {
    set(this, id).duration = value;
  };
}

function transition_duration(value) {
  var id = this._id;

  return arguments.length
      ? this.each((typeof value === "function"
          ? durationFunction
          : durationConstant)(id, value))
      : get(this.node(), id).duration;
}

function easeConstant(id, value) {
  if (typeof value !== "function") throw new Error;
  return function() {
    set(this, id).ease = value;
  };
}

function transition_ease(value) {
  var id = this._id;

  return arguments.length
      ? this.each(easeConstant(id, value))
      : get(this.node(), id).ease;
}

function easeVarying(id, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (typeof v !== "function") throw new Error;
    set(this, id).ease = v;
  };
}

function transition_easeVarying(value) {
  if (typeof value !== "function") throw new Error;
  return this.each(easeVarying(this._id, value));
}

function transition_filter(match) {
  if (typeof match !== "function") match = matcher(match);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }

  return new Transition(subgroups, this._parents, this._name, this._id);
}

function transition_merge(transition) {
  if (transition._id !== this._id) throw new Error;

  for (var groups0 = this._groups, groups1 = transition._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }

  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }

  return new Transition(merges, this._parents, this._name, this._id);
}

function start(name) {
  return (name + "").trim().split(/^|\s+/).every(function(t) {
    var i = t.indexOf(".");
    if (i >= 0) t = t.slice(0, i);
    return !t || t === "start";
  });
}

function onFunction(id, name, listener) {
  var on0, on1, sit = start(name) ? init : set;
  return function() {
    var schedule = sit(this, id),
        on = schedule.on;

    // If this node shared a dispatch with the previous node,
    // just assign the updated shared dispatch and we’re done!
    // Otherwise, copy-on-write.
    if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

    schedule.on = on1;
  };
}

function transition_on(name, listener) {
  var id = this._id;

  return arguments.length < 2
      ? get(this.node(), id).on.on(name)
      : this.each(onFunction(id, name, listener));
}

function removeFunction(id) {
  return function() {
    var parent = this.parentNode;
    for (var i in this.__transition) if (+i !== id) return;
    if (parent) parent.removeChild(this);
  };
}

function transition_remove() {
  return this.on("end.remove", removeFunction(this._id));
}

function transition_select(select) {
  var name = this._name,
      id = this._id;

  if (typeof select !== "function") select = selector(select);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
        schedule(subgroup[i], name, id, i, subgroup, get(node, id));
      }
    }
  }

  return new Transition(subgroups, this._parents, name, id);
}

function transition_selectAll(select) {
  var name = this._name,
      id = this._id;

  if (typeof select !== "function") select = selectorAll(select);

  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        for (var children = select.call(node, node.__data__, i, group), child, inherit = get(node, id), k = 0, l = children.length; k < l; ++k) {
          if (child = children[k]) {
            schedule(child, name, id, k, children, inherit);
          }
        }
        subgroups.push(children);
        parents.push(node);
      }
    }
  }

  return new Transition(subgroups, parents, name, id);
}

var Selection = selection.prototype.constructor;

function transition_selection() {
  return new Selection(this._groups, this._parents);
}

function styleNull(name, interpolate) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0 = styleValue(this, name),
        string1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, string10 = string1);
  };
}

function styleRemove(name) {
  return function() {
    this.style.removeProperty(name);
  };
}

function styleConstant(name, interpolate, value1) {
  var string00,
      string1 = value1 + "",
      interpolate0;
  return function() {
    var string0 = styleValue(this, name);
    return string0 === string1 ? null
        : string0 === string00 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, value1);
  };
}

function styleFunction(name, interpolate, value) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0 = styleValue(this, name),
        value1 = value(this),
        string1 = value1 + "";
    if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}

function styleMaybeRemove(id, name) {
  var on0, on1, listener0, key = "style." + name, event = "end." + key, remove;
  return function() {
    var schedule = set(this, id),
        on = schedule.on,
        listener = schedule.value[key] == null ? remove || (remove = styleRemove(name)) : undefined;

    // If this node shared a dispatch with the previous node,
    // just assign the updated shared dispatch and we’re done!
    // Otherwise, copy-on-write.
    if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);

    schedule.on = on1;
  };
}

function transition_style(name, value, priority) {
  var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
  return value == null ? this
      .styleTween(name, styleNull(name, i))
      .on("end.style." + name, styleRemove(name))
    : typeof value === "function" ? this
      .styleTween(name, styleFunction(name, i, tweenValue(this, "style." + name, value)))
      .each(styleMaybeRemove(this._id, name))
    : this
      .styleTween(name, styleConstant(name, i, value), priority)
      .on("end.style." + name, null);
}

function styleInterpolate(name, i, priority) {
  return function(t) {
    this.style.setProperty(name, i.call(this, t), priority);
  };
}

function styleTween(name, value, priority) {
  var t, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
    return t;
  }
  tween._value = value;
  return tween;
}

function transition_styleTween(name, value, priority) {
  var key = "style." + (name += "");
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}

function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}

function textFunction(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}

function transition_text(value) {
  return this.tween("text", typeof value === "function"
      ? textFunction(tweenValue(this, "text", value))
      : textConstant(value == null ? "" : value + ""));
}

function textInterpolate(i) {
  return function(t) {
    this.textContent = i.call(this, t);
  };
}

function textTween(value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && textInterpolate(i);
    return t0;
  }
  tween._value = value;
  return tween;
}

function transition_textTween(value) {
  var key = "text";
  if (arguments.length < 1) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  return this.tween(key, textTween(value));
}

function transition_transition() {
  var name = this._name,
      id0 = this._id,
      id1 = newId();

  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        var inherit = get(node, id0);
        schedule(node, name, id1, i, group, {
          time: inherit.time + inherit.delay + inherit.duration,
          delay: 0,
          duration: inherit.duration,
          ease: inherit.ease
        });
      }
    }
  }

  return new Transition(groups, this._parents, name, id1);
}

function transition_end() {
  var on0, on1, that = this, id = that._id, size = that.size();
  return new Promise(function(resolve, reject) {
    var cancel = {value: reject},
        end = {value: function() { if (--size === 0) resolve(); }};

    that.each(function() {
      var schedule = set(this, id),
          on = schedule.on;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0) {
        on1 = (on0 = on).copy();
        on1._.cancel.push(cancel);
        on1._.interrupt.push(cancel);
        on1._.end.push(end);
      }

      schedule.on = on1;
    });

    // The selection was empty, resolve end immediately
    if (size === 0) resolve();
  });
}

var id = 0;

function Transition(groups, parents, name, id) {
  this._groups = groups;
  this._parents = parents;
  this._name = name;
  this._id = id;
}

function transition(name) {
  return selection().transition(name);
}

function newId() {
  return ++id;
}

var selection_prototype = selection.prototype;

Transition.prototype = transition.prototype = {
  constructor: Transition,
  select: transition_select,
  selectAll: transition_selectAll,
  selectChild: selection_prototype.selectChild,
  selectChildren: selection_prototype.selectChildren,
  filter: transition_filter,
  merge: transition_merge,
  selection: transition_selection,
  transition: transition_transition,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: transition_on,
  attr: transition_attr,
  attrTween: transition_attrTween,
  style: transition_style,
  styleTween: transition_styleTween,
  text: transition_text,
  textTween: transition_textTween,
  remove: transition_remove,
  tween: transition_tween,
  delay: transition_delay,
  duration: transition_duration,
  ease: transition_ease,
  easeVarying: transition_easeVarying,
  end: transition_end,
  [Symbol.iterator]: selection_prototype[Symbol.iterator]
};

function cubicInOut(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}

var defaultTiming = {
  time: null, // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};

function inherit(node, id) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id])) {
    if (!(node = node.parentNode)) {
      throw new Error(`transition ${id} not found`);
    }
  }
  return timing;
}

function selection_transition(name) {
  var id,
      timing;

  if (name instanceof Transition) {
    id = name._id, name = name._name;
  } else {
    id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
  }

  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        schedule(node, name, id, i, group, timing || inherit(node, id));
      }
    }
  }

  return new Transition(groups, this._parents, name, id);
}

selection.prototype.interrupt = selection_interrupt;
selection.prototype.transition = selection_transition;

// These are typically used in conjunction with noevent to ensure that we can
// preventDefault on the event.
const nonpassive = {passive: false};
const nonpassivecapture = {capture: true, passive: false};

function nopropagation$1(event) {
  event.stopImmediatePropagation();
}

function noevent$1(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function dragDisable(view) {
  var root = view.document.documentElement,
      selection = select(view).on("dragstart.drag", noevent$1, nonpassivecapture);
  if ("onselectstart" in root) {
    selection.on("selectstart.drag", noevent$1, nonpassivecapture);
  } else {
    root.__noselect = root.style.MozUserSelect;
    root.style.MozUserSelect = "none";
  }
}

function yesdrag(view, noclick) {
  var root = view.document.documentElement,
      selection = select(view).on("dragstart.drag", null);
  if (noclick) {
    selection.on("click.drag", noevent$1, nonpassivecapture);
    setTimeout(function() { selection.on("click.drag", null); }, 0);
  }
  if ("onselectstart" in root) {
    selection.on("selectstart.drag", null);
  } else {
    root.style.MozUserSelect = root.__noselect;
    delete root.__noselect;
  }
}

var constant$1 = x => () => x;

function DragEvent(type, {
  sourceEvent,
  subject,
  target,
  identifier,
  active,
  x, y, dx, dy,
  dispatch
}) {
  Object.defineProperties(this, {
    type: {value: type, enumerable: true, configurable: true},
    sourceEvent: {value: sourceEvent, enumerable: true, configurable: true},
    subject: {value: subject, enumerable: true, configurable: true},
    target: {value: target, enumerable: true, configurable: true},
    identifier: {value: identifier, enumerable: true, configurable: true},
    active: {value: active, enumerable: true, configurable: true},
    x: {value: x, enumerable: true, configurable: true},
    y: {value: y, enumerable: true, configurable: true},
    dx: {value: dx, enumerable: true, configurable: true},
    dy: {value: dy, enumerable: true, configurable: true},
    _: {value: dispatch}
  });
}

DragEvent.prototype.on = function() {
  var value = this._.on.apply(this._, arguments);
  return value === this._ ? this : value;
};

// Ignore right-click, since that should open the context menu.
function defaultFilter$1(event) {
  return !event.ctrlKey && !event.button;
}

function defaultContainer() {
  return this.parentNode;
}

function defaultSubject(event, d) {
  return d == null ? {x: event.x, y: event.y} : d;
}

function defaultTouchable$1() {
  return navigator.maxTouchPoints || ("ontouchstart" in this);
}

function drag() {
  var filter = defaultFilter$1,
      container = defaultContainer,
      subject = defaultSubject,
      touchable = defaultTouchable$1,
      gestures = {},
      listeners = dispatch("start", "drag", "end"),
      active = 0,
      mousedownx,
      mousedowny,
      mousemoving,
      touchending,
      clickDistance2 = 0;

  function drag(selection) {
    selection
        .on("mousedown.drag", mousedowned)
      .filter(touchable)
        .on("touchstart.drag", touchstarted)
        .on("touchmove.drag", touchmoved, nonpassive)
        .on("touchend.drag touchcancel.drag", touchended)
        .style("touch-action", "none")
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }

  function mousedowned(event, d) {
    if (touchending || !filter.call(this, event, d)) return;
    var gesture = beforestart(this, container.call(this, event, d), event, d, "mouse");
    if (!gesture) return;
    select(event.view)
      .on("mousemove.drag", mousemoved, nonpassivecapture)
      .on("mouseup.drag", mouseupped, nonpassivecapture);
    dragDisable(event.view);
    nopropagation$1(event);
    mousemoving = false;
    mousedownx = event.clientX;
    mousedowny = event.clientY;
    gesture("start", event);
  }

  function mousemoved(event) {
    noevent$1(event);
    if (!mousemoving) {
      var dx = event.clientX - mousedownx, dy = event.clientY - mousedowny;
      mousemoving = dx * dx + dy * dy > clickDistance2;
    }
    gestures.mouse("drag", event);
  }

  function mouseupped(event) {
    select(event.view).on("mousemove.drag mouseup.drag", null);
    yesdrag(event.view, mousemoving);
    noevent$1(event);
    gestures.mouse("end", event);
  }

  function touchstarted(event, d) {
    if (!filter.call(this, event, d)) return;
    var touches = event.changedTouches,
        c = container.call(this, event, d),
        n = touches.length, i, gesture;

    for (i = 0; i < n; ++i) {
      if (gesture = beforestart(this, c, event, d, touches[i].identifier, touches[i])) {
        nopropagation$1(event);
        gesture("start", event, touches[i]);
      }
    }
  }

  function touchmoved(event) {
    var touches = event.changedTouches,
        n = touches.length, i, gesture;

    for (i = 0; i < n; ++i) {
      if (gesture = gestures[touches[i].identifier]) {
        noevent$1(event);
        gesture("drag", event, touches[i]);
      }
    }
  }

  function touchended(event) {
    var touches = event.changedTouches,
        n = touches.length, i, gesture;

    if (touchending) clearTimeout(touchending);
    touchending = setTimeout(function() { touchending = null; }, 500); // Ghost clicks are delayed!
    for (i = 0; i < n; ++i) {
      if (gesture = gestures[touches[i].identifier]) {
        nopropagation$1(event);
        gesture("end", event, touches[i]);
      }
    }
  }

  function beforestart(that, container, event, d, identifier, touch) {
    var dispatch = listeners.copy(),
        p = pointer(touch || event, container), dx, dy,
        s;

    if ((s = subject.call(that, new DragEvent("beforestart", {
        sourceEvent: event,
        target: drag,
        identifier,
        active,
        x: p[0],
        y: p[1],
        dx: 0,
        dy: 0,
        dispatch
      }), d)) == null) return;

    dx = s.x - p[0] || 0;
    dy = s.y - p[1] || 0;

    return function gesture(type, event, touch) {
      var p0 = p, n;
      switch (type) {
        case "start": gestures[identifier] = gesture, n = active++; break;
        case "end": delete gestures[identifier], --active; // falls through
        case "drag": p = pointer(touch || event, container), n = active; break;
      }
      dispatch.call(
        type,
        that,
        new DragEvent(type, {
          sourceEvent: event,
          subject: s,
          target: drag,
          identifier,
          active: n,
          x: p[0] + dx,
          y: p[1] + dy,
          dx: p[0] - p0[0],
          dy: p[1] - p0[1],
          dispatch
        }),
        d
      );
    };
  }

  drag.filter = function(_) {
    return arguments.length ? (filter = typeof _ === "function" ? _ : constant$1(!!_), drag) : filter;
  };

  drag.container = function(_) {
    return arguments.length ? (container = typeof _ === "function" ? _ : constant$1(_), drag) : container;
  };

  drag.subject = function(_) {
    return arguments.length ? (subject = typeof _ === "function" ? _ : constant$1(_), drag) : subject;
  };

  drag.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant$1(!!_), drag) : touchable;
  };

  drag.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? drag : value;
  };

  drag.clickDistance = function(_) {
    return arguments.length ? (clickDistance2 = (_ = +_) * _, drag) : Math.sqrt(clickDistance2);
  };

  return drag;
}

var constant = x => () => x;

function ZoomEvent(type, {
  sourceEvent,
  target,
  transform,
  dispatch
}) {
  Object.defineProperties(this, {
    type: {value: type, enumerable: true, configurable: true},
    sourceEvent: {value: sourceEvent, enumerable: true, configurable: true},
    target: {value: target, enumerable: true, configurable: true},
    transform: {value: transform, enumerable: true, configurable: true},
    _: {value: dispatch}
  });
}

function Transform(k, x, y) {
  this.k = k;
  this.x = x;
  this.y = y;
}

Transform.prototype = {
  constructor: Transform,
  scale: function(k) {
    return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
  },
  translate: function(x, y) {
    return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
  },
  apply: function(point) {
    return [point[0] * this.k + this.x, point[1] * this.k + this.y];
  },
  applyX: function(x) {
    return x * this.k + this.x;
  },
  applyY: function(y) {
    return y * this.k + this.y;
  },
  invert: function(location) {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  },
  invertX: function(x) {
    return (x - this.x) / this.k;
  },
  invertY: function(y) {
    return (y - this.y) / this.k;
  },
  rescaleX: function(x) {
    return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
  },
  rescaleY: function(y) {
    return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};

var identity$2 = new Transform(1, 0, 0);

transform.prototype = Transform.prototype;

function transform(node) {
  while (!node.__zoom) if (!(node = node.parentNode)) return identity$2;
  return node.__zoom;
}

function nopropagation(event) {
  event.stopImmediatePropagation();
}

function noevent(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

// Ignore right-click, since that should open the context menu.
// except for pinch-to-zoom, which is sent as a wheel+ctrlKey event
function defaultFilter(event) {
  return (!event.ctrlKey || event.type === 'wheel') && !event.button;
}

function defaultExtent() {
  var e = this;
  if (e instanceof SVGElement) {
    e = e.ownerSVGElement || e;
    if (e.hasAttribute("viewBox")) {
      e = e.viewBox.baseVal;
      return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
    }
    return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
  }
  return [[0, 0], [e.clientWidth, e.clientHeight]];
}

function defaultTransform() {
  return this.__zoom || identity$2;
}

function defaultWheelDelta(event) {
  return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1);
}

function defaultTouchable() {
  return navigator.maxTouchPoints || ("ontouchstart" in this);
}

function defaultConstrain(transform, extent, translateExtent) {
  var dx0 = transform.invertX(extent[0][0]) - translateExtent[0][0],
      dx1 = transform.invertX(extent[1][0]) - translateExtent[1][0],
      dy0 = transform.invertY(extent[0][1]) - translateExtent[0][1],
      dy1 = transform.invertY(extent[1][1]) - translateExtent[1][1];
  return transform.translate(
    dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
    dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
  );
}

function createZoom() {
  var filter = defaultFilter,
      extent = defaultExtent,
      constrain = defaultConstrain,
      wheelDelta = defaultWheelDelta,
      touchable = defaultTouchable,
      scaleExtent = [0, Infinity],
      translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]],
      duration = 250,
      interpolate = interpolateZoom,
      listeners = dispatch("start", "zoom", "end"),
      touchstarting,
      touchfirst,
      touchending,
      touchDelay = 500,
      wheelDelay = 150,
      clickDistance2 = 0,
      tapDistance = 10;

  function zoom(selection) {
    selection
        .property("__zoom", defaultTransform)
        .on("wheel.zoom", wheeled, {passive: false})
        .on("mousedown.zoom", mousedowned)
        .on("dblclick.zoom", dblclicked)
      .filter(touchable)
        .on("touchstart.zoom", touchstarted)
        .on("touchmove.zoom", touchmoved)
        .on("touchend.zoom touchcancel.zoom", touchended)
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }

  zoom.transform = function(collection, transform, point, event) {
    var selection = collection.selection ? collection.selection() : collection;
    selection.property("__zoom", defaultTransform);
    if (collection !== selection) {
      schedule(collection, transform, point, event);
    } else {
      selection.interrupt().each(function() {
        gesture(this, arguments)
          .event(event)
          .start()
          .zoom(null, typeof transform === "function" ? transform.apply(this, arguments) : transform)
          .end();
      });
    }
  };

  zoom.scaleBy = function(selection, k, p, event) {
    zoom.scaleTo(selection, function() {
      var k0 = this.__zoom.k,
          k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return k0 * k1;
    }, p, event);
  };

  zoom.scaleTo = function(selection, k, p, event) {
    zoom.transform(selection, function() {
      var e = extent.apply(this, arguments),
          t0 = this.__zoom,
          p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p,
          p1 = t0.invert(p0),
          k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return constrain(translate(scale(t0, k1), p0, p1), e, translateExtent);
    }, p, event);
  };

  zoom.translateBy = function(selection, x, y, event) {
    zoom.transform(selection, function() {
      return constrain(this.__zoom.translate(
        typeof x === "function" ? x.apply(this, arguments) : x,
        typeof y === "function" ? y.apply(this, arguments) : y
      ), extent.apply(this, arguments), translateExtent);
    }, null, event);
  };

  zoom.translateTo = function(selection, x, y, p, event) {
    zoom.transform(selection, function() {
      var e = extent.apply(this, arguments),
          t = this.__zoom,
          p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
      return constrain(identity$2.translate(p0[0], p0[1]).scale(t.k).translate(
        typeof x === "function" ? -x.apply(this, arguments) : -x,
        typeof y === "function" ? -y.apply(this, arguments) : -y
      ), e, translateExtent);
    }, p, event);
  };

  function scale(transform, k) {
    k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k));
    return k === transform.k ? transform : new Transform(k, transform.x, transform.y);
  }

  function translate(transform, p0, p1) {
    var x = p0[0] - p1[0] * transform.k, y = p0[1] - p1[1] * transform.k;
    return x === transform.x && y === transform.y ? transform : new Transform(transform.k, x, y);
  }

  function centroid(extent) {
    return [(+extent[0][0] + +extent[1][0]) / 2, (+extent[0][1] + +extent[1][1]) / 2];
  }

  function schedule(transition, transform, point, event) {
    transition
        .on("start.zoom", function() { gesture(this, arguments).event(event).start(); })
        .on("interrupt.zoom end.zoom", function() { gesture(this, arguments).event(event).end(); })
        .tween("zoom", function() {
          var that = this,
              args = arguments,
              g = gesture(that, args).event(event),
              e = extent.apply(that, args),
              p = point == null ? centroid(e) : typeof point === "function" ? point.apply(that, args) : point,
              w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]),
              a = that.__zoom,
              b = typeof transform === "function" ? transform.apply(that, args) : transform,
              i = interpolate(a.invert(p).concat(w / a.k), b.invert(p).concat(w / b.k));
          return function(t) {
            if (t === 1) t = b; // Avoid rounding error on end.
            else { var l = i(t), k = w / l[2]; t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k); }
            g.zoom(null, t);
          };
        });
  }

  function gesture(that, args, clean) {
    return (!clean && that.__zooming) || new Gesture(that, args);
  }

  function Gesture(that, args) {
    this.that = that;
    this.args = args;
    this.active = 0;
    this.sourceEvent = null;
    this.extent = extent.apply(that, args);
    this.taps = 0;
  }

  Gesture.prototype = {
    event: function(event) {
      if (event) this.sourceEvent = event;
      return this;
    },
    start: function() {
      if (++this.active === 1) {
        this.that.__zooming = this;
        this.emit("start");
      }
      return this;
    },
    zoom: function(key, transform) {
      if (this.mouse && key !== "mouse") this.mouse[1] = transform.invert(this.mouse[0]);
      if (this.touch0 && key !== "touch") this.touch0[1] = transform.invert(this.touch0[0]);
      if (this.touch1 && key !== "touch") this.touch1[1] = transform.invert(this.touch1[0]);
      this.that.__zoom = transform;
      this.emit("zoom");
      return this;
    },
    end: function() {
      if (--this.active === 0) {
        delete this.that.__zooming;
        this.emit("end");
      }
      return this;
    },
    emit: function(type) {
      var d = select(this.that).datum();
      listeners.call(
        type,
        this.that,
        new ZoomEvent(type, {
          sourceEvent: this.sourceEvent,
          target: zoom,
          type,
          transform: this.that.__zoom,
          dispatch: listeners
        }),
        d
      );
    }
  };

  function wheeled(event, ...args) {
    if (!filter.apply(this, arguments)) return;
    var g = gesture(this, args).event(event),
        t = this.__zoom,
        k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta.apply(this, arguments)))),
        p = pointer(event);

    // If the mouse is in the same location as before, reuse it.
    // If there were recent wheel events, reset the wheel idle timeout.
    if (g.wheel) {
      if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) {
        g.mouse[1] = t.invert(g.mouse[0] = p);
      }
      clearTimeout(g.wheel);
    }

    // If this wheel event won’t trigger a transform change, ignore it.
    else if (t.k === k) return;

    // Otherwise, capture the mouse point and location at the start.
    else {
      g.mouse = [p, t.invert(p)];
      interrupt(this);
      g.start();
    }

    noevent(event);
    g.wheel = setTimeout(wheelidled, wheelDelay);
    g.zoom("mouse", constrain(translate(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));

    function wheelidled() {
      g.wheel = null;
      g.end();
    }
  }

  function mousedowned(event, ...args) {
    if (touchending || !filter.apply(this, arguments)) return;
    var currentTarget = event.currentTarget,
        g = gesture(this, args, true).event(event),
        v = select(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true),
        p = pointer(event, currentTarget),
        x0 = event.clientX,
        y0 = event.clientY;

    dragDisable(event.view);
    nopropagation(event);
    g.mouse = [p, this.__zoom.invert(p)];
    interrupt(this);
    g.start();

    function mousemoved(event) {
      noevent(event);
      if (!g.moved) {
        var dx = event.clientX - x0, dy = event.clientY - y0;
        g.moved = dx * dx + dy * dy > clickDistance2;
      }
      g.event(event)
       .zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = pointer(event, currentTarget), g.mouse[1]), g.extent, translateExtent));
    }

    function mouseupped(event) {
      v.on("mousemove.zoom mouseup.zoom", null);
      yesdrag(event.view, g.moved);
      noevent(event);
      g.event(event).end();
    }
  }

  function dblclicked(event, ...args) {
    if (!filter.apply(this, arguments)) return;
    var t0 = this.__zoom,
        p0 = pointer(event.changedTouches ? event.changedTouches[0] : event, this),
        p1 = t0.invert(p0),
        k1 = t0.k * (event.shiftKey ? 0.5 : 2),
        t1 = constrain(translate(scale(t0, k1), p0, p1), extent.apply(this, args), translateExtent);

    noevent(event);
    if (duration > 0) select(this).transition().duration(duration).call(schedule, t1, p0, event);
    else select(this).call(zoom.transform, t1, p0, event);
  }

  function touchstarted(event, ...args) {
    if (!filter.apply(this, arguments)) return;
    var touches = event.touches,
        n = touches.length,
        g = gesture(this, args, event.changedTouches.length === n).event(event),
        started, i, t, p;

    nopropagation(event);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer(t, this);
      p = [p, this.__zoom.invert(p), t.identifier];
      if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
      else if (!g.touch1 && g.touch0[2] !== p[2]) g.touch1 = p, g.taps = 0;
    }

    if (touchstarting) touchstarting = clearTimeout(touchstarting);

    if (started) {
      if (g.taps < 2) touchfirst = p[0], touchstarting = setTimeout(function() { touchstarting = null; }, touchDelay);
      interrupt(this);
      g.start();
    }
  }

  function touchmoved(event, ...args) {
    if (!this.__zooming) return;
    var g = gesture(this, args).event(event),
        touches = event.changedTouches,
        n = touches.length, i, t, p, l;

    noevent(event);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer(t, this);
      if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
      else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
    }
    t = g.that.__zoom;
    if (g.touch1) {
      var p0 = g.touch0[0], l0 = g.touch0[1],
          p1 = g.touch1[0], l1 = g.touch1[1],
          dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp,
          dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
      t = scale(t, Math.sqrt(dp / dl));
      p = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
    }
    else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
    else return;

    g.zoom("touch", constrain(translate(t, p, l), g.extent, translateExtent));
  }

  function touchended(event, ...args) {
    if (!this.__zooming) return;
    var g = gesture(this, args).event(event),
        touches = event.changedTouches,
        n = touches.length, i, t;

    nopropagation(event);
    if (touchending) clearTimeout(touchending);
    touchending = setTimeout(function() { touchending = null; }, touchDelay);
    for (i = 0; i < n; ++i) {
      t = touches[i];
      if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
      else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
    }
    if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
    if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
    else {
      g.end();
      // If this was a dbltap, reroute to the (optional) dblclick.zoom handler.
      if (g.taps === 2) {
        t = pointer(t, this);
        if (Math.hypot(touchfirst[0] - t[0], touchfirst[1] - t[1]) < tapDistance) {
          var p = select(this).on("dblclick.zoom");
          if (p) p.apply(this, arguments);
        }
      }
    }
  }

  zoom.wheelDelta = function(_) {
    return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant(+_), zoom) : wheelDelta;
  };

  zoom.filter = function(_) {
    return arguments.length ? (filter = typeof _ === "function" ? _ : constant(!!_), zoom) : filter;
  };

  zoom.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant(!!_), zoom) : touchable;
  };

  zoom.extent = function(_) {
    return arguments.length ? (extent = typeof _ === "function" ? _ : constant([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
  };

  zoom.scaleExtent = function(_) {
    return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
  };

  zoom.translateExtent = function(_) {
    return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
  };

  zoom.constrain = function(_) {
    return arguments.length ? (constrain = _, zoom) : constrain;
  };

  zoom.duration = function(_) {
    return arguments.length ? (duration = +_, zoom) : duration;
  };

  zoom.interpolate = function(_) {
    return arguments.length ? (interpolate = _, zoom) : interpolate;
  };

  zoom.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? zoom : value;
  };

  zoom.clickDistance = function(_) {
    return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
  };

  zoom.tapDistance = function(_) {
    return arguments.length ? (tapDistance = +_, zoom) : tapDistance;
  };

  return zoom;
}

function connectedComponents(links) {
  const parent = new Map();
  const rank = new Map();
  const genes = [];
  const add = (uid) => {
    if (parent.has(uid)) return;
    parent.set(uid, uid);
    rank.set(uid, 0);
    genes.push(uid);
  };
  const find = (uid) => {
    let root = uid;
    while (parent.get(root) !== root) root = parent.get(root);
    while (uid !== root) {
      const next = parent.get(uid);
      parent.set(uid, root);
      uid = next;
    }
    return root;
  };
  const join = (left, right) => {
    let leftRoot = find(left);
    let rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    if (rank.get(leftRoot) < rank.get(rightRoot)) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    parent.set(rightRoot, leftRoot);
    if (rank.get(leftRoot) === rank.get(rightRoot)) rank.set(leftRoot, rank.get(leftRoot) + 1);
  };

  for (const link of links) {
    const query = link.query.uid;
    const target = link.target.uid;
    add(query);
    add(target);
    join(query, target);
  }

  const components = new Map();
  for (const uid of genes) {
    const root = find(uid);
    const component = components.get(root) || [];
    component.push(uid);
    components.set(root, component);
  }
  return [...components.values()];
}

function nextGeneratedUid(used) {
  let uid = 0;
  while (used.has(uid)) uid += 1;
  used.add(uid);
  return uid;
}

function generatedGroup(usedUids, genes) {
  const uid = nextGeneratedUid(usedUids);
  return { uid, label: `Group ${uid}`, genes, hidden: false, colour: null };
}

/**
 * Build connected homology groups from link endpoints.
 *
 * Existing groups keep their uid, label, colour, and visibility when they
 * overlap a new component. Groups with no linked members are retained, which
 * preserves intentionally empty or unlinked groups from older input data.
 */
function createLinkGroups(links, oldGroups = []) {
  const previous = oldGroups || [];
  const previousByGene = new Map();
  previous.forEach((group, index) => {
    for (const uid of group.genes || []) {
      const indices = previousByGene.get(uid) || [];
      indices.push(index);
      previousByGene.set(uid, indices);
    }
  });

  const components = connectedComponents(links);
  const linkedGenes = new Set(components.flat());
  const usedPrevious = new Set();
  const usedUids = new Set(previous.map((group) => group.uid));
  const generated = [];
  const byPreviousIndex = new Map();

  for (const genes of components) {
    const overlaps = new Map();
    for (const uid of genes) {
      for (const index of previousByGene.get(uid) || []) {
        if (!usedPrevious.has(index)) overlaps.set(index, (overlaps.get(index) || 0) + 1);
      }
    }
    let previousIndex = null;
    let largestOverlap = 0;
    for (const [index, overlap] of overlaps) {
      if (overlap > largestOverlap) {
        previousIndex = index;
        largestOverlap = overlap;
      }
    }
    const group = previousIndex === null
      ? generatedGroup(usedUids, genes)
      : { ...previous[previousIndex], genes };
    if (previousIndex === null) generated.push(group);
    else {
      usedPrevious.add(previousIndex);
      byPreviousIndex.set(previousIndex, group);
    }
  }

  const retained = previous.flatMap((group, index) => {
    const replacement = byPreviousIndex.get(index);
    if (replacement) return [replacement];
    return (group.genes || []).some((uid) => linkedGenes.has(uid)) ? [] : [{ ...group, genes: [...(group.genes || [])] }];
  });
  return [...retained, ...generated];
}

function getGroupScaleValues(groups) {
  const domain = [];
  const range = [];

  groups.forEach((group) => {
    if (group.hidden) return;
    group.genes.forEach((gene) => {
      domain.push(gene);
      range.push(group.uid);
    });
  });

  return { domain, range };
}

function filterLinks(
  links,
  { groupForGene, geneForUid, bestOnly, threshold }
) {
  const passing = [];
  for (const link of links) {
    // Link records remain part of the editable data even if an endpoint is
    // temporarily absent (for example after deleting a gene). A renderer
    // must omit such a link rather than treating that data relationship as
    // deleted or dereferencing a missing gene below.
    const query = geneForUid(link.query.uid);
    const target = geneForUid(link.target.uid);
    if (
      link.hidden ||
      !query ||
      !target ||
      link.identity < threshold ||
      groupForGene(link.query.uid) === null ||
      groupForGene(link.target.uid) === null
    ) continue;
    passing.push({ link, query, target });
  }
  // Threshold decides visibility regardless of whether the optional
  // best-per-cluster-pair reduction is enabled. Colour scaling is deliberately
  // independent and is resolved by the shared identity scale.
  if (!bestOnly) return passing.map(({ link }) => link);

  const pairKey = (left, right) => {
    const first = `${typeof left}:${String(left)}`;
    const second = `${typeof right}:${String(right)}`;
    return first < second ? `${first}|${second}` : `${second}|${first}`;
  };
  const linksByClusterPair = new Map();
  const byIdentity = [...passing].sort((a, b) => b.link.identity - a.link.identity);

  for (const { link, query, target } of byIdentity) {
    const clusterPair = pairKey(
      query.clusterUid,
      target.clusterUid
    );
    const selected = linksByClusterPair.get(clusterPair) || {
      links: [],
      bestIdentityForGene: new Map(),
    };
    const queryBest = selected.bestIdentityForGene.get(link.query.uid);
    const targetBest = selected.bestIdentityForGene.get(link.target.uid);
    // Equal-scoring links intentionally survive: only a strictly better link
    // that shares an endpoint supersedes this relationship.
    if (queryBest > link.identity || targetBest > link.identity) continue;
    selected.links.push(link);
    selected.bestIdentityForGene.set(link.query.uid, Math.max(queryBest ?? -Infinity, link.identity));
    selected.bestIdentityForGene.set(link.target.uid, Math.max(targetBest ?? -Infinity, link.identity));
    linksByClusterPair.set(clusterPair, selected);
  }

  return [...linksByClusterPair.values()]
    .flatMap(({ links: selected }) => selected);
}

/** Test world bounds after applying a preview translation. */
function boundsInViewport(bounds, viewport, { x = 0, y = 0 } = {}) {
  return !viewport || !bounds || bounds.minX + x <= viewport.maxX && bounds.maxX + x >= viewport.minX &&
    bounds.minY + y <= viewport.maxY && bounds.maxY + y >= viewport.minY;
}

function validBounds$1(bounds) {
  return (
    bounds &&
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxY) &&
    bounds.maxX > bounds.minX &&
    bounds.maxY > bounds.minY
  );
}

/** Camera-visible world rectangle, with overscan measured in screen pixels. */
function worldViewport(camera, { width, height }, overscan = 20) {
  const margin = overscan / camera.k;
  return {
    minX: -camera.x / camera.k - margin,
    maxX: (width - camera.x) / camera.k + margin,
    minY: -camera.y / camera.k - margin,
    maxY: (height - camera.y) / camera.k + margin,
  };
}

/**
 * Fit a world-space figure envelope into a viewport.
 *
 * Renderers may obtain the envelope differently (SVG can use getBBox while
 * raster renderers measure text), but camera policy stays shared: cap an
 * ordinary fit, optionally retain a readable scale for oversized figures,
 * and top-align whenever that scale crops the figure.
 */
function fitCameraForBounds({
  bounds,
  viewport,
  padding = 20,
  maximumFitScale = 1.2,
  minimumReadableScale = 0,
  constrainScale = (scale) => scale,
} = {}) {
  if (!validBounds$1(bounds) || !viewport?.width || !viewport?.height) return null;

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const fitScale = Math.min(
    maximumFitScale,
    (viewport.width - padding * 2) / width,
    (viewport.height - padding * 2) / height
  );
  const k = constrainScale(Math.max(fitScale, minimumReadableScale));
  const cropped = k > fitScale;
  return {
    x: cropped
      ? padding - bounds.minX * k
      : (viewport.width - width * k) / 2 - bounds.minX * k,
    y: cropped
      ? padding - bounds.minY * k
      : (viewport.height - height * k) / 2 - bounds.minY * k,
    k,
    fitScale,
    cropped,
  };
}

function clusterPairKey(left, right) {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function getLinkAnchors(
  link,
  {
    geneForUid,
    areClustersAdjacent,
    scaleX,
    horizontalOffset,
    verticalPosition,
    geneMidpoint,
  }
) {
  const query = geneForUid(link.query.uid);
  const target = geneForUid(link.target.uid);

  if (!areClustersAdjacent(query.clusterUid, target.clusterUid)) return null;

  const getGeneAnchors = (gene) => {
    const offset = horizontalOffset(gene);
    const left = scaleX(gene.start) + offset;
    const right = scaleX(gene.end) + offset;
    const forward = gene.strand === 1;
    return [
      forward ? left : right,
      forward ? right : left,
      verticalPosition(gene) + geneMidpoint,
    ];
  };

  const [ax1, ax2, ay] = getGeneAnchors(query);
  const [bx1, bx2, by] = getGeneAnchors(target);

  return ay > by
    ? [bx1, bx2, by, ax1, ax2, ay]
    : [ax1, ax2, ay, bx1, bx2, by];
}

function interpolateLinkOpacity(previous, next, amount, enabled = true) {
  const isRenderable = (link) => Boolean(enabled && link?.visible && link?.anchors);
  const from = isRenderable(previous) ? 1 : 0;
  const to = isRenderable(next) ? 1 : 0;
  return from + (to - from) * amount;
}

function interpolateLinkAnchors(previousScene, previous, nextScene, next, amount) {
  const inQueryOrder = (scene, link) => {
    if (!link?.anchors) return null;
    const query = scene?.genes.get(link.source.query.uid);
    const queryY = query?.locus?.y;
    if (!Number.isFinite(queryY)) return link.anchors;
    const anchors = link.anchors;
    const queryFirst = Math.abs(anchors[2] - queryY) <= Math.abs(anchors[5] - queryY);
    return queryFirst ? anchors : [anchors[3], anchors[4], anchors[5], anchors[0], anchors[1], anchors[2]];
  };
  const from = inQueryOrder(previousScene, previous);
  const to = inQueryOrder(nextScene, next);
  if (!from) return to;
  if (!to) return from;
  return to.map((value, index) => from[index] + (value - from[index]) * amount);
}

function getLinkLabelPosition(
  [ax1, ax2, ay, bx1, bx2, by],
  position
) {
  const aMid = ax1 + (ax2 - ax1) / 2;
  const bMid = bx1 + (bx2 - bx1) / 2;
  return {
    x: aMid + (bMid - aMid) * position,
    y: ay + (by - ay) * position,
  };
}

function linkPathCommands(anchors, { asLine = false, straight = false } = {}) {
  if (!anchors) return [];
  const [ax1, ax2, ay, bx1, bx2, by] = anchors;
  const aMid = ax1 + (ax2 - ax1) / 2;
  const bMid = bx1 + (bx2 - bx1) / 2;
  const middle = ay + (by - ay) / 2;
  if (asLine) {
    return straight
      ? [["M", aMid, ay], ["L", bMid, by]]
      : [["M", aMid, ay], ["C", aMid, middle, bMid, middle, bMid, by]];
  }
  return straight
    ? [["M", ax1, ay], ["L", ax2, ay], ["L", bx2, by], ["L", bx1, by], ["L", ax1, ay], ["Z"]]
    : [
        ["M", ax2, ay],
        ["C", ax2, middle, bx2, middle, bx2, by],
        ["L", bx1, by],
        ["C", bx1, middle, ax1, middle, ax1, ay],
        ["Z"],
      ];
}

/** Trace the same link shape used by SVG onto a Canvas context. */
function traceLinkPath(context, anchors, style) {
  for (const [command, ...values] of linkPathCommands(anchors, style)) {
    if (command === "M") context.moveTo(...values);
    else if (command === "L") context.lineTo(...values);
    else if (command === "C") context.bezierCurveTo(...values);
    else context.closePath();
  }
}

/**
 * Sample a link in world coordinates for renderers that submit triangles and
 * line segments directly rather than accepting SVG/Canvas path commands.
 */
function sampleLinkGeometry(anchors, { asLine = false, straight = false, segments = 10 } = {}) {
  if (!anchors) return { asLine, upper: [], lower: [], line: [] };
  const [ax1, ax2, ay, bx1, bx2, by] = anchors;
  const middle = ay + (by - ay) / 2;
  const pointFor = (startX, endX, amount) => straight
    ? [startX + (endX - startX) * amount, ay + (by - ay) * amount]
    : [
        cubic(startX, startX, endX, endX, amount),
        cubic(ay, middle, middle, by, amount),
      ];
  const count = straight ? 1 : Math.max(1, segments);
  const samples = (startX, endX) => Array.from(
    { length: count + 1 },
    (_, index) => pointFor(startX, endX, index / count)
  );
  if (asLine) return {
    asLine,
    upper: [],
    lower: [],
    line: samples((ax1 + ax2) / 2, (bx1 + bx2) / 2),
  };
  return { asLine, upper: samples(ax2, bx2), lower: samples(ax1, bx1), line: [] };
}

function cubic(start, controlA, controlB, end, amount) {
  const inverse = 1 - amount;
  return (
    inverse * inverse * inverse * start +
    3 * inverse * inverse * amount * controlA +
    3 * inverse * amount * amount * controlB +
    amount * amount * amount * end
  );
}

function getLinkPath(anchors, style) {
  return linkPathCommands(anchors, style)
    .map(([command, ...values]) => `${command}${values.join(",")}`)
    .join("");
}

function formatLength(length) {
  const rounded = Math.round(length);
  if (rounded >= 1000) {
    const kilobases = rounded / 1000;
    return `${Number(kilobases.toFixed(kilobases >= 10 ? 0 : 1))} kb`;
  }
  return `${rounded} bp`;
}

function featureText(count) {
  return `${count} ${count === 1 ? "feature" : "features"}`;
}

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

/**
 * Shared text metrics for layout and renderers. The width estimate only
 * chooses collision lanes; the renderer remains the source of exact glyph
 * placement.
 */
function resolveTrimIndicatorStyle(style = {}) {
  const fontSize = boundedNumber(style.fontSize, 10, 6, 48);
  const fontWeight = boundedNumber(style.fontWeight, 600, 100, 900);
  return {
    fontSize,
    fontWeight,
    borderWidth: boundedNumber(style.borderWidth, 3, 0, 12),
    borderOpacity: boundedNumber(style.borderOpacity, 1, 0, 1),
    lineHeight: Math.ceil(fontSize * 1.2),
    characterWidth: fontSize * (fontWeight >= 600 ? 0.6 : 0.56),
  };
}

function indicatorBounds(locus, indicator, metrics) {
  const width = indicator.text.length * metrics.characterWidth;
  const x = locus.x + indicator.x;
  const left = indicator.anchor === "end" ? x - width : x;
  return {
    left: left - 2,
    right: left + width + 2,
    top: locus.y + indicator.y - 1,
    bottom: locus.y + indicator.y + metrics.fontSize + 1,
  };
}

function overlaps(one, two) {
  return (
    one.left < two.right && one.right > two.left &&
    one.top < two.bottom && one.bottom > two.top
  );
}

/**
 * Assign the smallest non-overlapping vertical lane to every trim label.
 * This keeps both labels on one locus aligned whenever they fit, while also
 * preventing labels from separate loci in the same cluster from colliding.
 */
function arrangeTrimIndicators(loci, replacements = new Map(), style = {}) {
  const metrics = resolveTrimIndicatorStyle(style);
  const arranged = new Map();
  const placed = [];
  for (const locus of [...loci].sort((one, two) => one.y - two.y || one.x - two.x)) {
    const indicators = replacements.get(locus.source.uid) || locus.trimIndicators || [];
    const positioned = [];
    for (const indicator of indicators) {
      const next = { ...indicator };
      let bounds = indicatorBounds(locus, next, metrics);
      while (placed.some((candidate) => overlaps(bounds, candidate))) {
        next.y += metrics.lineHeight;
        bounds = indicatorBounds(locus, next, metrics);
      }
      positioned.push(next);
      placed.push(bounds);
    }
    arranged.set(locus.source.uid, positioned);
  }
  return arranged;
}

/**
 * Describe the hidden flanks of a trimmed locus in its local display space.
 * The resulting records are deliberately renderer-neutral: SVG can use them
 * as text nodes while Canvas and WebGPU's Canvas overlay draw the same labels.
 */
function createTrimIndicators({ locus, state, getGeneState, scaleX, shape = {} }) {
  if (!locus || !state) return [];
  const start = Number(state.start);
  const end = Number(state.end);
  const fullStart = Number(locus.start);
  const fullEnd = Number(locus.end);
  if (![start, end, fullStart, fullEnd].every(Number.isFinite)) return [];

  const genes = locus.genes || [];
  const countBefore = (boundary) =>
    genes.filter((gene) => Number(getGeneState(gene)?.end) <= boundary).length;
  const countAfter = (boundary) =>
    genes.filter((gene) => Number(getGeneState(gene)?.start) >= boundary).length;
  const y = (shape.tipHeight || 0) * 2 + (shape.bodyHeight || 0) + 4;
  const indicators = [];

  if (start > fullStart) {
    indicators.push({
      side: "left",
      x: scaleX(start) + 3,
      y,
      anchor: "start",
      text: `← ${formatLength(start - fullStart)} · ${featureText(countBefore(start))}`,
    });
  }
  if (end < fullEnd) {
    indicators.push({
      side: "right",
      x: scaleX(end) - 3,
      y,
      anchor: "end",
      text: `${featureText(countAfter(end))} · ${formatLength(fullEnd - end)} →`,
    });
  }
  return indicators;
}

function minStart(loci, startFor) {
  let start = Infinity;
  for (const locus of loci) start = Math.min(start, startFor(locus));
  return start;
}

function clusterUidForLocus(locus) {
  return locus.cluster?.uid ?? locus.cluster?.source?.uid ?? locus.source.clusterUid;
}

function clusterLabelOffsetsForStarts(
  scene,
  startFor,
  alignLabels,
  affectedClusters = scene.clusters.values()
) {
  const offsets = new Map();
  if (alignLabels) {
    const offset = minStart(scene.loci.values(), startFor) -
      minStart(scene.loci.values(), (locus) => locus.worldStart);
    for (const cluster of scene.clusters.values()) offsets.set(cluster.source.uid, offset);
    return offsets;
  }
  for (const cluster of affectedClusters) {
    offsets.set(
      cluster.source.uid,
      minStart(cluster.loci, startFor) - minStart(cluster.loci, (locus) => locus.worldStart)
    );
  }
  return offsets;
}

function chromeForPreview(scene, maxX) {
  if (!scene.chrome) return null;
  const dx = scene.annotationPanels?.length ? annotationOffsetForPreview(scene, { contentMaxX: maxX }) : maxX - scene.bounds.maxX;
  return {
    ...scene.chrome,
    legend: {
      ...scene.chrome.legend,
      position: {
        ...scene.chrome.legend.position,
        x:
          scene.chrome.legend.placement === "bottom"
            ? scene.chrome.legend.position.x
            : scene.chrome.legend.position.x + dx,
      },
    },
  };
}

/** Keep the annotation group beyond stationary scales while loci move. */
function annotationOffsetForPreview(scene, preview) {
  if (!scene.annotationPanels?.length || preview?.contentMaxX === undefined) return 0;
  let right = -Infinity;
  for (const locus of scene.loci.values()) right = Math.max(right, locus.worldEnd);
  const movingRight = scene.bounds.maxX + preview.contentMaxX - right;
  return Math.max(movingRight, scene.annotationChromeRight ?? -Infinity) -
    (scene.annotationAnchorX ?? scene.bounds.maxX);
}

function locusPreview(scene, fields, startFor, endFor, alignLabels, affectedClusters) {
  let contentMaxX = -Infinity;
  for (const locus of scene.loci.values()) contentMaxX = Math.max(contentMaxX, endFor(locus));
  return {
    ...fields,
    contentMaxX,
    clusterLabelOffsets: clusterLabelOffsetsForStarts(scene, startFor, alignLabels, affectedClusters),
    chrome: chromeForPreview(scene, contentMaxX),
  };
}

/**
 * Describe a transient locus translation relative to an already projected
 * scene. This is deliberately a sparse, renderer-neutral patch: it avoids
 * rebuilding the scene while a drag is in progress.
 */
function createLocusOffsetPreview(scene, locusUid, offset, { alignLabels }) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;
  const offsetX = offset - locus.localX;
  const startFor = (candidate) =>
    candidate.source.uid === locusUid ? candidate.worldStart + offsetX : candidate.worldStart;
  const endFor = (candidate) =>
    candidate.source.uid === locusUid ? candidate.worldEnd + offsetX : candidate.worldEnd;
  return locusPreview(scene, {
    type: "locus-offset",
    locusUid,
    offsetX,
  }, startFor, endFor, alignLabels, [scene.clusters.get(locus.cluster.uid)]);
}

/** Describe several transient locus translations without rebuilding the scene. */
function createLocusOffsetsPreview(scene, offsets, { alignLabels }) {
  const locusOffsets = new Map();
  const affectedClusters = new Set();
  for (const [locusUid, offset] of offsets) {
    const locus = scene.loci.get(locusUid);
    if (!locus) continue;
    locusOffsets.set(locusUid, offset - locus.localX);
    const cluster = scene.clusters.get(locus.cluster.uid);
    if (cluster) affectedClusters.add(cluster);
  }
  if (!locusOffsets.size) return null;
  const offsetFor = (candidate) => locusOffsets.get(candidate.source.uid) || 0;
  const startFor = (candidate) => candidate.worldStart + offsetFor(candidate);
  const endFor = (candidate) => candidate.worldEnd + offsetFor(candidate);
  return locusPreview(scene, {
    type: "locus-offsets",
    locusOffsets,
  }, startFor, endFor, alignLabels, affectedClusters);
}

/**
 * Describe a transient trim using the current scene and updated locus-scale
 * offsets. The controller updates scales (but not the scene) before calling
 * this, so sibling loci retain their correct packed positions without a full
 * data-to-scene projection for every pointer event.
 */
function createLocusTrimPreview(
  scene,
  locusUid,
  state,
  { localXFor, scaleX, alignLabels, shape, trimIndicatorStyle = {}, clusterLabelText = null }
) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;

  const locusOffsets = new Map();
  for (const candidate of scene.loci.values()) {
    locusOffsets.set(candidate.source.uid, localXFor(candidate.source.uid) - candidate.localX);
  }
  const offsetFor = (candidate) => locusOffsets.get(candidate.source.uid) || 0;
  const trimmed = {
    worldStart: locus.x + offsetFor(locus) + scaleX(state.start),
    worldEnd: locus.x + offsetFor(locus) + scaleX(state.end),
    track: {
      ...locus.track,
      x1: scaleX(state.start),
      x2: scaleX(state.end),
    },
    hover: {
      ...locus.hover,
      x: scaleX(state.start),
      width: scaleX(state.end) - scaleX(state.start),
      leftHandleX: scaleX(state.start) - 8,
      rightHandleX: scaleX(state.end),
    },
    trimIndicators: createTrimIndicators({
      locus: locus.source,
      state,
      getGeneState: (gene) => scene.genes.get(gene.uid)?.display || gene,
      scaleX,
      shape,
    }),
  };
  const locusGeometry = new Map([[locusUid, trimmed]]);
  const arrangedTrimIndicators = arrangeTrimIndicators(
    scene.loci.values(),
    new Map([[locusUid, trimmed.trimIndicators]]),
    trimIndicatorStyle
  );
  trimmed.trimIndicators = arrangedTrimIndicators.get(locusUid) || [];
  const startFor = (candidate) =>
    candidate.source.uid === locusUid
      ? trimmed.worldStart
      : candidate.worldStart + offsetFor(candidate);
  const endFor = (candidate) =>
    candidate.source.uid === locusUid
      ? trimmed.worldEnd
      : candidate.worldEnd + offsetFor(candidate);
  const geneVisibility = new Map();
  for (const gene of locus.genes) {
    geneVisibility.set(
      gene.source.uid,
      gene.display.start >= state.start && gene.display.end <= state.end + 1
    );
  }

  return locusPreview(scene, {
    type: "locus-trim",
    locusUid,
    locusOffsets,
    loci: locusGeometry,
    geneVisibility,
    ...(clusterLabelText === null
      ? {}
      : {
          clusterLabelTexts: new Map([[
            clusterUidForLocus(locus),
            clusterLabelText,
          ]]),
        }),
  }, startFor, endFor, alignLabels);
}

// Preview patches carry layout deltas rather than cloned scenes. These
// accessors keep SVG, Canvas chrome, and dense WebGPU marks on the same
// locus, cluster, and link geometry.
function locusOffsetForPreview(preview, locusUid) {
  if (preview?.locusOffsets?.has(locusUid)) return preview.locusOffsets.get(locusUid);
  return preview?.type === "locus-offset" && preview.locusUid === locusUid
    ? preview.offsetX
    : 0;
}

function clusterLabelOffsetForPreview(preview, clusterUid) {
  return preview?.clusterLabelOffsets?.get(clusterUid) || 0;
}

function clusterLabelTextForPreview(preview, clusterUid, fallback) {
  return preview?.clusterLabelTexts?.get(clusterUid) ?? fallback;
}

function clusterOffsetForPreview(preview, clusterUid) {
  return preview?.clusterOffsets?.get(clusterUid) || 0;
}

function previewOffsetsForLocus(preview, locus) {
  if (!preview || !locus) return { x: 0, y: 0 };
  return {
    x: locusOffsetForPreview(preview, locus.source?.uid),
    y: clusterOffsetForPreview(preview, locus.cluster?.uid ?? locus.source?.clusterUid),
  };
}

function locusGeometryForPreview(preview, locus) {
  if (preview?.type === "locus-flip") {
    const axis = preview.axes?.get(locus.source.uid);
    if (axis !== undefined) {
      const flip = (x) => x + (axis * 2 - x - x) * preview.progress;
      const start = flip(locus.worldStart);
      const end = flip(locus.worldEnd);
      const hoverStart = flip(locus.x + locus.hover.x);
      const hoverEnd = flip(locus.x + locus.hover.x + locus.hover.width);
      const left = Math.min(start, end);
      const right = Math.max(start, end);
      return {
        offsets: previewOffsetsForLocus(preview, locus),
        worldStart: left,
        worldEnd: right,
        track: {
          ...locus.track,
          x1: flip(locus.x + locus.track.x1) - locus.x,
          x2: flip(locus.x + locus.track.x2) - locus.x,
        },
        hover: {
          ...locus.hover,
          x: Math.min(hoverStart, hoverEnd) - locus.x,
          width: Math.abs(hoverEnd - hoverStart),
          leftHandleX: left - locus.x - 8,
          rightHandleX: right - locus.x,
        },
      };
    }
  }
  const trimmed = preview?.loci?.get(locus.source.uid);
  return {
    offsets: previewOffsetsForLocus(preview, locus),
    ...(trimmed || {}),
  };
}

function geneVisibleForPreview(preview, gene) {
  return gene && (preview?.geneVisibility?.get(gene.source.uid) ?? gene.visible);
}

/** Describe flip frames without re-projecting the chart. */
function createLocusFlipPreview(
  scene,
  locusUid,
  { progress = 0, clusterLabelText = null } = {}
) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;
  return {
    type: "locus-flip",
    locusUid,
    progress,
    ...(clusterLabelText === null
      ? {}
      : {
          clusterLabelTexts: new Map([[
            clusterUidForLocus(locus),
            clusterLabelText,
          ]]),
        }),
    // The projected bounds reflect the currently displayed locus, including
    // any committed trim. Source coordinates describe the original record and
    // must not determine the transient flip axis.
    axes: new Map([[locusUid, (locus.worldStart + locus.worldEnd) / 2]]),
  };
}

/** Describe temporary cluster rows without rebuilding a scene. */
function createClusterDragPreview(scene, { clusterUid, position, positions, order, rows }) {
  const clusterOffsets = new Map();
  const clusterOrder = new Map();
  for (const [index, uid] of order.entries()) {
    const cluster = scene.clusters.get(uid);
    if (!cluster) continue;
    const y = positions?.get(uid) ?? (uid === clusterUid ? position : rows[index]);
    clusterOffsets.set(uid, y - cluster.y);
    clusterOrder.set(uid, index);
  }
  return { type: "cluster-drag", clusterUid, clusterOffsets, clusterOrder };
}

function offsetsForGene(preview, gene) {
  return previewOffsetsForLocus(preview, gene.locus);
}

function flipAxisForGene(preview, gene) {
  return preview?.type === "locus-flip"
    ? preview.axes?.get(gene?.locus?.source?.uid)
    : undefined;
}

function geneGeometryForPreview(preview, gene) {
  const axis = flipAxisForGene(preview, gene);
  if (axis === undefined) return {};
  const progress = preview.progress;
  const flipScale = 1 - 2 * progress;
  const flip = (x) => axis + (x - axis) * flipScale;
  return {
    flipAxis: axis,
    flipScale,
    labelX: flip(gene.locus.x + gene.label.x),
  };
}

function linkOffsetsForPreview(scene, link, preview) {
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  const offsetForGene = (gene) =>
    locusOffsetForPreview(preview, gene?.locus?.source?.uid ?? gene?.source?.locusUid);
  const queryOffset = offsetForGene(query);
  const targetOffset = offsetForGene(target);
  // Link anchors are ordered from the upper locus to the lower one, not from
  // source.query to source.target.
  return query?.locus?.y <= target?.locus?.y
    ? { a: queryOffset, b: targetOffset }
    : { a: targetOffset, b: queryOffset };
}

function previewLinkAnchors(scene, link, preview) {
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return null;
  const anchorForGene = (gene) => {
    const offsets = offsetsForGene(preview, gene);
    // Bounds are calculated when the retained scene is built and equal the
    // polygon's horizontal extent. Reusing them avoids a vertex scan for each
    // animated link endpoint on every frame.
    let minX = gene.bounds?.minX;
    let maxX = gene.bounds?.maxX;
    // Retain support for compact third-party scenes that only expose a
    // polygon. Production scenes always take the cached-bounds path above.
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      minX = Infinity;
      maxX = -Infinity;
      for (let index = 0; index < gene.polygon.length; index += 2) {
        minX = Math.min(minX, gene.polygon[index]);
        maxX = Math.max(maxX, gene.polygon[index]);
      }
    }
    minX += offsets.x;
    maxX += offsets.x;
    const forward = gene.display.strand === 1;
    const axis = flipAxisForGene(preview, gene);
    if (axis === undefined) {
      return [
        forward ? minX : maxX,
        forward ? maxX : minX,
        gene.locus.y + gene.locus.track.y + offsets.y,
      ];
    }
    const progress = preview.progress;
    const targetMin = axis * 2 - maxX;
    const targetMax = axis * 2 - minX;
    const from = forward ? [minX, maxX] : [maxX, minX];
    const to = forward ? [targetMax, targetMin] : [targetMin, targetMax];
    return [
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
      gene.locus.y + gene.locus.track.y + offsets.y,
    ];
  };
  const queryAnchor = anchorForGene(query);
  const targetAnchor = anchorForGene(target);
  return queryAnchor[2] <= targetAnchor[2]
    ? [...queryAnchor, ...targetAnchor]
    : [...targetAnchor, ...queryAnchor];
}

function linkGeometryForPreview(scene, link, preview, config) {
  const visible = linkVisibleForPreview(scene, link, preview, config);
  if (preview?.type === "cluster-drag" || preview?.type === "locus-flip") {
    const query = scene.genes.get(link.source.query.uid);
    const target = scene.genes.get(link.source.target.uid);
    const affected = preview.type === "cluster-drag" ||
      query?.locus?.source?.uid === preview.locusUid ||
      target?.locus?.source?.uid === preview.locusUid;
    return { visible, anchors: visible && affected ? previewLinkAnchors(scene, link, preview) : link.anchors };
  }
  return { ...linkOffsetsForPreview(scene, link, preview), visible };
}

function linkVisibleForPreview(scene, link, preview, config) {
  if (!preview) return link.visible;
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return false;
  if (!geneVisibleForPreview(preview, query) || !geneVisibleForPreview(preview, target)) return false;
  if (preview?.type === "locus-trim") {
    return link.allowed && !link.source.hidden && link.source.identity >= config.link.threshold;
  }
  if (preview?.type !== "cluster-drag") return link.visible;
  const queryOrder = preview.clusterOrder.get(query.locus.cluster.uid);
  const targetOrder = preview.clusterOrder.get(target.locus.cluster.uid);
  return (
    queryOrder !== undefined &&
    targetOrder !== undefined &&
    Math.abs(queryOrder - targetOrder) === 1 &&
    link.allowed &&
    link.source.identity >= config.link.threshold
  );
}


function recordsForPreview(scene, preview, { includeClusters = false } = {}) {
  if (!preview) return null;
  if (preview.type === "cluster-drag" && !includeClusters) {
    return {
      // Genes, tracks, and instanced link ribbons all resolve their row
      // offsets on the GPU, leaving only a compact visible-link index list to
      // upload while the pointer moves.
      loci: new Set(),
      genes: new Set(),
      links: new Set(),
      full: false,
      clusterOffsets: true,
    };
  }
  const loci = new Set();
  if (preview.type === "cluster-drag") {
    for (const locus of scene.loci.values()) {
      if (clusterOffsetForPreview(preview, locus.cluster.uid)) loci.add(locus.source.uid);
    }
  }
  if (preview.type === "locus-offset") loci.add(preview.locusUid);
  if (preview.type === "locus-offsets") {
    for (const locusUid of preview.locusOffsets.keys()) loci.add(locusUid);
  }
  if (preview.type === "locus-flip") loci.add(preview.locusUid);
  if (preview.type === "locus-trim") {
    const trimmed = scene.loci.get(preview.locusUid);
    const clusterUid = trimmed?.cluster.uid;
    // getLocusScaleValues packs loci independently within each cluster. A
    // trim can therefore shift every sibling locus even when its individual
    // offset happens to be zero in a particular preview frame.
    for (const locus of scene.loci.values()) {
      if (locus.cluster.uid === clusterUid) loci.add(locus.source.uid);
    }
  }
  const genes = new Set();
  for (const uid of loci) {
    for (const gene of scene.loci.get(uid)?.genes || []) genes.add(gene.source.uid);
  }
  const links = new Set();
  if (scene.linksByGene) {
    for (const uid of genes) {
      for (const link of scene.linksByGene.get(uid) || []) links.add(link.uid);
    }
  } else {
    for (const link of scene.links.values()) {
      if (genes.has(link.source.query.uid) || genes.has(link.source.target.uid)) links.add(link.source.uid);
    }
  }
  return { loci, genes, links, full: false };
}


function genePolygonForPreview(preview, gene, { includeClusterOffset = true } = {}) {
  const { x, y } = previewOffsetsForLocus(preview, gene.locus);
  // Retained GPU vertices and SVG children apply cluster rows at their parent.
  const bakedY = includeClusterOffset ? y : 0;
  const axis = preview?.type === "locus-flip"
    ? preview.axes?.get(gene.locus.source.uid)
    : undefined;
  if (!x && !y && axis === undefined) return gene.polygon;
  const scale = axis === undefined ? 1 : 1 - 2 * preview.progress;
  return gene.polygon.map((coordinate, index) =>
    index % 2
      ? coordinate + bakedY
      : (axis === undefined ? coordinate : axis + (coordinate - axis) * scale) + x
  );
}

/** Visible preview rows and their adjacent cluster pairs, shared by raster backends. */
function clusterPreviewInViewport(scene, preview, viewport, { includeLinks = true } = {}) {
  const clusters = [...scene.clusters.values()].filter((cluster) => boundsInViewport(
    cluster.bounds, viewport, { y: clusterOffsetForPreview(preview, cluster.source.uid) }
  ));
  const pairs = new Set();
  if (includeLinks) {
    const clusterUidByOrder = new Map([...preview.clusterOrder].map(([uid, order]) => [order, uid]));
    for (const cluster of clusters) {
      const order = preview.clusterOrder.get(cluster.source.uid);
      for (const neighbourOrder of [order - 1, order + 1]) {
        const neighbour = clusterUidByOrder.get(neighbourOrder);
        if (neighbour !== undefined) pairs.add(clusterPairKey(cluster.source.uid, neighbour));
      }
    }
  }
  return { clusters, pairs };
}

const TREE_COLOURING_DEFAULTS = {
  mode: "none",
  cutHeight: "auto",
  palette: ["#267c9e", "#d7752d", "#5c8f39", "#9963a5", "#c34d61", "#9e8433"],
  showCutLine: false,
};
const metricsCache = new WeakMap();
const stylesCache = new WeakMap();
const fail$2 = (message) => { throw new TypeError(`Invalid tree presentation: ${message}`); };
const object$1 = (value) => value && typeof value === "object" && !Array.isArray(value);
const own$1 = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function fields$1(value, allowed, where) {
  if (!object$1(value)) fail$2(`${where} must be an object.`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail$2(`${where}.${key} is unsupported.`);
}
function colour(value, where) {
  if (typeof value !== "string" || !color(value)) fail$2(`${where} must be a valid colour.`);
}
function positive(value, where) {
  if (!Number.isFinite(value) || value <= 0) fail$2(`${where} must be finite and positive.`);
}
function validateTreeColouring(policy) {
  if (policy === undefined) return;
  fields$1(policy, ["mode", "cutHeight", "palette", "showCutLine"], "colouring");
  if (own$1(policy, "mode") && !["none", "cutHeight"].includes(policy.mode)) fail$2("colouring.mode must be none or cutHeight.");
  if (own$1(policy, "cutHeight") && policy.cutHeight !== "auto" && (!Number.isFinite(policy.cutHeight) || policy.cutHeight < 0)) {
    fail$2('colouring.cutHeight must be "auto" or a finite non-negative number.');
  }
  if (own$1(policy, "showCutLine") && typeof policy.showCutLine !== "boolean") fail$2("colouring.showCutLine must be boolean.");
  if (own$1(policy, "palette")) {
    if (!Array.isArray(policy.palette) || !policy.palette.length) fail$2("colouring.palette must be a non-empty colour array.");
    policy.palette.forEach((entry) => colour(entry, "colouring.palette"));
  }
}

/** Biological distances and canonical ID order survive child rotation unchanged. */
function treeMetrics(tree) {
  if (metricsCache.has(tree)) return metricsCache.get(tree);
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const parents = new Map();
  const distances = new Map([[tree.root, 0]]);
  let complete = true;
  const visit = (uid) => {
    for (const child of nodes.get(uid).children || []) {
      const length = nodes.get(child).branchLength;
      if (!Number.isFinite(length) || length < 0) complete = false;
      parents.set(child, uid);
      distances.set(child, distances.get(uid) + (Number.isFinite(length) ? length : 0));
      visit(child);
    }
  };
  visit(tree.root);
  const tips = tree.nodes.filter((node) => !node.children);
  const height = Math.max(0, ...tips.map((node) => distances.get(node.uid)));
  // Absolute 1e-12 plus relative 1e-9 tolerance, measured in input distance units.
  const tolerance = 1e-12 + 1e-9 * height;
  const ultrametric = complete && tips.every((node) => Math.abs(distances.get(node.uid) - height) <= tolerance);
  const result = {
    nodes, parents, height, ultrametric,
    heights: new Map([...distances].map(([uid, distance]) => [uid, Math.max(0, height - distance)])),
    canonical: [...tree.nodes].sort((a, b) => a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0),
  };
  metricsCache.set(tree, result);
  return result;
}

function validateBranch(style, where) {
  fields$1(style, ["colour", "width"], where);
  if (own$1(style, "colour")) colour(style.colour, `${where}.colour`);
  if (own$1(style, "width")) positive(style.width, `${where}.width`);
}

/** Validate optional data fields and the effective tree/config colouring policy. */
function validateTreePresentation(tree, config = {}) {
  validateTreeColouring(config.colouring);
  if (!tree) return;
  if (tree.distance !== undefined) {
    fields$1(tree.distance, ["kind", "label"], "distance");
    if (tree.distance.kind !== "mergeHeight") fail$2("distance.kind must be mergeHeight.");
    if (own$1(tree.distance, "label") && typeof tree.distance.label !== "string") fail$2("distance.label must be text.");
  }
  const presentation = tree.presentation;
  if (presentation !== undefined) {
    fields$1(presentation, ["colouring", "subtrees", "nodes"], "presentation");
    validateTreeColouring(presentation.colouring);
    const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
    for (const scope of ["subtrees", "nodes"]) {
      if (presentation[scope] === undefined) continue;
      if (!object$1(presentation[scope])) fail$2(`presentation.${scope} must be a node-ID dictionary.`);
      for (const [uid, record] of Object.entries(presentation[scope])) {
        const node = nodes.get(uid);
        if (!node) fail$2(`presentation.${scope} refers to unknown node '${uid}'.`);
        fields$1(record, scope === "subtrees" ? ["branch"] : ["branch", "label"], `${scope}.${uid}`);
        if (scope === "subtrees" && !node.children) fail$2(`subtree '${uid}' must be an internal node.`);
        if (record.branch !== undefined) {
          if (scope === "nodes" && uid === tree.root) fail$2("the display root has no incoming edge to style.");
          validateBranch(record.branch, `${scope}.${uid}.branch`);
        }
        if (record.label !== undefined) {
          if (!node.children) fail$2(`annotation '${uid}' must belong to an internal node.`);
          const label = record.label;
          fields$1(label, ["text", "colour", "fontSize", "fontWeight", "fontStyle"], `nodes.${uid}.label`);
          if (own$1(label, "text") && typeof label.text !== "string") fail$2(`annotation '${uid}' text must be a string.`);
          if (own$1(label, "colour")) colour(label.colour, `annotation '${uid}' colour`);
          if (own$1(label, "fontSize")) positive(label.fontSize, `annotation '${uid}' fontSize`);
          if (own$1(label, "fontWeight") && ![400, 700].includes(label.fontWeight)) fail$2("annotation fontWeight must be 400 or 700.");
          if (own$1(label, "fontStyle") && !["normal", "italic"].includes(label.fontStyle)) fail$2("annotation fontStyle must be normal or italic.");
        }
      }
    }
  }
  const policy = { ...TREE_COLOURING_DEFAULTS, ...config.colouring, ...presentation?.colouring };
  if (policy.mode === "cutHeight") {
    if (tree.distance?.kind !== "mergeHeight") fail$2("cutHeight colouring requires distance.kind = mergeHeight.");
    if (!treeMetrics(tree).ultrametric) fail$2("cutHeight colouring requires complete lengths and equal root-to-tip distances (absolute 1e-12 + relative 1e-9 tolerance).");
  }
}

function invalidateTreePresentation(tree) {
  if (tree) stylesCache.delete(tree);
}

/** Resolve properties once per presentation/config revision, never per tween. */
function resolveTreePresentation(tree, config = {}) {
  const defaults = { ...TREE_COLOURING_DEFAULTS, ...config.colouring };
  const signature = JSON.stringify([config.branch?.colour, config.branch?.width, config.textColour, defaults]);
  const cached = stylesCache.get(tree);
  if (cached && cached.presentation === tree.presentation && cached.signature === signature) return cached.value;
  validateTreePresentation(tree, config);
  const metrics = treeMetrics(tree);
  const policy = { ...defaults, ...tree.presentation?.colouring };
  const threshold = policy.cutHeight === "auto" ? metrics.height * 0.7 : policy.cutHeight;
  const groups = new Map();
  if (policy.mode === "cutHeight" && threshold > 0) {
    for (const node of metrics.canonical) {
      if (!node.children || metrics.heights.get(node.uid) >= threshold) continue;
      const parent = metrics.parents.get(node.uid);
      if (parent === undefined || metrics.heights.get(parent) >= threshold) {
        groups.set(node.uid, policy.palette[groups.size % policy.palette.length]);
      }
    }
  }
  const base = { colour: config.branch?.colour || "#555", width: Number(config.branch?.width) || 1.5 };
  const branches = new Map();
  const stems = new Map();
  const annotations = new Map();
  const visit = (uid, inherited = {}, groupColour = null) => {
    const node = metrics.nodes.get(uid);
    const automatic = groups.get(uid) || groupColour;
    const subtree = { ...inherited, ...tree.presentation?.subtrees?.[uid]?.branch };
    const mergeStyle = { ...base, ...(automatic ? { colour: automatic } : {}), ...subtree };
    if (node.children) stems.set(uid, mergeStyle);
    const label = tree.presentation?.nodes?.[uid]?.label;
    if (label?.text) annotations.set(uid, { colour: config.textColour || "#333", fontSize: 10, fontWeight: 400, fontStyle: "normal", ...label });
    for (const child of node.children || []) {
      branches.set(child, { ...mergeStyle, ...tree.presentation?.nodes?.[child]?.branch });
      visit(child, subtree, automatic);
    }
  };
  visit(tree.root);
  const value = { base, branches, stems, annotations, policy, height: metrics.height, threshold, metric: policy.mode === "cutHeight" };
  stylesCache.set(tree, { presentation: tree.presentation, signature, value });
  return value;
}

const leafXAnchors = new WeakMap();

/** Return whether an order keeps every tree clade contiguous. */
function isTreeOrderCompatible(tree, order) {
  if (!tree) return true;
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const positions = new Map(order.map((clusterUid, index) => [clusterUid, index]));
  const descendants = new Map();
  const collect = (uid) => {
    if (descendants.has(uid)) return descendants.get(uid);
    const node = nodes.get(uid);
    if (!node) return [];
    const clusters = node.children?.length
      ? node.children.flatMap(collect)
      : [node.cluster];
    descendants.set(uid, clusters);
    return clusters;
  };
  for (const node of tree.nodes) {
    const clusters = collect(node.uid);
    if (!clusters.length || clusters.some((uid) => !positions.has(uid))) return false;
    const indices = clusters.map((uid) => positions.get(uid));
    if (Math.max(...indices) - Math.min(...indices) + 1 !== indices.length) return false;
  }
  return order.length === positions.size && positions.size === descendants.get(tree.root)?.length;
}

/** Keep the tree in its base position until a dragged label reaches a leaf. */
function treeLeafX(tree, proposedX, dragging = false) {
  if (!tree || typeof tree !== "object") return proposedX;
  if (!dragging || !leafXAnchors.has(tree)) leafXAnchors.set(tree, proposedX);
  return Math.min(proposedX, leafXAnchors.get(tree));
}

function niceScaleValue(maxDistance) {
  const target = maxDistance / 4;
  const power = 10 ** Math.floor(Math.log10(target));
  const fraction = target / power;
  const multiplier = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
  const value = multiplier * power;
  return { value, label: String(Number(value.toPrecision(2))) };
}

/** Lay out branch x positions using lengths when every edge has one. */
function treeHorizontalLayout(tree, leafX, width, useBranchLengths = true) {
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const distances = new Map([[tree.root, 0]]);
  const depths = new Map([[tree.root, 0]]);
  const visit = (uid) => {
    const node = nodes.get(uid);
    for (const childUid of node.children || []) {
      const child = nodes.get(childUid);
      distances.set(childUid, distances.get(uid) + (Number(child.branchLength) || 0));
      depths.set(childUid, depths.get(uid) + 1);
      visit(childUid);
    }
  };
  visit(tree.root);
  const maxDepth = Math.max(...depths.values());
  const maxDistance = Math.max(...tree.nodes
    .filter((node) => !node.children)
    .map((node) => distances.get(node.uid) || 0));
  const completeLengths = tree.nodes
    .filter((node) => node.uid !== tree.root)
    .every((node) => Number.isFinite(node.branchLength));
  const proportional = useBranchLengths && completeLengths && maxDistance > 0;
  const leftX = leafX - width;
  const xs = new Map();
  for (const node of tree.nodes) {
    const position = proportional
      ? (distances.get(node.uid) / maxDistance) * width
      : (depths.get(node.uid) / Math.max(1, maxDepth)) * width;
    xs.set(node.uid, leftX + position);
  }
  if (proportional) {
    const scale = niceScaleValue(maxDistance);
    return {
      xs,
      maxDepth,
      maxDistance,
      proportional,
      scaleBarLength: (scale.value / maxDistance) * width,
      scaleBarLabel: scale.label,
    };
  }
  return {
    xs,
    maxDepth,
    maxDistance,
    proportional,
    scaleBarLength: width / Math.max(1, maxDepth),
    scaleBarLabel: "1 branch",
  };
}

/** Place the tree as far right as possible without leaf tips reaching labels. */
function treeLeafAnchorX(tree, labelStarts, width, relative, clearance = 16) {
  if (!tree || !labelStarts?.size) return 0;
  let anchor = Infinity;
  for (const node of tree.nodes) {
    if (node.children?.length) continue;
    const labelStart = labelStarts.get(node.cluster);
    if (!Number.isFinite(labelStart)) continue;
    anchor = Math.min(anchor, labelStart - clearance + width - relative.get(node.uid));
  }
  return Number.isFinite(anchor) ? anchor : 0;
}

function treeNodeYPositions(tree, scene, leafY = (node, sourceScene) =>
  sourceScene.clusters.get(node.cluster)?.y ?? 0
) {
  if (!tree || !scene) return new Map();
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const positions = new Map();
  const yFor = (uid) => {
    if (positions.has(uid)) return positions.get(uid);
    const node = nodes.get(uid);
    const children = (node.children || []).map(yFor);
    const y = children.length
      ? (Math.min(...children) + Math.max(...children)) / 2
      : leafY(node, scene);
    positions.set(uid, y);
    return y;
  };
  yFor(tree.root);
  return positions;
}

/**
 * Build renderer-neutral tree marks after the adapter has measured labels.
 * scene supplies displayed label positions; targetScene supplies final row
 * positions during a retained-scene animation. Keeping these separate prevents
 * an interpolated scene from applying the tree motion a second time.
 */
function layoutTree({
  tree,
  scene,
  config,
  measureLabel,
  measureText = (text, style) => ({ width: text.length * style.fontSize * 0.6, height: style.fontSize }),
  preview = null,
  previousTree = null,
  previousScene = null,
  targetScene = scene,
  dragging = preview?.type === "cluster-drag",
  trackAnchor = true,
}) {
  if (!tree || !config.tree?.show || !scene?.clusters.size) return null;
  const labelStarts = new Map();
  for (const cluster of scene.clusters.values()) {
    const uid = cluster.source.uid;
    const text = clusterLabelTextForPreview(preview, uid, cluster.info.locusText || "");
    labelStarts.set(uid, cluster.x + cluster.info.x +
      clusterLabelOffsetForPreview(preview, uid) - measureLabel(cluster, text));
  }
  const width = Number(config.tree.width) || 100;
  const horizontal = treeHorizontalLayout(tree, width, width, config.tree.useBranchLengths !== false);
  const leafY = (node, sourceScene) =>
    (sourceScene.clusters.get(node.cluster)?.y ?? 0) +
    config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2 +
    clusterOffsetForPreview(preview, node.cluster);
  const ys = treeNodeYPositions(tree, targetScene, leafY);
  const previousYs = previousTree && previousScene
    ? treeNodeYPositions(previousTree, previousScene, leafY)
    : null;
  const presentation = resolveTreePresentation(tree, config.tree);
  const branch = presentation.base;
  const annotations = [...presentation.annotations].map(([uid, style]) => {
    const font = { ...style, fontFamily: config.plot.fontFamily };
    return { uid, ...font, ...measureText(style.text, font), x: horizontal.xs.get(uid) + 6, y: ys.get(uid) + 6 };
  });
  let proposedX = treeLeafAnchorX(tree, labelStarts, width, horizontal.xs);
  const rows = [...scene.clusters.values()].map((cluster) => {
    const y = cluster.y + clusterOffsetForPreview(preview, cluster.source.uid);
    return { top: y + 8 - (config.cluster?.nameFontSize ?? 12), bottom: y + 12 + (config.cluster?.lociFontSize ?? 10), start: labelStarts.get(cluster.source.uid) };
  }).sort((a, b) => a.top - b.top);
  for (const label of annotations) {
    let low = 0, high = rows.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (rows[middle].bottom < label.y) low = middle + 1;
      else high = middle;
    }
    for (let index = low; index < rows.length; index++) {
      const row = rows[index];
      if (row.top > label.y + label.height) break;
      if (row.bottom >= label.y) proposedX = Math.min(proposedX, row.start - 16 + width - label.x - label.width);
    }
  }
  const leafX = trackAnchor ? treeLeafX(tree, proposedX, dragging) : proposedX;
  const xs = new Map([...horizontal.xs].map(([uid, x]) => [uid, x + leafX - width]));
  for (const label of annotations) label.x += leafX - width;
  const guide = {
    colour: config.tree.leafGuide?.colour || "#999",
    width: Number(config.tree.leafGuide?.width) || 1,
    dash: String(config.tree.leafGuide?.dash || "4 3").split(/[ ,]+/).map(Number).filter(Number.isFinite),
  };
  const support = {
    fontSize: Number(config.tree.support?.fontSize) || 9,
    fontFamily: config.plot.fontFamily,
    colour: branch.colour,
  };
  const rootX = xs.get(tree.root);
  const branches = [];
  const stems = [];
  const nodes = [];
  const guides = [];
  const supports = [];
  for (const node of tree.nodes) {
    const x = xs.get(node.uid);
    if (node.children?.length) {
      nodes.push({ uid: node.uid, x, radius: 4, hitRadius: 10 });
      // Stems and horizontal edges are separate marks. Square stem caps fill
      // the outer corners without extending leaf tips or changing distances.
      if (node.children.length > 1) stems.push({ uid: node.uid, x1: x, x2: x, children: node.children, style: presentation.stems.get(node.uid), lineCap: "square" });
      for (const child of node.children) {
        branches.push({ uid: `${node.uid}:${child}`, nodeUid: child, x1: x, x2: xs.get(child), style: presentation.branches.get(child) });
      }
    } else if (config.tree.leafGuide?.show && Number.isFinite(labelStarts.get(node.cluster))) {
      guides.push({ uid: node.uid, nodeUid: node.uid, x1: x, x2: labelStarts.get(node.cluster) });
    }
    if (node.uid !== tree.root && config.tree.support?.show && node.support) {
      const text = Number(node.support.value).toFixed(config.tree.support.precision ?? 1);
      supports.push({
        uid: node.uid,
        x: x - 4,
        text, ...measureText(text, support),
      });
    }
  }
  let scaleBar = null;
  if (config.tree.scaleBar?.show !== false) {
    const style = scene.chrome?.scaleBar || config.scaleBar || {};
    const height = Number(style.height) || 12;
    const length = horizontal.scaleBarLength;
    const y = scene.chrome?.scaleBar?.position?.y ??
      Math.max(...[...scene.clusters.values()].map((cluster) => cluster.y)) +
        config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight + 20;
    scaleBar = {
      colour: style.colour || "black",
      strokeWidth: Number(style.strokeWidth ?? style.stroke) || 1,
      fontSize: Number(style.fontSize) || 10,
      fontFamily: style.fontFamily || config.plot.fontFamily,
      lines: [
        { x1: rootX, y1: y + height / 2, x2: rootX + length, y2: y + height / 2 },
        { x1: rootX, y1: y, x2: rootX, y2: y + height },
        { x1: rootX + length, y1: y, x2: rootX + length, y2: y + height },
      ],
      label: { x: rootX + length / 2, y: y + height + 5, text: config.tree.scaleBar?.label || horizontal.scaleBarLabel },
    };
    // SVG scale labels use points; Canvas uses pixels. Measure the larger
    // size for a common envelope without changing either renderer's drawing.
    Object.assign(scaleBar.label, measureText(scaleBar.label.text, { ...scaleBar, fontSize: scaleBar.fontSize * 4 / 3 }));
  }
  let cutLine = null;
  if (presentation.metric && presentation.policy.showCutLine && horizontal.proportional &&
      presentation.threshold <= presentation.height && presentation.height > 0) {
    const x = rootX + width * (1 - presentation.threshold / presentation.height);
    const leafYs = tree.nodes.filter((node) => !node.children).map((node) => ys.get(node.uid));
    cutLine = {
      x1: x, x2: x, y1: Math.min(...leafYs), y2: Math.max(...leafYs),
      colour: branch.colour, width: 1,
      label: { x, y: Math.min(...leafYs) - 8, text: String(Number(presentation.threshold.toPrecision(6))), fontSize: support.fontSize, fontFamily: support.fontFamily },
    };
    Object.assign(cutLine.label, measureText(cutLine.label.text, cutLine.label));
  }
  return positionTreeLayout({
    background: config.figureStyle?.background || "white", foreground: config.figureStyle?.foreground || "black",
    cutLine, annotations, branch, guide, support, branches, stems, nodes, guides, supports, scaleBar,
    rootBranch: { uid: "root-stub", nodeUid: tree.root, x1: rootX - 28, x2: rootX, style: branch },
    ys, previousYs,
  }, ys);
}

function positionTreeLayout(layout, ys) {
  const line = (mark) => ({ ...mark, y1: ys.get(mark.nodeUid), y2: ys.get(mark.nodeUid) });
  const frame = {
    ...layout,
    rootBranch: line(layout.rootBranch),
    branches: layout.branches.map(line),
    stems: layout.stems.map((stem) => ({
      ...stem,
      y1: Math.min(...stem.children.map((uid) => ys.get(uid))),
      y2: Math.max(...stem.children.map((uid) => ys.get(uid))),
    })),
    nodes: layout.nodes.map((node) => ({ ...node, y: ys.get(node.uid) })),
    guides: layout.guides.map(line),
    supports: layout.supports.map((label) => ({ ...label, y: ys.get(label.uid) - 4 })),
    annotations: layout.annotations.map((label) => ({ ...label, y: ys.get(label.uid) + 6 })),
  };
  const points = [];
  const includeLine = (mark, width = mark.style?.width || 1) => {
    const half = width / 2;
    const extendX = mark.x1 === mark.x2 || mark.lineCap === "square" ? half : 0;
    const extendY = mark.y1 === mark.y2 || mark.lineCap === "square" ? half : 0;
    points.push([Math.min(mark.x1, mark.x2) - extendX, Math.min(mark.y1, mark.y2) - extendY],
      [Math.max(mark.x1, mark.x2) + extendX, Math.max(mark.y1, mark.y2) + extendY]);
  };
  for (const mark of [frame.rootBranch, ...frame.branches, ...frame.stems]) includeLine(mark);
  for (const mark of frame.guides) includeLine(mark, frame.guide.width);
  for (const node of frame.nodes) {
    const radius = node.radius + frame.branch.width / 2;
    points.push([node.x - radius, node.y - radius], [node.x + radius, node.y + radius]);
  }
  for (const label of frame.annotations) points.push([label.x - (label.overhang || 0), label.y], [label.x + label.width, label.y + label.height]);
  for (const label of frame.supports) points.push([label.x - label.width, label.y - label.height], [label.x + (label.overhang || 0), label.y]);
  if (frame.cutLine) {
    includeLine(frame.cutLine, frame.cutLine.width);
    const label = frame.cutLine.label;
    points.push([label.x - label.width / 2, label.y - label.height], [label.x + label.width / 2, label.y]);
  }
  if (frame.scaleBar) {
    for (const mark of frame.scaleBar.lines) includeLine(mark, frame.scaleBar.strokeWidth);
    const label = frame.scaleBar.label;
    points.push([label.x - label.width / 2, label.y], [label.x + label.width / 2, label.y + label.height]);
  }
  frame.bounds = {
    minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)),
  };
  return frame;
}

/** Interpolate node identities, then rebuild stems so swapped branches fold. */
function interpolateTreeLayout(layout, progress = 1) {
  if (!layout?.previousYs || progress >= 1) return layout;
  const ys = new Map();
  for (const [uid, target] of layout.ys) {
    const from = layout.previousYs.get(uid) ?? target;
    ys.set(uid, from + (target - from) * progress);
  }
  return positionTreeLayout(layout, ys);
}

function hitTestTreeNode(layout, point) {
  for (const node of layout?.nodes || []) {
    if (Math.hypot(point.x - node.x, point.y - node.y) <= node.hitRadius) {
      return { action: "tree-node", nodeUid: node.uid };
    }
  }
  return null;
}

function removeMissing(records, allowed) {
  for (const uid of records.keys()) if (!allowed.has(uid)) records.delete(uid);
}

function createChartState(data, previous = null) {
  const loci = previous?.loci || new Map();
  const genes = previous?.genes || new Map();
  const clusterOffsets = previous?.clusterOffsets || new Map();
  const locusOffsets = previous?.locusOffsets || new Map();
  const camera = previous?.camera || { x: 0, y: 0, k: 1 };
  const dragging = previous?.dragging || false;
  const preview = previous?.preview || {
    clusterOrder: null,
    clusterPositions: new Map(),
    locusOffsets: new Map(),
    loci: new Map(),
  };
  const clusterIds = data.clusters.map((cluster) => cluster.uid);
  const clusterIdSet = new Set(clusterIds);
  const previousOrder = previous?.clusterOrder || [];
  const previousOrderSet = new Set(previousOrder);
  const clusterOrder = data.tree ? treeClusterOrder(data.tree) : [
    ...previousOrder.filter((uid) => clusterIdSet.has(uid)),
    ...clusterIds.filter((uid) => !previousOrderSet.has(uid)),
  ];
  if (preview.clusterOrder) {
    const previewOrderSet = new Set(preview.clusterOrder);
    preview.clusterOrder = [
      ...preview.clusterOrder.filter((uid) => clusterIdSet.has(uid)),
      ...clusterIds.filter((uid) => !previewOrderSet.has(uid)),
    ];
  }
  if (!preview.locusOffsets) preview.locusOffsets = new Map();
  if (!preview.loci) preview.loci = new Map();
  if (!preview.clusterPositions) preview.clusterPositions = new Map();
  const locusIds = new Set();
  const geneKeys = new Set();
  for (const cluster of data.clusters) {
    if (!clusterOffsets.has(cluster.uid)) clusterOffsets.set(cluster.uid, 0);
    for (const locus of cluster.loci) {
      locusIds.add(locus.uid);
      if (!loci.has(locus.uid)) {
        loci.set(locus.uid, {
          start: locus.start,
          end: locus.end,
          flipped: false,
          trimLeft: null,
          trimRight: null,
        });
      }
      for (const gene of locus.genes) {
        const geneBio = gene.bio || {
          start: gene.start,
          end: gene.end,
          strand: gene.strand,
        };
        const locusBio = locus.bio || { start: locus.start, end: locus.end };
        const key = `${locus.uid}:${gene.uid}`;
        geneKeys.add(key);
        if (!genes.has(key)) {
          genes.set(key, {
            start: geneBio.start - locusBio.start,
            end: geneBio.end - locusBio.start,
            strand: geneBio.strand,
          });
        }
      }
    }
  }
  removeMissing(loci, locusIds);
  removeMissing(genes, geneKeys);
  removeMissing(clusterOffsets, clusterIdSet);
  removeMissing(locusOffsets, locusIds);
  removeMissing(preview.locusOffsets, locusIds);
  removeMissing(preview.clusterPositions, clusterIdSet);
  removeMissing(preview.loci, locusIds);
  return { loci, genes, clusterOffsets, locusOffsets, clusterOrder, camera, dragging, preview };
}

function treeClusterOrder(tree) {
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const result = [];
  const visit = (uid) => {
    const node = nodes.get(uid);
    if (node.children) node.children.forEach(visit);
    else result.push(node.cluster);
  };
  visit(tree.root);
  return result;
}

/** Commit a compatible display order to the tree's ordered child arrays. */
function setTreeClusterOrder(tree, order) {
  if (!tree) return;
  if (!isTreeOrderCompatible(tree, order)) {
    throw new TypeError("Cluster order must keep every tree clade contiguous.");
  }
  const positions = new Map(order.map((uid, index) => [uid, index]));
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const firstPosition = (uid) => {
    const node = nodes.get(uid);
    if (!node.children) return positions.get(node.cluster);
    const first = new Map(node.children.map((child) => [child, firstPosition(child)]));
    node.children.sort((a, b) => first.get(a) - first.get(b));
    return first.get(node.children[0]);
  };
  firstPosition(tree.root);
}

function isDragging(chartState) {
  return chartState.dragging;
}

function setDragging(chartState, dragging) {
  chartState.dragging = dragging;
}

function getClusterOrder(chartState) {
  return chartState.preview.clusterOrder || chartState.clusterOrder;
}

function setPreviewClusterOrder(chartState, order) {
  chartState.preview.clusterOrder = [...order];
}

function getClusterPosition(chartState, uid, fallback) {
  return chartState.preview.clusterPositions.get(uid) ?? fallback;
}

function setPreviewClusterPosition(chartState, uid, position) {
  chartState.preview.clusterPositions.set(uid, position);
}

function commitPreviewClusterOrder(chartState) {
  if (chartState.preview.clusterOrder) {
    chartState.clusterOrder = chartState.preview.clusterOrder;
    chartState.preview.clusterOrder = null;
  }
  chartState.preview.clusterPositions.clear();
  return chartState.clusterOrder;
}

function getClusterOffset(chartState, uid) {
  return chartState.clusterOffsets.get(uid) ?? 0;
}

function setClusterOffset(chartState, uid, offset) {
  chartState.clusterOffsets.set(uid, offset);
}

function getLocusOffset(chartState, uid) {
  return chartState.preview.locusOffsets.get(uid) ?? getCommittedLocusOffset(chartState, uid);
}

function getCommittedLocusOffset(chartState, uid) {
  return chartState.locusOffsets.get(uid) ?? 0;
}

function setLocusOffset(chartState, uid, offset) {
  chartState.locusOffsets.set(uid, offset);
}

function setPreviewLocusOffset(chartState, uid, offset) {
  chartState.preview.locusOffsets.set(uid, offset);
}

function commitPreviewLocusOffset(chartState, uid) {
  const offset = chartState.preview.locusOffsets.get(uid);
  if (offset !== undefined) {
    chartState.locusOffsets.set(uid, offset);
    chartState.preview.locusOffsets.delete(uid);
  }
  return getCommittedLocusOffset(chartState, uid);
}

function initializeLocusOffsets(chartState, defaults) {
  for (const [uid, offset] of defaults) {
    if (!chartState.locusOffsets.has(uid)) chartState.locusOffsets.set(uid, offset);
  }
}

function getCamera(chartState) {
  return chartState.camera;
}

function setCamera(chartState, { x, y, k }) {
  chartState.camera = { x, y, k };
}

function getLocusState(chartState, locus) {
  return chartState.preview.loci.get(locus.uid) || chartState.loci.get(locus.uid);
}

function getGeneState(chartState, gene) {
  return chartState.genes.get(`${gene.locusUid}:${gene.uid}`);
}

function formatLocusText(loci, chartState, hideCoordinates) {
  return loci
    .map((locus) => {
      let start;
      let end;

      const state = getLocusState(chartState, locus);
      if (locus.bio) {
        let startDiff = state.start - locus.start;
        let endDiff = locus.end - state.end;
        if (state.flipped) [startDiff, endDiff] = [endDiff, startDiff];
        start = locus.bio.start + startDiff + 1;
        end = locus.bio.end - endDiff;
      } else {
        start = state.start + 1;
        end = state.end;
      }

      if (state.flipped) [start, end] = [end, start];

      const reversed = state.flipped ? " (reversed)" : "";
      if (hideCoordinates || state.start == null || state.end == null)
        return `${locus.name}${reversed}`;
      return `${locus.name}${reversed}:${start.toFixed(0)}-${end.toFixed(0)}`;
    })
    .join(", ");
}

/**
 * Synchronize derived display coordinates after a trim, flip, or a change to
 * unscaled-gene mode. This is state work: it deliberately does not depend on
 * a renderer or a D3 scale.
 */
function synchronizeLocusState(chartState, locus, scaleGenes) {
  locus.genes.forEach((gene, index, genes) => {
    const state = getGeneState(chartState, gene);
    const length = scaleGenes ? state.end - state.start : 1000;
    state.start = scaleGenes
      ? state.start
      : index > 0
      ? getGeneState(chartState, genes[index - 1]).end
      : 0;
    state.end = state.start + length;
  });

  const state = getLocusState(chartState, locus);
  const oldStart = state.start;
  const lastGene = locus.genes[locus.genes.length - 1];
  state.start = state.trimLeft
    ? getGeneState(chartState, state.trimLeft).start
    : 0;
  state.end = state.trimRight
    ? getGeneState(chartState, state.trimRight).end
    : scaleGenes
    ? locus.end
    : lastGene.end;

  return { oldStart };
}

function boundaryIndex(values, target, edge) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  if (edge === "left") return Math.min(low, values.length - 1);
  if (low === 0) return 0;
  if (low === values.length) return values.length - 1;
  return target - values[low - 1] <= values[low] - target ? low - 1 : low;
}

/**
 * Apply a trim at the display boundary under a resize handle. The left handle
 * rounds forward to a gene start; the right handle selects the nearest gene
 * end, matching the drawn gene geometry.
 * `coordinateFor` is supplied by the caller, keeping the state transition
 * independent of D3 scales and any particular renderer.
 */
function trimLocus(chartState, locus, {
  edge,
  position,
  coordinateFor,
  scaleGenes,
}) {
  const state = getLocusState(chartState, locus);
  const genes = [...locus.genes].sort(
    (left, right) =>
      getGeneState(chartState, left).start - getGeneState(chartState, right).start
  );

  if (edge === "left") {
    const visible = genes.filter(
      (gene) => getGeneState(chartState, gene).end <= state.end
    );
    const boundaries = [
      locus.start,
      ...visible.map((gene) => getGeneState(chartState, gene).start),
    ];
    const index = boundaryIndex(boundaries.map(coordinateFor), position, edge);
    state.start = boundaries[index];
    state.trimLeft = index === 0 ? null : visible[index - 1];
    return { state, coordinate: coordinateFor(state.start) };
  }

  if (edge === "right") {
    const visible = genes.filter(
      (gene) => getGeneState(chartState, gene).start >= state.start
    );
    const boundaries = [
      ...visible.map((gene) => getGeneState(chartState, gene).end),
      scaleGenes ? locus.end : state.end,
    ];
    const index = boundaryIndex(boundaries.map(coordinateFor), position, edge);
    state.end = boundaries[index];
    state.trimRight = visible[index] || null;
    return { state, coordinate: coordinateFor(state.end) };
  }

  throw new Error(`Unknown locus trim edge: ${edge}`);
}

/** Trim both flanks of a locus to its displayed outermost genes. */
function trimLocusToGeneBounds(chartState, locus) {
  if (!locus.genes.length) return false;
  const genes = [...locus.genes].sort(
    (left, right) =>
      getGeneState(chartState, left).start - getGeneState(chartState, right).start
  );
  const first = genes[0];
  const last = genes.at(-1);
  const state = chartState.loci.get(locus.uid);
  const start = getGeneState(chartState, first).start;
  const end = getGeneState(chartState, last).end;
  const changed =
    state.start !== start ||
    state.end !== end ||
    state.trimLeft !== first ||
    state.trimRight !== last;
  if (!changed) return false;
  Object.assign(state, { start, end, trimLeft: first, trimRight: last });
  return true;
}

/** Restore a locus's full extent without changing its orientation or offset. */
function restoreLocusBounds(chartState, locus) {
  const state = chartState.loci.get(locus.uid);
  const changed =
    state.start !== locus.start ||
    state.end !== locus.end ||
    state.trimLeft !== null ||
    state.trimRight !== null;
  if (!changed) return false;
  Object.assign(state, {
    start: locus.start,
    end: locus.end,
    trimLeft: null,
    trimRight: null,
  });
  return true;
}

function finalizeLocusTrim(chartState, locus) {
  const state = getLocusState(chartState, locus);
  if (state.end === locus.end) state.trimRight = null;
  if (state.start === locus.start) state.trimLeft = null;
}

function previewLocusTrim(chartState, locus, options) {
  if (!chartState.preview.loci.has(locus.uid)) {
    chartState.preview.loci.set(locus.uid, { ...chartState.loci.get(locus.uid) });
  }
  return trimLocus(chartState, locus, options);
}

function commitPreviewLocusState(chartState, locus) {
  const state = chartState.preview.loci.get(locus.uid);
  if (!state) return getLocusState(chartState, locus);
  chartState.loci.set(locus.uid, state);
  chartState.preview.loci.delete(locus.uid);
  return state;
}

/**
 * Align each represented cluster with an anchor gene. Coordinate projection is
 * injected by the controller, so this state transition remains independent of
 * D3 and of a particular renderer.
 */
function anchorGeneGroup(chartState, {
  anchor,
  genes,
  locusForGene,
  coordinateForGene,
  flipMismatchedLoci = false,
  onLocusFlipped = () => {},
}) {
  const anchorsByCluster = new Map();
  const anchorState = getGeneState(chartState, anchor);

  for (const gene of genes) {
    if (
      flipMismatchedLoci &&
      getGeneState(chartState, gene).strand !== anchorState.strand
    ) {
      const locus = locusForGene(gene);
      flipLocus(chartState, locus);
      onLocusFlipped(locus);
    }
    const clusterGenes = anchorsByCluster.get(gene.clusterUid) || [];
    clusterGenes.push(gene);
    anchorsByCluster.set(gene.clusterUid, clusterGenes);
  }

  const midpoint = coordinateForGene(anchor);
  const changes = [];
  for (const [clusterUid, clusterGenes] of anchorsByCluster) {
    if (clusterGenes.some((gene) => gene.uid === anchor.uid)) continue;
    const closest = clusterGenes.reduce((best, gene) =>
      Math.abs(coordinateForGene(gene) - midpoint) <
      Math.abs(coordinateForGene(best) - midpoint)
        ? gene
        : best
    );
    const offset = midpoint - coordinateForGene(closest);
    setClusterOffset(
      chartState,
      clusterUid,
      getClusterOffset(chartState, clusterUid) + offset
    );
    changes.push({ clusterUid, offset, gene: closest });
  }
  return changes;
}

function flipLocus(chartState, locus) {
  const state = getLocusState(chartState, locus);
  state.flipped = !state.flipped;
  const length = locus.end - locus.start;

  [state.trimLeft, state.trimRight] = [
    state.trimRight,
    state.trimLeft,
  ];

  locus.genes.forEach((gene) => {
    const geneState = getGeneState(chartState, gene);
    const start = geneState.start;
    geneState.start = length - geneState.end;
    geneState.end = length - start;
    geneState.strand = geneState.strand === 1 ? -1 : 1;
  });
  locus.genes.sort(
    (a, b) => getGeneState(chartState, a).start - getGeneState(chartState, b).start
  );
}

function appendToIndex(index, key, value) {
  const values = index.get(key);
  if (values) values.push(value);
  else index.set(key, [value]);
}

function createChartIndex(data) {
  const clusterById = new Map();
  const locusById = new Map();
  const geneById = new Map();
  const groupById = new Map();
  const linkById = new Map();
  const linksByGeneId = new Map();

  for (const cluster of data.clusters) {
    clusterById.set(cluster.uid, cluster);

    for (const locus of cluster.loci) {
      locusById.set(locus.uid, locus);
      for (const gene of locus.genes) geneById.set(gene.uid, gene);
    }
  }

  for (const link of data.links) {
    linkById.set(link.uid, link);
    appendToIndex(linksByGeneId, link.query.uid, link);
    appendToIndex(linksByGeneId, link.target.uid, link);
  }

  for (const group of data.groups || []) groupById.set(group.uid, group);

  return { clusterById, locusById, geneById, groupById, linkById, linksByGeneId };
}

function validateGroupPanel(panel, clusterIds, tree, fail) {
  if (!Array.isArray(panel.groups) || !panel.groups.length) fail("group panels require a non-empty groups array.");
  for (const key of ["markerWidth", "laneGap"]) {
    if (panel[key] !== undefined && (!Number.isFinite(panel[key]) || panel[key] <= 0)) fail(`${key} must be positive.`);
  }
  const ids = new Set(), nodes = new Set(tree?.nodes.map((node) => node.uid));
  for (const group of panel.groups) {
    if (!group || typeof group.uid !== "string" || !group.uid.trim() || ids.has(group.uid)) fail("groups require unique, non-empty uid strings.");
    ids.add(group.uid);
    if (group.label !== undefined && typeof group.label !== "string") fail("group label must be text.");
    if (group.colour !== undefined && (typeof group.colour !== "string" || !color(group.colour))) fail("group colour must be a CSS colour.");
    if ((group.nodeUid !== undefined) === (group.clusterIds !== undefined)) fail("each group requires either nodeUid or clusterIds.");
    if (group.nodeUid !== undefined) {
      if (!nodes.has(group.nodeUid)) fail(`unknown tree node '${group.nodeUid}'.`);
    } else if (!Array.isArray(group.clusterIds) || !group.clusterIds.length ||
        new Set(group.clusterIds).size !== group.clusterIds.length || group.clusterIds.some((uid) => !clusterIds.has(uid))) {
      fail("group clusterIds must contain unique, existing cluster IDs.");
    }
  }
}

/** Resolve membership and allocate lanes once; placement remains independent of tree geometry. */
function layoutGroupPanel(source, clusters, { fontFamily, fontSize, cellHeight, rowOffset, theme, tree, measureBounds }) {
  const nodes = new Map(tree?.nodes.map((node) => [node.uid, node]));
  const descendants = new Map();
  const collect = (uid) => {
    if (!descendants.has(uid)) {
      const node = nodes.get(uid);
      descendants.set(uid, node?.children?.length ? node.children.flatMap(collect) : node ? [node.cluster] : []);
    }
    return descendants.get(uid);
  };
  const markerWidth = source.markerWidth ?? 3, laneGap = source.laneGap ?? 12;
  const lanes = [];
  const markerGroups = source.groups.map((group) => {
    const clusterIds = group.clusterIds ?? collect(group.nodeUid);
    let laneIndex = lanes.findIndex((lane) => clusterIds.every((uid) => !lane.members.has(uid)));
    if (laneIndex < 0) { laneIndex = lanes.length; lanes.push({ members: new Set(), width: 0 }); }
    const lane = lanes[laneIndex], label = group.label ?? group.uid;
    const labelBounds = measureBounds(label);
    for (const uid of clusterIds) lane.members.add(uid);
    lane.width = Math.max(lane.width, markerWidth + (label ? 6 + labelBounds.maxX - labelBounds.minX : 0));
    return { uid: group.uid, label, clusterIds: new Set(clusterIds), laneIndex, labelBounds,
      colour: group.colour ?? source.colour ?? "#267c9e" };
  });
  let width = 0;
  for (const lane of lanes) { lane.x = width; width += lane.width + laneGap; }
  width -= laneGap;
  for (const group of markerGroups) group.x = lanes[group.laneIndex].x;
  const title = source.title ?? source.uid;
  const header = title ? [{ text: title, x: 0, y: 0, anchor: "start", weight: 700, kind: "title",
    bounds: measureBounds(title, { weight: 700 }) }] : [];
  return { uid: source.uid, definition: source, title, width, cellHeight, rowOffset, fontSize, fontFamily,
    markerWidth, markerGroups, headingHeight: 0, titleDescent: Math.max(0, header[0]?.bounds.maxY ?? 0),
    rows: [...clusters.keys()].map((uid) => ({ uid, cells: [] })), header, footer: [], key: [],
    textColour: theme?.foreground ?? "#333333", extentWidth: Math.max(width, header[0]?.bounds.maxX ?? 0) };
}

/** Split non-contiguous memberships using the current row order, including drag previews. */
function groupPanelMarks(panel, rows) {
  const sorted = [...rows].sort((a, b) => a.y - b.y);
  const rects = [], texts = [];
  for (const group of panel.markerGroups) {
    let start = -1;
    const segment = (end) => {
      const top = sorted[start].y - panel.cellHeight / 2, bottom = sorted[end].y + panel.cellHeight / 2;
      const uid = `${group.uid}:${sorted[start].uid}`;
      rects.push({ uid, x: group.x, y: top, width: panel.markerWidth, height: bottom - top,
        fill: group.colour, keyIndex: rects.length });
      if (group.label) texts.push({ uid, text: group.label, x: group.x + panel.markerWidth + 6 - group.labelBounds.minX,
        y: (top + bottom - group.labelBounds.minY - group.labelBounds.maxY) / 2,
        anchor: "start", bounds: group.labelBounds });
    };
    for (let i = 0; i <= sorted.length; i++) {
      const member = i < sorted.length && group.clusterIds.has(sorted[i].uid);
      if (member && start < 0) start = i;
      if (!member && start >= 0) { segment(i - 1); start = -1; }
    }
  }
  return { rects, texts };
}

function ascending(a, b) {
  return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function descending(a, b) {
  return a == null || b == null ? NaN
    : b < a ? -1
    : b > a ? 1
    : b >= a ? 0
    : NaN;
}

function bisector(f) {
  let compare1, compare2, delta;

  // If an accessor is specified, promote it to a comparator. In this case we
  // can test whether the search value is (self-) comparable. We can’t do this
  // for a comparator (except for specific, known comparators) because we can’t
  // tell if the comparator is symmetric, and an asymmetric comparator can’t be
  // used to test whether a single value is comparable.
  if (f.length !== 2) {
    compare1 = ascending;
    compare2 = (d, x) => ascending(f(d), x);
    delta = (d, x) => f(d) - x;
  } else {
    compare1 = f === ascending || f === descending ? f : zero;
    compare2 = f;
    delta = f;
  }

  function left(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) < 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function right(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) <= 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function center(a, x, lo = 0, hi = a.length) {
    const i = left(a, x, lo, hi - 1);
    return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
  }

  return {left, center, right};
}

function zero() {
  return 0;
}

function number$1(x) {
  return x === null ? NaN : +x;
}

const ascendingBisect = bisector(ascending);
const bisectRight = ascendingBisect.right;
bisector(number$1).center;
var bisect = bisectRight;

class InternMap extends Map {
  constructor(entries, key = keyof) {
    super();
    Object.defineProperties(this, {_intern: {value: new Map()}, _key: {value: key}});
    if (entries != null) for (const [key, value] of entries) this.set(key, value);
  }
  get(key) {
    return super.get(intern_get(this, key));
  }
  has(key) {
    return super.has(intern_get(this, key));
  }
  set(key, value) {
    return super.set(intern_set(this, key), value);
  }
  delete(key) {
    return super.delete(intern_delete(this, key));
  }
}

function intern_get({_intern, _key}, value) {
  const key = _key(value);
  return _intern.has(key) ? _intern.get(key) : value;
}

function intern_set({_intern, _key}, value) {
  const key = _key(value);
  if (_intern.has(key)) return _intern.get(key);
  _intern.set(key, value);
  return value;
}

function intern_delete({_intern, _key}, value) {
  const key = _key(value);
  if (_intern.has(key)) {
    value = _intern.get(key);
    _intern.delete(key);
  }
  return value;
}

function keyof(value) {
  return value !== null && typeof value === "object" ? value.valueOf() : value;
}

const e10 = Math.sqrt(50),
    e5 = Math.sqrt(10),
    e2 = Math.sqrt(2);

function tickSpec(start, stop, count) {
  const step = (stop - start) / Math.max(0, count),
      power = Math.floor(Math.log10(step)),
      error = step / Math.pow(10, power),
      factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
  let i1, i2, inc;
  if (power < 0) {
    inc = Math.pow(10, -power) / factor;
    i1 = Math.round(start * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = Math.pow(10, power) * factor;
    i1 = Math.round(start / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start, stop, count * 2);
  return [i1, i2, inc];
}

function ticks(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const reverse = stop < start, [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
  if (!(i2 >= i1)) return [];
  const n = i2 - i1 + 1, ticks = new Array(n);
  if (reverse) {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) / -inc;
    else for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) * inc;
  } else {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) / -inc;
    else for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) * inc;
  }
  return ticks;
}

function tickIncrement(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  return tickSpec(start, stop, count)[2];
}

function tickStep(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  const reverse = stop < start, inc = reverse ? tickIncrement(stop, start, count) : tickIncrement(start, stop, count);
  return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
}

function max(values, valueof) {
  let max;
  if (valueof === undefined) {
    for (const value of values) {
      if (value != null
          && (max < value || (max === undefined && value >= value))) {
        max = value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null
          && (max < value || (max === undefined && value >= value))) {
        max = value;
      }
    }
  }
  return max;
}

function min(values, valueof) {
  let min;
  if (valueof === undefined) {
    for (const value of values) {
      if (value != null
          && (min > value || (min === undefined && value >= value))) {
        min = value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null
          && (min > value || (min === undefined && value >= value))) {
        min = value;
      }
    }
  }
  return min;
}

function initRange(domain, range) {
  switch (arguments.length) {
    case 0: break;
    case 1: this.range(domain); break;
    default: this.range(range).domain(domain); break;
  }
  return this;
}

function initInterpolator(domain, interpolator) {
  switch (arguments.length) {
    case 0: break;
    case 1: {
      if (typeof domain === "function") this.interpolator(domain);
      else this.range(domain);
      break;
    }
    default: {
      this.domain(domain);
      if (typeof interpolator === "function") this.interpolator(interpolator);
      else this.range(interpolator);
      break;
    }
  }
  return this;
}

const implicit = Symbol("implicit");

function ordinal() {
  var index = new InternMap(),
      domain = [],
      range = [],
      unknown = implicit;

  function scale(d) {
    let i = index.get(d);
    if (i === undefined) {
      if (unknown !== implicit) return unknown;
      index.set(d, i = domain.push(d) - 1);
    }
    return range[i % range.length];
  }

  scale.domain = function(_) {
    if (!arguments.length) return domain.slice();
    domain = [], index = new InternMap();
    for (const value of _) {
      if (index.has(value)) continue;
      index.set(value, domain.push(value) - 1);
    }
    return scale;
  };

  scale.range = function(_) {
    return arguments.length ? (range = Array.from(_), scale) : range.slice();
  };

  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  scale.copy = function() {
    return ordinal(domain, range).unknown(unknown);
  };

  initRange.apply(scale, arguments);

  return scale;
}

function constants(x) {
  return function() {
    return x;
  };
}

function number(x) {
  return +x;
}

var unit = [0, 1];

function identity$1(x) {
  return x;
}

function normalize(a, b) {
  return (b -= (a = +a))
      ? function(x) { return (x - a) / b; }
      : constants(isNaN(b) ? NaN : 0.5);
}

function clamper(a, b) {
  var t;
  if (a > b) t = a, a = b, b = t;
  return function(x) { return Math.max(a, Math.min(b, x)); };
}

// normalize(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
// interpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding range value x in [a,b].
function bimap(domain, range, interpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
  if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
  else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
  return function(x) { return r0(d0(x)); };
}

function polymap(domain, range, interpolate) {
  var j = Math.min(domain.length, range.length) - 1,
      d = new Array(j),
      r = new Array(j),
      i = -1;

  // Reverse descending domains.
  if (domain[j] < domain[0]) {
    domain = domain.slice().reverse();
    range = range.slice().reverse();
  }

  while (++i < j) {
    d[i] = normalize(domain[i], domain[i + 1]);
    r[i] = interpolate(range[i], range[i + 1]);
  }

  return function(x) {
    var i = bisect(domain, x, 1, j) - 1;
    return r[i](d[i](x));
  };
}

function copy$1(source, target) {
  return target
      .domain(source.domain())
      .range(source.range())
      .interpolate(source.interpolate())
      .clamp(source.clamp())
      .unknown(source.unknown());
}

function transformer$1() {
  var domain = unit,
      range = unit,
      interpolate = interpolate$1,
      transform,
      untransform,
      unknown,
      clamp = identity$1,
      piecewise,
      output,
      input;

  function rescale() {
    var n = Math.min(domain.length, range.length);
    if (clamp !== identity$1) clamp = clamper(domain[0], domain[n - 1]);
    piecewise = n > 2 ? polymap : bimap;
    output = input = null;
    return scale;
  }

  function scale(x) {
    return x == null || isNaN(x = +x) ? unknown : (output || (output = piecewise(domain.map(transform), range, interpolate)))(transform(clamp(x)));
  }

  scale.invert = function(y) {
    return clamp(untransform((input || (input = piecewise(range, domain.map(transform), interpolateNumber$1)))(y)));
  };

  scale.domain = function(_) {
    return arguments.length ? (domain = Array.from(_, number), rescale()) : domain.slice();
  };

  scale.range = function(_) {
    return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
  };

  scale.rangeRound = function(_) {
    return range = Array.from(_), interpolate = interpolateRound, rescale();
  };

  scale.clamp = function(_) {
    return arguments.length ? (clamp = _ ? true : identity$1, rescale()) : clamp !== identity$1;
  };

  scale.interpolate = function(_) {
    return arguments.length ? (interpolate = _, rescale()) : interpolate;
  };

  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  return function(t, u) {
    transform = t, untransform = u;
    return rescale();
  };
}

function continuous() {
  return transformer$1()(identity$1, identity$1);
}

function formatDecimal(x) {
  return Math.abs(x = Math.round(x)) >= 1e21
      ? x.toLocaleString("en").replace(/,/g, "")
      : x.toString(10);
}

// Computes the decimal coefficient and exponent of the specified number x with
// significant digits p, where x is positive and p is in [1, 21] or undefined.
// For example, formatDecimalParts(1.23) returns ["123", 0].
function formatDecimalParts(x, p) {
  if (!isFinite(x) || x === 0) return null; // NaN, ±Infinity, ±0
  var i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e"), coefficient = x.slice(0, i);

  // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
  // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
  return [
    coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
    +x.slice(i + 1)
  ];
}

function exponent(x) {
  return x = formatDecimalParts(Math.abs(x)), x ? x[1] : NaN;
}

function formatGroup(grouping, thousands) {
  return function(value, width) {
    var i = value.length,
        t = [],
        j = 0,
        g = grouping[0],
        length = 0;

    while (i > 0 && g > 0) {
      if (length + g + 1 > width) g = Math.max(1, width - length);
      t.push(value.substring(i -= g, i + g));
      if ((length += g + 1) > width) break;
      g = grouping[j = (j + 1) % grouping.length];
    }

    return t.reverse().join(thousands);
  };
}

function formatNumerals(numerals) {
  return function(value) {
    return value.replace(/[0-9]/g, function(i) {
      return numerals[+i];
    });
  };
}

// [[fill]align][sign][symbol][0][width][,][.precision][~][type]
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

function formatSpecifier(specifier) {
  if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
  var match;
  return new FormatSpecifier({
    fill: match[1],
    align: match[2],
    sign: match[3],
    symbol: match[4],
    zero: match[5],
    width: match[6],
    comma: match[7],
    precision: match[8] && match[8].slice(1),
    trim: match[9],
    type: match[10]
  });
}

formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

function FormatSpecifier(specifier) {
  this.fill = specifier.fill === undefined ? " " : specifier.fill + "";
  this.align = specifier.align === undefined ? ">" : specifier.align + "";
  this.sign = specifier.sign === undefined ? "-" : specifier.sign + "";
  this.symbol = specifier.symbol === undefined ? "" : specifier.symbol + "";
  this.zero = !!specifier.zero;
  this.width = specifier.width === undefined ? undefined : +specifier.width;
  this.comma = !!specifier.comma;
  this.precision = specifier.precision === undefined ? undefined : +specifier.precision;
  this.trim = !!specifier.trim;
  this.type = specifier.type === undefined ? "" : specifier.type + "";
}

FormatSpecifier.prototype.toString = function() {
  return this.fill
      + this.align
      + this.sign
      + this.symbol
      + (this.zero ? "0" : "")
      + (this.width === undefined ? "" : Math.max(1, this.width | 0))
      + (this.comma ? "," : "")
      + (this.precision === undefined ? "" : "." + Math.max(0, this.precision | 0))
      + (this.trim ? "~" : "")
      + this.type;
};

// Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
function formatTrim(s) {
  out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
    switch (s[i]) {
      case ".": i0 = i1 = i; break;
      case "0": if (i0 === 0) i0 = i; i1 = i; break;
      default: if (!+s[i]) break out; if (i0 > 0) i0 = 0; break;
    }
  }
  return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
}

var prefixExponent;

function formatPrefixAuto(x, p) {
  var d = formatDecimalParts(x, p);
  if (!d) return prefixExponent = undefined, x.toPrecision(p);
  var coefficient = d[0],
      exponent = d[1],
      i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
      n = coefficient.length;
  return i === n ? coefficient
      : i > n ? coefficient + new Array(i - n + 1).join("0")
      : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
      : "0." + new Array(1 - i).join("0") + formatDecimalParts(x, Math.max(0, p + i - 1))[0]; // less than 1y!
}

function formatRounded(x, p) {
  var d = formatDecimalParts(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
      : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
      : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

var formatTypes = {
  "%": (x, p) => (x * 100).toFixed(p),
  "b": (x) => Math.round(x).toString(2),
  "c": (x) => x + "",
  "d": formatDecimal,
  "e": (x, p) => x.toExponential(p),
  "f": (x, p) => x.toFixed(p),
  "g": (x, p) => x.toPrecision(p),
  "o": (x) => Math.round(x).toString(8),
  "p": (x, p) => formatRounded(x * 100, p),
  "r": formatRounded,
  "s": formatPrefixAuto,
  "X": (x) => Math.round(x).toString(16).toUpperCase(),
  "x": (x) => Math.round(x).toString(16)
};

function identity(x) {
  return x;
}

var map = Array.prototype.map,
    prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

function formatLocale(locale) {
  var group = locale.grouping === undefined || locale.thousands === undefined ? identity : formatGroup(map.call(locale.grouping, Number), locale.thousands + ""),
      currencyPrefix = locale.currency === undefined ? "" : locale.currency[0] + "",
      currencySuffix = locale.currency === undefined ? "" : locale.currency[1] + "",
      decimal = locale.decimal === undefined ? "." : locale.decimal + "",
      numerals = locale.numerals === undefined ? identity : formatNumerals(map.call(locale.numerals, String)),
      percent = locale.percent === undefined ? "%" : locale.percent + "",
      minus = locale.minus === undefined ? "−" : locale.minus + "",
      nan = locale.nan === undefined ? "NaN" : locale.nan + "";

  function newFormat(specifier, options) {
    specifier = formatSpecifier(specifier);

    var fill = specifier.fill,
        align = specifier.align,
        sign = specifier.sign,
        symbol = specifier.symbol,
        zero = specifier.zero,
        width = specifier.width,
        comma = specifier.comma,
        precision = specifier.precision,
        trim = specifier.trim,
        type = specifier.type;

    // The "n" type is an alias for ",g".
    if (type === "n") comma = true, type = "g";

    // The "" type, and any invalid type, is an alias for ".12~g".
    else if (!formatTypes[type]) precision === undefined && (precision = 12), trim = true, type = "g";

    // If zero fill is specified, padding goes after sign and before digits.
    if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

    // Compute the prefix and suffix.
    // For SI-prefix, the suffix is lazily computed.
    var prefix = (options && options.prefix !== undefined ? options.prefix : "") + (symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : ""),
        suffix = (symbol === "$" ? currencySuffix : /[%p]/.test(type) ? percent : "") + (options && options.suffix !== undefined ? options.suffix : "");

    // What format function should we use?
    // Is this an integer type?
    // Can this type generate exponential notation?
    var formatType = formatTypes[type],
        maybeSuffix = /[defgprs%]/.test(type);

    // Set the default precision if not specified,
    // or clamp the specified precision to the supported range.
    // For significant precision, it must be in [1, 21].
    // For fixed precision, it must be in [0, 20].
    precision = precision === undefined ? 6
        : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
        : Math.max(0, Math.min(20, precision));

    function format(value) {
      var valuePrefix = prefix,
          valueSuffix = suffix,
          i, n, c;

      if (type === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value;

        // Determine the sign. -0 is not less than 0, but 1 / -0 is!
        var valueNegative = value < 0 || 1 / value < 0;

        // Perform the initial formatting.
        value = isNaN(value) ? nan : formatType(Math.abs(value), precision);

        // Trim insignificant zeros.
        if (trim) value = formatTrim(value);

        // If a negative value rounds to zero after formatting, and no explicit positive sign is requested, hide the sign.
        if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;

        // Compute the prefix and suffix.
        valuePrefix = (valueNegative ? (sign === "(" ? sign : minus) : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
        valueSuffix = (type === "s" && !isNaN(value) && prefixExponent !== undefined ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

        // Break the formatted value into the integer “value” part that can be
        // grouped, and fractional or exponential “suffix” part that is not.
        if (maybeSuffix) {
          i = -1, n = value.length;
          while (++i < n) {
            if (c = value.charCodeAt(i), 48 > c || c > 57) {
              valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
              value = value.slice(0, i);
              break;
            }
          }
        }
      }

      // If the fill character is not "0", grouping is applied before padding.
      if (comma && !zero) value = group(value, Infinity);

      // Compute the padding.
      var length = valuePrefix.length + value.length + valueSuffix.length,
          padding = length < width ? new Array(width - length + 1).join(fill) : "";

      // If the fill character is "0", grouping is applied after padding.
      if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

      // Reconstruct the final output based on the desired alignment.
      switch (align) {
        case "<": value = valuePrefix + value + valueSuffix + padding; break;
        case "=": value = valuePrefix + padding + value + valueSuffix; break;
        case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
        default: value = padding + valuePrefix + value + valueSuffix; break;
      }

      return numerals(value);
    }

    format.toString = function() {
      return specifier + "";
    };

    return format;
  }

  function formatPrefix(specifier, value) {
    var e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
        k = Math.pow(10, -e),
        f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier), {suffix: prefixes[8 + e / 3]});
    return function(value) {
      return f(k * value);
    };
  }

  return {
    format: newFormat,
    formatPrefix: formatPrefix
  };
}

var locale;
var format;
var formatPrefix;

defaultLocale({
  thousands: ",",
  grouping: [3],
  currency: ["$", ""]
});

function defaultLocale(definition) {
  locale = formatLocale(definition);
  format = locale.format;
  formatPrefix = locale.formatPrefix;
  return locale;
}

function precisionFixed(step) {
  return Math.max(0, -exponent(Math.abs(step)));
}

function precisionPrefix(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
}

function precisionRound(step, max) {
  step = Math.abs(step), max = Math.abs(max) - step;
  return Math.max(0, exponent(max) - exponent(step)) + 1;
}

function tickFormat(start, stop, count, specifier) {
  var step = tickStep(start, stop, count),
      precision;
  specifier = formatSpecifier(specifier == null ? ",f" : specifier);
  switch (specifier.type) {
    case "s": {
      var value = Math.max(Math.abs(start), Math.abs(stop));
      if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
      return formatPrefix(specifier, value);
    }
    case "":
    case "e":
    case "g":
    case "p":
    case "r": {
      if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
      break;
    }
    case "f":
    case "%": {
      if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
      break;
    }
  }
  return format(specifier);
}

function linearish(scale) {
  var domain = scale.domain;

  scale.ticks = function(count) {
    var d = domain();
    return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
  };

  scale.tickFormat = function(count, specifier) {
    var d = domain();
    return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
  };

  scale.nice = function(count) {
    if (count == null) count = 10;

    var d = domain();
    var i0 = 0;
    var i1 = d.length - 1;
    var start = d[i0];
    var stop = d[i1];
    var prestep;
    var step;
    var maxIter = 10;

    if (stop < start) {
      step = start, start = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }

    while (maxIter-- > 0) {
      step = tickIncrement(start, stop, count);
      if (step === prestep) {
        d[i0] = start;
        d[i1] = stop;
        return domain(d);
      } else if (step > 0) {
        start = Math.floor(start / step) * step;
        stop = Math.ceil(stop / step) * step;
      } else if (step < 0) {
        start = Math.ceil(start * step) / step;
        stop = Math.floor(stop * step) / step;
      } else {
        break;
      }
      prestep = step;
    }

    return scale;
  };

  return scale;
}

function linear() {
  var scale = continuous();

  scale.copy = function() {
    return copy$1(scale, linear());
  };

  initRange.apply(scale, arguments);

  return linearish(scale);
}

function transformer() {
  var x0 = 0,
      x1 = 1,
      t0,
      t1,
      k10,
      transform,
      interpolator = identity$1,
      clamp = false,
      unknown;

  function scale(x) {
    return x == null || isNaN(x = +x) ? unknown : interpolator(k10 === 0 ? 0.5 : (x = (transform(x) - t0) * k10, clamp ? Math.max(0, Math.min(1, x)) : x));
  }

  scale.domain = function(_) {
    return arguments.length ? ([x0, x1] = _, t0 = transform(x0 = +x0), t1 = transform(x1 = +x1), k10 = t0 === t1 ? 0 : 1 / (t1 - t0), scale) : [x0, x1];
  };

  scale.clamp = function(_) {
    return arguments.length ? (clamp = !!_, scale) : clamp;
  };

  scale.interpolator = function(_) {
    return arguments.length ? (interpolator = _, scale) : interpolator;
  };

  function range(interpolate) {
    return function(_) {
      var r0, r1;
      return arguments.length ? ([r0, r1] = _, interpolator = interpolate(r0, r1), scale) : [interpolator(0), interpolator(1)];
    };
  }

  scale.range = range(interpolate$1);

  scale.rangeRound = range(interpolateRound);

  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  return function(t) {
    transform = t, t0 = t(x0), t1 = t(x1), k10 = t0 === t1 ? 0 : 1 / (t1 - t0);
    return scale;
  };
}

function copy(source, target) {
  return target
      .domain(source.domain())
      .interpolator(source.interpolator())
      .clamp(source.clamp())
      .unknown(source.unknown());
}

function sequential$1() {
  var scale = linearish(transformer()(identity$1));

  scale.copy = function() {
    return copy(scale, sequential$1());
  };

  return initInterpolator.apply(scale, arguments);
}

const sequential = ["#f7fbff", "#08306b"];
const categorical = ["#4477aa", "#ee6677", "#228833", "#ccbb44", "#66ccee", "#aa3377", "#bbbbbb"];
const ANNOTATION_DEFAULTS = Object.freeze({ cellWidth: 32, cellHeight: 20, gap: 24,
  fontSize: 10, headingRotation: -60, missingColour: "#eeeeee",
  cellGap: 0, cellBorderWidth: 0, cellBorderColour: "#ffffff", width: 120, colour: "#267c9e" });
const ANNOTATION_PALETTES = {
  Blue: sequential,
  "Blue–red": ["#2166ac", "#f7f7f7", "#b2182b"],
  Viridis: ["#440154", "#21918c", "#fde725"],
  Qualitative: categorical,
};

// Validate at the JSON boundary; renderers only consume projected records.
function validateAnnotationPanels(panels, clusters, { previousPanels = null, tree = null } = {}) {
  if (panels == null) return;
  const fail = (message) => { throw new TypeError(`Invalid annotationPanels: ${message}`); };
  if (!Array.isArray(panels)) fail("expected an array.");
  const ids = new Set(), previous = new Map(previousPanels?.map((panel) => [panel.uid, panel]));
  let clusterIds;
  for (const panel of panels) {
    if (!panel || typeof panel !== "object") fail("each panel must be an object.");
    if (typeof panel.uid !== "string" || !panel.uid.trim() || ids.has(panel.uid)) fail("panels require unique, non-empty uid strings.");
    ids.add(panel.uid);
    const before = previous.get(panel.uid);
    if (before === panel) continue;
    if (!["heatmap", "bar", "groups"].includes(panel.type)) fail(`unsupported type for '${panel.uid}'; expected heatmap, bar or groups.`);
    if (panel.title != null && typeof panel.title !== "string") fail("title must be text.");
    for (const key of ["show", "showKey", "showColumnLabels"]) {
      if (panel[key] !== undefined && typeof panel[key] !== "boolean") fail(`${key} must be a boolean.`);
    }
    if (panel.headingRotation !== undefined && (!Number.isFinite(panel.headingRotation) || panel.headingRotation < -90 || panel.headingRotation > 0)) fail("headingRotation must be between -90 and 0 degrees.");
    for (const key of ["cellWidth", "cellHeight", "fontSize", "width"]) {
      if (panel[key] !== undefined && (!Number.isFinite(panel[key]) || panel[key] <= 0)) fail(`${key} must be positive.`);
    }
    if (panel.gap !== undefined && (!Number.isFinite(panel.gap) || panel.gap < 0)) fail("gap must be non-negative.");
    for (const key of ["cellGap", "cellBorderWidth"]) {
      if (panel[key] !== undefined && (!Number.isFinite(panel[key]) || panel[key] < 0)) fail(`${key} must be non-negative.`);
    }
    if ((panel.cellGap ?? 0) >= Math.min(panel.cellWidth ?? ANNOTATION_DEFAULTS.cellWidth,
      panel.cellHeight ?? ANNOTATION_DEFAULTS.cellHeight)) fail("cellGap must be smaller than cellWidth and cellHeight.");
    if (panel.cellBorderColour !== undefined && (typeof panel.cellBorderColour !== "string" || !color(panel.cellBorderColour))) fail("cellBorderColour must be a CSS colour.");
    if (panel.colour !== undefined && (typeof panel.colour !== "string" || !color(panel.colour))) fail("colour must be a CSS colour.");
    if (panel.type === "groups") {
      clusterIds ??= new Set(clusters.map((cluster) => cluster.uid));
      validateGroupPanel(panel, clusterIds, tree, fail);
      continue;
    }
    if (!Array.isArray(panel.columns) || !panel.columns.length ||
        panel.columns.some((column) => typeof column !== "string" || !column.trim()) ||
        new Set(panel.columns).size !== panel.columns.length) fail("columns must be unique, non-empty strings.");
    if (panel.type === "bar" && panel.columns.length !== 1) fail("bar panels require exactly one column.");
    if (!panel.values || typeof panel.values !== "object" || Array.isArray(panel.values)) fail("values must map cluster IDs to row arrays.");
    const scale = panel.scale ?? {};
    if (!scale || typeof scale !== "object" || Array.isArray(scale)) fail("scale must be an object.");
    const type = scale.type ?? "continuous";
    if (panel.type === "bar" && type !== "continuous") fail("bar panels require a continuous scale.");
    if (!["continuous", "categorical"].includes(type)) fail("scale.type must be continuous or categorical.");
    if (scale.colours !== undefined && (!Array.isArray(scale.colours) || !scale.colours.length ||
        scale.colours.some((value) => typeof value !== "string" || !color(value)))) fail("scale.colours must contain valid CSS colours.");
    if (type === "continuous" && scale.colours?.length < 2) fail("continuous scales need at least two colours.");
    if (panel.missingColour !== undefined && (typeof panel.missingColour !== "string" || !color(panel.missingColour))) fail("missingColour must be a CSS colour.");
    if (scale.domain !== undefined) {
      if (!Array.isArray(scale.domain)) fail("scale.domain must be an array.");
      if (type === "continuous" && (scale.domain.length !== 2 || !scale.domain.every(Number.isFinite) || scale.domain[0] >= scale.domain[1])) fail("continuous domain must be [min, max] with min < max.");
      if (panel.type === "bar" && (scale.domain[0] > 0 || scale.domain[1] < 0)) fail("bar domains must include zero.");
      if (type === "categorical" && (scale.domain.some((value) => typeof value !== "string") || new Set(scale.domain).size !== scale.domain.length)) fail("categorical domain must contain unique strings.");
    }
    // Presentation changes leave the matrix valid unless they change its
    // shape, value type or allowed categories. JSON loading always checks it.
    const oldScale = before?.scale ?? {};
    const sameCategories = sameArray(oldScale.domain, scale.domain);
    if (before?.values === panel.values && before.columns?.length === panel.columns.length &&
        (oldScale.type ?? "continuous") === type && (type !== "categorical" || sameCategories)) continue;
    clusterIds ??= new Set(clusters.map((cluster) => cluster.uid));
    const categories = type === "categorical" && scale.domain ? new Set(scale.domain) : null;
    for (const [uid, values] of Object.entries(panel.values)) {
      if (!clusterIds.has(uid)) fail(`unknown cluster '${uid}'.`);
      if (!Array.isArray(values) || values.length !== panel.columns.length) fail(`row '${uid}' must have one value per column.`);
      for (const value of values) {
        if (value === null) continue;
        if (type === "continuous" ? !Number.isFinite(value) : typeof value !== "string") fail(`invalid ${type} value in row '${uid}'.`);
        if (categories && !categories.has(value)) fail(`category '${value}' is absent from scale.domain.`);
      }
    }
  }
}

const numberLabel = (value) => Number(value.toPrecision(3)).toString();
const text = (value, x, y, extra = {}) => ({ text: String(value), x, y, anchor: "start", ...extra });

function textBounds(value, fontSize, fontFamily, measureText, { weight = 400, rotation = 0, anchor = "start" } = {}) {
  const metrics = measureText?.(String(value), { fontSize, fontFamily, fontWeight: weight });
  const width = metrics?.width ?? String(value).length * fontSize * 0.6;
  const shift = anchor === "end" ? -width : anchor === "middle" ? -width / 2 : 0;
  const left = -(metrics?.actualBoundingBoxLeft ?? 0) + shift;
  const right = (metrics?.actualBoundingBoxRight ?? width) + shift;
  const top = -(metrics?.actualBoundingBoxAscent ?? fontSize * 0.8);
  const bottom = metrics?.actualBoundingBoxDescent ?? fontSize * 0.2;
  const angle = rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const points = [[left, top], [right, top], [left, bottom], [right, bottom]]
    .map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
  return { minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)) };
}

/** Right edge of cluster decorations, excluding a right legend placed after annotations. */
function annotationChromeRightEdge(chrome, measureText = null) {
  let right = -Infinity;
  const bar = chrome?.scaleBar, identity = chrome?.colourBar, legend = chrome?.legend;
  if (bar?.visible) {
    const label = textBounds(bar.label, bar.fontSize * 4 / 3, bar.fontFamily, measureText, { anchor: "middle" });
    right = Math.max(right, bar.position.x + bar.length + (bar.strokeWidth || 0) / 2,
      bar.position.x + bar.length / 2 + label.maxX);
  }
  if (identity?.visible) {
    const label = textBounds(identity.label, identity.fontSize * 4 / 3, identity.fontFamily, measureText, { anchor: "middle" });
    const start = textBounds(identity.startLabel, identity.fontSize * 4 / 3, identity.fontFamily, measureText);
    right = Math.max(right, identity.position.x + identity.width + 0.5,
      identity.position.x + identity.width / 2 + label.maxX, identity.position.x + start.maxX);
  }
  if (legend?.visible && legend.placement === "bottom") {
    for (const item of legend.items) {
      const label = textBounds(item.label, legend.fontSize, legend.fontFamily, measureText);
      const subtitle = textBounds(item.subtitle || "", legend.subtitleFontSize, legend.fontFamily, measureText);
      right = Math.max(right, legend.position.x + item.x + item.radius,
        legend.position.x + item.textX + Math.max(label.maxX, subtitle.maxX));
    }
  }
  return right;
}

// Values are replaced at data boundaries and shared by presentation edits.
// Retain only their inferred domain, not a second flattened copy of the matrix.
const domainCache = new WeakMap();
function inferredDomain(values, type, isBar) {
  let cached = domainCache.get(values);
  if (!cached) { cached = {}; domainCache.set(values, cached); }
  const key = type === "categorical" ? "categories" : isBar ? "bars" : "numeric";
  if (cached[key]) return cached[key];
  const categories = new Set();
  let min = Infinity, max = -Infinity, count = 0;
  for (const row of Object.values(values)) for (const value of row) {
    if (value === null) continue;
    count++;
    if (type === "categorical") categories.add(value);
    else { min = Math.min(min, value); max = Math.max(max, value); }
  }
  if (isBar) { min = Math.min(0, min); max = Math.max(0, max); }
  return cached[key] = type === "categorical" ? [...categories]
    : !count || isBar && min === max ? [0, 1]
    : min === max ? [min - 0.5, max + 0.5] : [min, max];
}

/** Resolve scales identically for layout and the appearance editor. */
function resolveAnnotationScale(source) {
  const scale = source.scale ?? {}, type = scale.type ?? "continuous";
  const domain = scale.domain ?? inferredDomain(source.values, type, source.type === "bar");
  const colours = scale.colours ?? (type === "continuous" ? sequential : categorical);
  const colour = type === "categorical"
    ? ordinal(domain, colours).unknown(source.missingColour ?? "#eeeeee")
    : linear().domain(colours.map((_, i) => domain[0] + (domain[1] - domain[0]) * i / (colours.length - 1))).range(colours).clamp(true);
  return { type, domain, colours, colour };
}

// Draw the fill and a non-overlapping inset border ring using ordinary rects.
// All backends consume the same primitives, including instanced WebGPU cells.
function cellRectangles(rect, borderWidth, borderColour) {
  const result = [rect];
  const width = Math.min(borderWidth, rect.width / 2, rect.height / 2);
  if (!width) return result;
  const { x, y, width: w, height: h } = rect;
  result.push(
    { x, y, width: w, height: width, fill: borderColour },
    { x, y: y + h - width, width: w, height: width, fill: borderColour },
  );
  if (h > width * 2) result.push(
    { x, y: y + width, width, height: h - width * 2, fill: borderColour },
    { x: x + w - width, y: y + width, width, height: h - width * 2, fill: borderColour },
  );
  return result;
}

function barRectangles(value, position, width, height, fill, missingColour, borderWidth, borderColour) {
  const zero = position(0);
  if (value === null) {
    const markerWidth = Math.min(6, width);
    return [{ x: Math.max(0, Math.min(width - markerWidth, zero - markerWidth / 2)),
      y: -height / 2, width: markerWidth, height, fill: missingColour }];
  }
  const end = position(value);
  // The baseline remains visible for zero values and when bars are narrower
  // than a pixel. It is a rectangle, so all renderers share its geometry.
  const rects = [{ x: Math.max(0, Math.min(width - Math.min(1, width), zero - 0.5)),
    y: -height / 2, width: Math.min(1, width), height, fill: "#999999" }];
  if (end !== zero) rects.push(...cellRectangles({ x: Math.min(zero, end), y: -height / 2,
    width: Math.abs(end - zero), height, fill }, borderWidth, borderColour));
  return rects;
}

const sameArray = (one, two) => one === two || Array.isArray(one) && Array.isArray(two) &&
  one.length === two.length && one.every((value, index) => value === two[index]);
function sameCellDefinition(before, after) {
  return before && before.values === after.values && sameArray(before.columns, after.columns) &&
    ["type", "width", "cellWidth", "cellHeight", "cellGap", "cellBorderWidth", "cellBorderColour", "colour", "missingColour"]
      .every((field) => before[field] === after[field]) &&
    before.scale?.type === after.scale?.type && sameArray(before.scale?.domain, after.scale?.domain) &&
    sameArray(before.scale?.colours, after.scale?.colours);
}

/** Project JSON annotations once, using the same row coordinates as loci. */
function layoutAnnotationPanels(definitions, clusters, bounds,
  { fontFamily = "sans-serif", rowOffset = 0, anchorX = bounds?.maxX, measureText = null, previousPanels = null, theme = null, tree = null } = {}) {
  if (!definitions?.length || !bounds || !clusters.size) return [];
  const previous = new Map(previousPanels?.map((panel) => [panel.uid, panel]));
  let x = anchorX;
  return definitions.filter((source) => source.show !== false).map((source) => {
    const before = previous.get(source.uid);
    x += source.gap ?? ANNOTATION_DEFAULTS.gap;
    if (before?.definition === source && before.fontFamily === fontFamily && before.rowOffset === rowOffset) {
      const panel = before.x === x ? before : { ...before, x };
      x += panel.width;
      return panel;
    }
    if (source.type === "groups") {
      const panel = { ...layoutGroupPanel(source, clusters, { fontFamily, rowOffset, theme, tree,
        fontSize: source.fontSize ?? ANNOTATION_DEFAULTS.fontSize,
        cellHeight: source.cellHeight ?? ANNOTATION_DEFAULTS.cellHeight,
        measureBounds: (value, options) => textBounds(value, source.fontSize ?? ANNOTATION_DEFAULTS.fontSize, fontFamily, measureText, options),
      }), x };
      x += panel.width;
      return panel;
    }
    const isBar = source.type === "bar";
    const cellWidth = isBar ? source.width ?? ANNOTATION_DEFAULTS.width : source.cellWidth ?? ANNOTATION_DEFAULTS.cellWidth;
    const cellHeight = source.cellHeight ?? ANNOTATION_DEFAULTS.cellHeight;
    const fontSize = source.fontSize ?? ANNOTATION_DEFAULTS.fontSize, width = cellWidth * source.columns.length;
    const { type, domain, colour } = resolveAnnotationScale(source);
    const cellGap = isBar ? 0 : source.cellGap ?? ANNOTATION_DEFAULTS.cellGap;
    const borderWidth = source.cellBorderWidth ?? ANNOTATION_DEFAULTS.cellBorderWidth;
    const borderColour = source.cellBorderColour ?? ANNOTATION_DEFAULTS.cellBorderColour;
    const missingColour = source.missingColour ?? theme?.missing ?? ANNOTATION_DEFAULTS.missingColour;
    const position = isBar ? linear().domain(domain).range([0, width]).clamp(true) : null;
    const rows = sameCellDefinition(before?.definition, source) ? before.rows : [...clusters.keys()].map((uid) => ({ uid, cells: source.columns.map((_, i) => {
      const value = Object.hasOwn(source.values, uid) ? source.values[uid][i] : null;
      const rect = { x: i * cellWidth + cellGap / 2, y: -cellHeight / 2 + cellGap / 2,
        width: cellWidth - cellGap, height: cellHeight - cellGap,
        fill: value === null ? missingColour : colour(value) };
      return { ...rect, value, column: source.columns[i], columnIndex: i,
        rects: isBar ? barRectangles(value, position, width, cellHeight,
          source.colour ?? ANNOTATION_DEFAULTS.colour, missingColour,
          borderWidth, borderColour) : cellRectangles(rect, borderWidth, borderColour) };
    }) }));
    const rotation = source.headingRotation ?? (isBar ? 0 : ANNOTATION_DEFAULTS.headingRotation);
    const header = source.showColumnLabels === false ? [] : source.columns.map((column, i) => text(column, isBar ? 0 : (i + 0.5) * cellWidth, 0, { rotation }));
    for (const item of header) item.bounds = textBounds(item.text, fontSize, fontFamily, measureText, item);
    const headingHeight = Math.max(0, ...header.map((item) => -item.bounds.minY));
    let titleDescent = 0;
    if ((source.title ?? source.uid) !== "") {
      const title = text(source.title ?? source.uid, 0, 0, { weight: 700, kind: "title" });
      title.bounds = textBounds(title.text, fontSize, fontFamily, measureText, title);
      titleDescent = Math.max(0, title.bounds.maxY);
      header.push(title);
    }
    const footer = [], key = [];
    if (source.showKey !== false && isBar) {
      key.push({ x: 0, y: 0, width, height: 1, fill: theme?.muted ?? "#555555" });
      const ticks = position.ticks(Math.max(2, Math.min(6, Math.floor(width / 40))));
      if (!ticks.includes(0)) ticks.push(0);
      for (const value of ticks.sort((a, b) => a - b)) {
        const tickX = position(value);
        key.push({ x: Math.max(0, Math.min(width - Math.min(1, width), tickX - 0.5)), y: 0,
          width: Math.min(1, width), height: 5, fill: theme?.muted ?? "#555555" });
        footer.push(text(numberLabel(value), tickX, fontSize + 9,
          { anchor: tickX === 0 ? "start" : tickX === width ? "end" : "middle" }));
      }
    } else if (source.showKey !== false && type === "continuous") {
      for (let i = 0; i < 32; i++) key.push({ x: i * width / 32, y: 0, width: width / 32 + 0.1, height: 8,
        fill: colour(domain[0] + (domain[1] - domain[0]) * i / 31) });
      footer.push(text(numberLabel(domain[0]), 0, 8 + fontSize + 3),
        text(numberLabel(domain[1]), width, 8 + fontSize + 3, { anchor: "end" }));
    } else if (source.showKey !== false) domain.forEach((category, i) => {
      key.push({ x: 0, y: i * (fontSize + 6), width: 10, height: 10, fill: colour(category) });
      footer.push(text(category, 15, i * (fontSize + 6) + 9));
    });
    for (const item of footer) item.bounds = textBounds(item.text, fontSize, fontFamily, measureText, item);
    const panel = { uid: source.uid, definition: source, title: source.title ?? source.uid, x, width, cellHeight, headingHeight, titleDescent, rowOffset, rows, header, footer, key, fontSize, fontFamily,
      textColour: theme?.foreground ?? "#333333" };
    // Text overhang contributes to figure bounds, not inter-panel spacing.
    panel.extentWidth = Math.max(width,
      ...header.map((item) => item.x + item.bounds.maxX),
      ...footer.map((item) => item.x + item.bounds.maxX));
    x += panel.width;
    return panel;
  });
}

// Keep the static projection and only the latest preview per scene. Weak keys
// let retired scenes go; a long drag cannot accumulate preview snapshots.
const frameCache = new WeakMap();
const emptyFrames = Object.freeze([]);
const rowIndexes = new WeakMap();

function annotationBoundsVisible(bounds, viewport) {
  return !viewport || bounds.minX <= viewport.maxX && bounds.maxX >= viewport.minX &&
    bounds.minY <= viewport.maxY && bounds.maxY >= viewport.minY;
}

function rowBoundary(rows, y, upper = false) {
  let low = 0, high = rows.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (rows[mid].y < y || upper && rows[mid].y === y) low = mid + 1; else high = mid;
  }
  return low;
}

/** Cull shared records, retaining source cells and their contiguous column range. */
function annotationPanelsInViewport(scene, preview, viewport, { geometry = true, labels = true } = {}) {
  const panels = annotationPanelsForFrame(scene, preview);
  if (!viewport) return panels;
  const visible = [];
  for (const panel of panels) {
    const texts = labels ? panel.texts.filter((item) => annotationBoundsVisible({
      minX: panel.x + item.x + item.bounds.minX, maxX: panel.x + item.x + item.bounds.maxX,
      minY: item.y + item.bounds.minY, maxY: item.y + item.bounds.maxY }, viewport)) : emptyFrames;
    const rects = geometry ? panel.rects.filter((rect) => annotationBoundsVisible({
      minX: panel.x + rect.x, maxX: panel.x + rect.x + rect.width,
      minY: rect.y, maxY: rect.y + rect.height }, viewport)) : emptyFrames;
    let rows = emptyFrames;
    if (geometry && panel.x <= viewport.maxX && panel.x + panel.width >= viewport.minX) {
      let sorted = rowIndexes.get(panel);
      if (!sorted) { sorted = [...panel.rows].sort((a, b) => a.y - b.y); rowIndexes.set(panel, sorted); }
      const first = rowBoundary(sorted, viewport.minY - panel.cellHeight / 2);
      const last = rowBoundary(sorted, viewport.maxY + panel.cellHeight / 2, true);
      const count = panel.rows[0]?.cells.length || 1, cellWidth = panel.width / count;
      const firstCell = Math.max(0, Math.floor((viewport.minX - panel.x) / cellWidth));
      const lastCell = Math.min(count, Math.floor((viewport.maxX - panel.x) / cellWidth) + 1);
      rows = sorted.slice(first, last).map((row) => ({ ...row, firstCell, lastCell }));
    }
    if (rows.length || rects.length || texts.length) visible.push({ ...panel, rows, rects, texts });
  }
  return visible;
}

/** Read-only frame records shared by rendering, bounds and hit testing. */
function annotationPanelsForFrame(scene, preview = null) {
  if (!scene.annotationPanels?.length) return emptyFrames;
  let cached = frameCache.get(scene);
  if (!cached) { cached = {}; frameCache.set(scene, cached); }
  if (!preview && cached.static) return cached.static;
  if (preview && cached.preview === preview) return cached.frame;
  const frames = projectAnnotationFrame(scene, preview);
  if (!preview) cached.static = frames;
  else { cached.preview = preview; cached.frame = frames; }
  return frames;
}

function projectAnnotationFrame(scene, preview) {
  const dx = annotationOffsetForPreview(scene, preview);
  // Shared header and key baselines keep every panel aligned, including when
  // their labels, font sizes or cell heights differ.
  const cellHeight = Math.max(...scene.annotationPanels.map((panel) => panel.cellHeight));
  const headingHeight = Math.max(...scene.annotationPanels.map((panel) => panel.headingHeight));
  const titleDescent = Math.max(...scene.annotationPanels.map((panel) => panel.titleDescent));
  const titleOffset = headingHeight > 0 ? headingHeight + 6 + titleDescent : 0;
  const frames = scene.annotationPanels.map((panel) => {
    const rows = panel.rows.map((row) => ({ ...row,
      y: scene.clusters.get(row.uid).y + panel.rowOffset + clusterOffsetForPreview(preview, row.uid) }));
    let minY = Infinity, maxY = -Infinity;
    for (const row of rows) { minY = Math.min(minY, row.y); maxY = Math.max(maxY, row.y); }
    const top = minY - cellHeight / 2 - 10, bottom = maxY + cellHeight / 2 + 20;
    const groupMarks = panel.markerGroups ? groupPanelMarks(panel, rows) : null;
    return { ...panel, x: panel.x + dx, rows: groupMarks ? [] : rows,
      texts: [...(groupMarks?.texts ?? []), ...panel.header.map((item) => ({ ...item, y: (item.kind === "title" ? -titleOffset : item.y) + top })),
        ...panel.footer.map((item) => ({ ...item, y: item.y + bottom }))],
      rects: groupMarks?.rects ?? panel.key.map((item, keyIndex) => ({ ...item, keyIndex, y: item.y + bottom })) };
  });
  let minY = Infinity, maxY = -Infinity;
  for (const frame of frames) {
    const bounds = annotationPanelBounds(frame);
    minY = Math.min(minY, bounds.minY); maxY = Math.max(maxY, bounds.maxY);
  }
  return frames.map((frame) => ({ ...frame, verticalBounds: { minY, maxY } }));
}

function annotationFigureBounds(bounds, panels, clusters, frames = null) {
  if (!bounds || !panels.length) return bounds;
  const result = { ...bounds };
  for (const panel of frames || annotationPanelsForFrame({ annotationPanels: panels, clusters })) {
    const area = annotationPanelBounds(panel);
    result.maxX = Math.max(result.maxX, panel.x + panel.extentWidth);
    result.minY = Math.min(result.minY, area.minY);
    result.maxY = Math.max(result.maxY, area.maxY);
  }
  return result;
}

/** Panel area includes whitespace between rows, headings and the colour key. */
function annotationPanelBounds(panel) {
  const bounds = { minX: panel.x, maxX: panel.x + panel.width, minY: Infinity, maxY: -Infinity };
  if (panel.verticalBounds) return { ...bounds, ...panel.verticalBounds };
  for (const item of panel.texts) {
    bounds.minY = Math.min(bounds.minY, item.y + item.bounds.minY);
    bounds.maxY = Math.max(bounds.maxY, item.y + item.bounds.maxY);
  }
  for (const rect of panel.rects) {
    bounds.minY = Math.min(bounds.minY, rect.y);
    bounds.maxY = Math.max(bounds.maxY, rect.y + rect.height);
  }
  for (const row of panel.rows) {
    bounds.minY = Math.min(bounds.minY, row.y - panel.cellHeight / 2);
    bounds.maxY = Math.max(bounds.maxY, row.y + panel.cellHeight / 2);
  }
  return bounds;
}

/** Shared cell hit testing, independent of DOM elements or raster backends. */
function hitTestAnnotationCell(scene, point, preview = null) {
  if (!scene?.annotationPanels?.length) return null;
  const panels = annotationPanelsForFrame(scene, preview);
  for (let index = panels.length - 1; index >= 0; index--) {
    const panel = panels[index];
    if (point.x < panel.x || point.x > panel.x + panel.width) continue;
    for (const row of panel.rows) {
      if (Math.abs(point.y - row.y) > panel.cellHeight / 2) continue;
      const cell = row.cells.find((cell) => point.x >= panel.x + cell.x && point.x <= panel.x + cell.x + cell.width &&
        point.y >= row.y + cell.y && point.y <= row.y + cell.y + cell.height);
      if (cell) return { panelUid: panel.uid, title: panel.title, clusterUid: row.uid,
        clusterName: scene.clusters.get(row.uid).source.name || row.uid,
        column: cell.column, value: cell.value };
    }
  }
  return null;
}

// Chart data is JSON-like: it is also the format used for data/project export.
// Clone plain values at the boundary so chart edits never mutate caller-owned
// records, including nested link endpoints and user metadata.
function cloneDataValue(value) {
  if (Array.isArray(value)) return value.map(cloneDataValue);
  if (!value || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneDataValue(entry)]));
}

function normalizeGene(gene, locusUid, clusterUid) {
  return {
    ...gene,
    locusUid,
    clusterUid,
    bio: gene.bio || {
      start: gene.start,
      end: gene.end,
      strand: gene.strand,
    },
  };
}

function normalizeLocus(locus, clusterUid) {
  const bio = locus.bio || { start: locus.start, end: locus.end };
  return {
    ...locus,
    clusterUid,
    bio,
    start: 0,
    end: bio.end - bio.start,
    genes: locus.genes.map((gene) =>
      normalizeGene(gene, locus.uid, clusterUid)
    ),
  };
}

function normalizeChartData(data, treeConfig = {}) {
  const source = cloneDataValue(data);
  if (source.tree != null) {
    validateTree(source.tree, source.clusters);
    validateTreePresentation(source.tree, treeConfig);
  }
  validateAnnotationPanels(source.annotationPanels, source.clusters, { tree: source.tree });
  return {
    ...source,
    clusters: source.clusters.map((cluster) => ({
      ...cluster,
      loci: cluster.loci.map((locus) => normalizeLocus(locus, cluster.uid)),
    })),
    links: [...source.links],
    groups: source.groups?.map((group) => ({
      ...group,
      genes: group.genes ? [...group.genes] : group.genes,
    })),
  };
}

function validateTree(tree, clusters) {
  const fail = (message) => { throw new TypeError(`Invalid tree: ${message}`); };
  if (!tree || typeof tree !== "object" || !Array.isArray(tree.nodes)) fail("expected an object with nodes.");
  if (tree.rooted != null && typeof tree.rooted !== "boolean") fail("rooted must be a boolean or null.");
  const nodes = new Map();
  for (const node of tree.nodes) {
    if (!node || typeof node.uid !== "string" || !node.uid.trim()) fail("node IDs must be non-empty strings.");
    if (nodes.has(node.uid)) fail(`duplicate node ID '${node.uid}'.`);
    nodes.set(node.uid, node);
  }
  if (!nodes.has(tree.root)) fail(`root '${tree.root}' does not exist.`);
  const clusterIds = new Set(clusters.map(({ uid }) => uid));
  const seenClusters = new Set();
  const visited = new Set();
  const visiting = new Set();
  const visit = (uid, root = false) => {
    if (visiting.has(uid)) fail(`cycle at node '${uid}'.`);
    if (visited.has(uid)) fail(`node '${uid}' has more than one parent.`);
    const node = nodes.get(uid);
    if (!node) fail(`child '${uid}' does not exist.`);
    if (node.label !== undefined && typeof node.label !== "string") fail(`label for '${uid}' must be text.`);
    if (root && (node.branchLength !== undefined || node.support !== undefined)) fail("the root cannot have branchLength or support.");
    if (node.branchLength !== undefined && (!Number.isFinite(node.branchLength) || node.branchLength < 0)) fail(`branchLength for '${uid}' must be finite and non-negative.`);
    if (node.support !== undefined) {
      const support = node.support;
      if (!support || typeof support !== "object" || Array.isArray(support) || !Number.isFinite(support.value)) {
        fail(`support for '${uid}' must be an object with a finite value.`);
      }
      if (support.scale !== undefined && !["percent", "proportion", "unspecified"].includes(support.scale)) {
        fail(`support scale for '${uid}' must be percent, proportion or unspecified.`);
      }
      if ((support.scale === "percent" && (support.value < 0 || support.value > 100)) ||
          (support.scale === "proportion" && (support.value < 0 || support.value > 1))) {
        fail(`support for '${uid}' is outside its ${support.scale} scale.`);
      }
      if (support.type !== undefined && typeof support.type !== "string") fail(`support type for '${uid}' must be text.`);
    }
    visiting.add(uid);
    if (node.children !== undefined) {
      if (!Array.isArray(node.children) || !node.children.length || node.cluster !== undefined) fail(`internal node '${uid}' must have children and no cluster.`);
      for (const child of node.children) visit(child);
    } else {
      if (!node.cluster || !clusterIds.has(node.cluster)) fail(`leaf '${uid}' must reference an existing cluster.`);
      if (seenClusters.has(node.cluster)) fail(`cluster '${node.cluster}' is referenced more than once.`);
      seenClusters.add(node.cluster);
    }
    visiting.delete(uid); visited.add(uid);
  };
  visit(tree.root, true);
  if (visited.size !== nodes.size) fail("all nodes must be reachable from the root.");
  if (seenClusters.size !== clusterIds.size) fail("every plotted cluster must be referenced by exactly one leaf.");
  validateTreePresentation(tree);
  return tree;
}

const styleFields = new Set(["show", "title", "columns", "scale", "cellWidth", "cellHeight", "gap",
  "groups", "markerWidth", "laneGap", "fontSize", "missingColour", "headingRotation", "showColumnLabels", "showKey",
  "cellGap", "cellBorderWidth", "cellBorderColour", "width", "colour"]);
const fields = new Set([...styleFields, "values"]);
const fail$1 = (message) => { throw new TypeError(`Invalid annotation operation: ${message}`); };

const isAnnotationOperation = (operation) => typeof operation?.type === "string" && operation.type.startsWith("annotationPanels.");

function normalizeAnnotationOperation(data, operation) {
  const known = new Set((data.annotationPanels || []).map((panel) => panel.uid));
  if (operation.type === "annotationPanels.create") {
    if (!operation.panel || typeof operation.panel.uid !== "string" || !operation.panel.uid.trim() || known.has(operation.panel.uid)) fail$1("create requires a new, non-empty panel uid.");
    const index = operation.index ?? known.size;
    if (!Number.isInteger(index) || index < 0 || index > known.size) fail$1("index must be a valid panel insertion position.");
    return { type: operation.type, panel: structuredClone(operation.panel), index };
  }
  if (operation.type === "annotationPanels.reorder") {
    if (!Array.isArray(operation.ids) || operation.ids.length !== known.size || new Set(operation.ids).size !== known.size ||
        operation.ids.some((uid) => !known.has(uid))) fail$1("reorder must contain every panel uid exactly once.");
    return { type: operation.type, ids: [...operation.ids] };
  }
  if (operation.type === "annotationPanels.delete") {
    if (!Array.isArray(operation.ids) || !operation.ids.length || operation.ids.some((uid) => !known.has(uid))) fail$1("delete requires existing panel IDs.");
    return { type: operation.type, ids: [...new Set(operation.ids)] };
  }
  if (operation.type === "annotationPanels.replaceStyle") {
    if (!known.has(operation.uid) || !operation.style || typeof operation.style !== "object" ||
        Array.isArray(operation.style) || Object.keys(operation.style).some((key) => !styleFields.has(key))) fail$1("replaceStyle requires an existing panel and supported style fields.");
    return { type: operation.type, uid: operation.uid, style: structuredClone(operation.style) };
  }
  if (operation.type !== "annotationPanels.update") fail$1(`unsupported type '${operation.type}'.`);
  if (!Array.isArray(operation.ids) || !operation.ids.length || operation.ids.some((uid) => !known.has(uid))) fail$1("ids must reference existing panels.");
  const changes = operation.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || !Object.keys(changes).length ||
      Object.keys(changes).some((key) => !fields.has(key))) fail$1("changes contains unsupported fields.");
  return { type: operation.type, ids: [...new Set(operation.ids)], changes: structuredClone(changes) };
}

function applyAnnotationOperation(data, operation) {
  const panels = data.annotationPanels || [];
  if (operation.type === "annotationPanels.create") {
    data.annotationPanels = [...panels];
    data.annotationPanels.splice(operation.index, 0, structuredClone(operation.panel));
    return;
  }
  if (operation.type === "annotationPanels.delete") {
    data.annotationPanels = panels.filter((panel) => !operation.ids.includes(panel.uid));
    return;
  }
  if (operation.type === "annotationPanels.reorder") {
    const byId = new Map(panels.map((panel) => [panel.uid, panel]));
    data.annotationPanels = operation.ids.map((uid) => byId.get(uid));
    return;
  }
  data.annotationPanels = panels.map((panel) => operation.type === "annotationPanels.replaceStyle"
    ? panel.uid === operation.uid ? {
      ...Object.fromEntries(Object.entries(panel).filter(([key]) => !styleFields.has(key))),
      ...structuredClone(operation.style),
    } : panel
    : operation.ids.includes(panel.uid) ? { ...panel, ...structuredClone(operation.changes) } : panel);
}

function inverseAnnotationOperation(data, operation) {
  if (operation.type === "annotationPanels.create") return [{ type: "annotationPanels.delete", ids: [operation.panel.uid] }];
  if (operation.type === "annotationPanels.reorder") return [{ type: operation.type, ids: (data.annotationPanels || []).map((panel) => panel.uid) }];
  if (operation.type === "annotationPanels.delete") return data.annotationPanels.flatMap((panel, index) =>
    operation.ids.includes(panel.uid) ? [{ type: "annotationPanels.create", panel: structuredClone(panel), index }] : []);
  const ids = operation.type === "annotationPanels.replaceStyle" ? [operation.uid] : operation.ids;
  return data.annotationPanels.filter((panel) => ids.includes(panel.uid))
    .flatMap((panel) => [
      { type: "annotationPanels.replaceStyle", uid: panel.uid,
        style: structuredClone(Object.fromEntries(Object.entries(panel).filter(([key]) => styleFields.has(key)))) },
      ...(operation.type === "annotationPanels.update" && Object.hasOwn(operation.changes, "values")
        ? [{ type: "annotationPanels.update", ids: [panel.uid], changes: { values: structuredClone(panel.values) } }] : []),
    ]);
}

// The operation normalizer has already built this private candidate array.
function validateAnnotationChanges(data, panels) {
  if (panels === data.annotationPanels) return;
  validateAnnotationPanels(panels, data.clusters, { previousPanels: data.annotationPanels, tree: data.tree });
}

const svgViews = new WeakMap();

const sameItems = (one, two) => one.length === two.length && one.every((item, i) => item === two[i]);
const sameView = (one, two) => one.length === two.length && one.every((panel, i) => {
  const next = two[i];
  return panel.uid === next.uid && sameItems(panel.texts, next.texts) && sameItems(panel.rects, next.rects) &&
    panel.rows.length === next.rows.length && panel.rows.every((row, index) =>
      row.uid === next.rows[index].uid && row.firstCell === next.rows[index].firstCell && row.lastCell === next.rows[index].lastCell);
});

/** Camera motion only changes SVG joins when the visible row/column set changes. */
function updateSvgAnnotationViewport(plot, scene, preview, viewport) {
  if (!scene || plot.empty()) return;
  const panels = annotationPanelsInViewport(scene, preview, viewport), before = svgViews.get(plot.node());
  if (before?.scene === scene && before.preview === preview && sameView(before.panels, panels)) return;
  renderSvgAnnotations(plot, scene, { preview, panels });
}

function renderSvgAnnotations(plot, scene, { preview = null, transition = null, animate = false,
  viewport = null, panels: projected = null } = {}) {
  const view = projected || annotationPanelsInViewport(scene, preview, animate ? null : viewport);
  if (animate) svgViews.delete(plot.node());
  else svgViews.set(plot.node(), { scene, preview, panels: view });
  if (!scene.annotationPanels?.length) {
    plot.selectAll("g.annotationPanels").remove();
    return;
  }
  const moving = (selection) => animate ? selection.transition(transition) : selection.interrupt();
  const panels = plot.selectAll("g.annotationPanels").data([null]).join("g")
    .attr("class", "annotationPanels").attr("pointer-events", "none")
    .selectAll("g.annotationPanel").data(view, (panel) => panel.uid)
    .join("g").attr("class", "annotationPanel")
    .attr("font-family", (panel) => panel.fontFamily).attr("font-size", (panel) => panel.fontSize);
  moving(panels).attr("transform", (panel) => `translate(${panel.x},0)`);
  panels.each(function (panel) {
    const group = select(this);
    const rows = group.selectAll("g.annotationRow").data(panel.rows, (row) => row.uid).join("g")
      .attr("class", "annotationRow");
    moving(rows).attr("transform", (row) => `translate(0,${row.y})`);
    const cells = rows.selectAll("rect").data((row) =>
      row.cells.slice(row.firstCell ?? 0, row.lastCell ?? row.cells.length).flatMap((cell) => cell.rects)).join("rect");
    const key = group.selectAll("g.annotationKey").data([null]).join("g")
      .attr("class", "annotationKey").selectAll("rect").data(panel.rects).join("rect");
    for (const rects of [cells, key]) moving(rects)
      .attr("x", (item) => item.x).attr("y", (item) => item.y)
      .attr("width", (item) => item.width).attr("height", (item) => item.height).attr("fill", (item) => item.fill);
    const texts = group.selectAll("text").data(panel.texts).join("text")
      .text((item) => item.text).attr("text-anchor", (item) => item.anchor)
      .attr("font-weight", (item) => item.weight || 400).attr("fill", panel.textColour);
    moving(texts).attr("transform", (item) => `translate(${item.x},${item.y}) rotate(${item.rotation || 0})`);
  });
}

function drawCanvasAnnotations(context, scene, preview = null, { showGeometry = true, showLabels = true, viewport = null } = {}) {
  for (const panel of annotationPanelsInViewport(scene, preview, viewport, { geometry: showGeometry })) {
    context.save();
    context.translate(panel.x, 0);
    const rect = (item) => {
      context.fillStyle = item.fill;
      context.fillRect(item.x, item.y, item.width, item.height);
    };
    if (showGeometry) {
      for (const row of panel.rows) {
        context.save(); context.translate(0, row.y);
        for (let i = row.firstCell ?? 0; i < (row.lastCell ?? row.cells.length); i++) {
          for (const part of row.cells[i].rects) rect(part);
        }
        context.restore();
      }
      for (const item of panel.rects) rect(item);
    }
    for (const item of showLabels ? panel.texts : []) {
      context.save();
      context.translate(item.x, item.y);
      context.rotate((item.rotation || 0) * Math.PI / 180);
      context.font = `${item.weight || 400} ${panel.fontSize}px ${panel.fontFamily}`;
      context.fillStyle = panel.textColour;
      context.textAlign = item.anchor === "end" ? "right" : item.anchor === "middle" ? "center" : "left";
      context.textBaseline = "alphabetic";
      context.fillText(item.text, 0, 0);
      context.restore();
    }
    context.restore();
  }
}

const fail = (message) => { throw new TypeError(`Invalid chart operation: ${message}`); };
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const types = new Set(["tree.presentation.update", "tree.presentation.reset", "tree.presentation.restore"]);
const isTreeOperation = (operation) => types.has(operation?.type);

function normalizeTreeOperation(tree, operation) {
  if (!tree) fail("tree presentation edits require a loaded tree.");
  if (operation.type === "tree.presentation.restore") {
    return { type: operation.type, ...(own(operation, "presentation") ? { presentation: structuredClone(operation.presentation) } : {}) };
  }
  const { type, scope } = operation;
  if (!["tree", "node", "subtree", "manual"].includes(scope)) fail("unknown tree presentation scope.");
  if (scope === "manual" && type !== "tree.presentation.reset") fail("manual scope is only for resetting all manual styles.");
  if (scope === "tree" && type === "tree.presentation.reset") fail("use manual scope to reset all manual styles; update colouring to reset its policy.");
  let ids;
  if (["node", "subtree"].includes(scope)) {
    if (!Array.isArray(operation.ids) || !operation.ids.length) fail(`${scope} scope requires node IDs.`);
    ids = [...new Set(operation.ids)];
    const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
    for (const uid of ids) {
      if (!nodes.has(uid)) fail(`unknown tree node '${uid}'.`);
      if (scope === "subtree" && !nodes.get(uid).children) fail(`subtree '${uid}' is not internal.`);
    }
  } else if (operation.ids !== undefined) fail(`${scope} scope does not accept ids.`);
  const result = { type, scope, ...(ids ? { ids } : {}) };
  if (type === "tree.presentation.update") {
    if (!object(operation.changes) || !Object.keys(operation.changes).length) fail("tree presentation updates require changes.");
    const allowed = scope === "tree" ? ["colouring"] : scope === "subtree" ? ["branch"] : ["branch", "label"];
    if (Object.keys(operation.changes).some((key) => !allowed.includes(key))) fail("unsupported tree presentation update field.");
    const fields = { branch: ["colour", "width"], label: ["text", "colour", "fontSize", "fontWeight", "fontStyle"], colouring: ["mode", "cutHeight", "palette", "showCutLine"] };
    for (const [key, value] of Object.entries(operation.changes)) {
      if (value === null) continue;
      if (!object(value) || Object.keys(value).some((field) => !fields[key].includes(field))) {
        fail(`unsupported ${key} fields in tree presentation update.`);
      }
    }
    result.changes = structuredClone(operation.changes);
  }
  return result;
}

// Construct own properties rather than assigning UID keys onto prototypes.
function mergeSparse(previous, changes) {
  const entries = new Map(Object.entries(object(previous) ? previous : {}));
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) entries.delete(key);
    else if (object(value)) {
      const merged = mergeSparse(entries.get(key), value);
      if (Object.keys(merged).length) entries.set(key, merged);
      else entries.delete(key);
    } else entries.set(key, structuredClone(value));
  }
  return Object.fromEntries(entries);
}

function applyTreeOperation(tree, operation) {
  if (operation.type === "tree.presentation.restore") {
    if (own(operation, "presentation")) tree.presentation = structuredClone(operation.presentation);
    else delete tree.presentation;
  } else {
    let presentation = structuredClone(tree.presentation || {});
    if (operation.scope === "manual") {
      delete presentation.nodes;
      delete presentation.subtrees;
    } else if (operation.scope === "tree") presentation = mergeSparse(presentation, operation.changes);
    else {
      const key = operation.scope === "node" ? "nodes" : "subtrees";
      const records = new Map(Object.entries(presentation[key] || {}));
      for (const uid of operation.ids) {
        if (operation.type === "tree.presentation.reset") records.delete(uid);
        else {
          const record = mergeSparse(records.get(uid), operation.changes);
          if (Object.keys(record).length) records.set(uid, record);
          else records.delete(uid);
        }
      }
      if (records.size) presentation[key] = Object.fromEntries(records);
      else delete presentation[key];
    }
    if (Object.keys(presentation).length) tree.presentation = presentation;
    else delete tree.presentation;
  }
  invalidateTreePresentation(tree);
}

function inverseTreeOperation(tree) {
  return { type: "tree.presentation.restore", ...(own(tree, "presentation") ? { presentation: structuredClone(tree.presentation) } : {}) };
}

function validateTreeOperationBatch(tree, operations, config) {
  if (!operations.some(isTreeOperation)) return;
  const draft = { ...tree, ...(own(tree, "presentation") ? { presentation: structuredClone(tree.presentation) } : {}) };
  for (const operation of operations.filter(isTreeOperation)) {
    applyTreeOperation(draft, operation);
    validateTreePresentation(draft, config);
  }
}

// Public editing operations deliberately distinguish presentation updates from
// structural group edits. Group membership is exclusive: assigning a gene to
// one group removes it from every other group.
const fieldsForType = {
  "genes.update": new Set(["label", "colour", "name"]),
  "groups.update": new Set(["label", "subtitle", "colour", "hidden"]),
  "loci.update": new Set(["label", "name"]),
  "clusters.update": new Set(["label", "name"]),
  "links.update": new Set(["label", "colour", "hidden", "identity"]),
};

// Group edits only replace the group lookup; gene/link structure edits also
// invalidate the biological indexes and automatic grouping.
function operationEffects(operations) {
  let reindex = false, rebuildState = false;
  for (const { type } of operations) {
    if (type === "genes.delete" || type === "genes.restore") {
      reindex = "data"; rebuildState = true;
    } else if (type === "links.delete" || type === "links.restore") {
      reindex = "data";
    } else if (!reindex && ["groups.create", "groups.delete", "groups.merge"].includes(type)) {
      reindex = "groups";
    }
  }
  return { reindex, rebuildState };
}

function operationError(message) {
  return new TypeError(`Invalid chart operation: ${message}`);
}

function uniqueIds(value, description) {
  if (!Array.isArray(value) || !value.length) {
    throw operationError(`${description} requires a non-empty array`);
  }
  return [...new Set(value)];
}

function validateGeneIds(index, geneIds, description) {
  const ids = uniqueIds(geneIds, description);
  for (const uid of ids) {
    if (!index.geneById.has(uid)) throw operationError(`${description} refers to unknown gene ${uid}`);
  }
  return ids;
}

function validateOptionalGeneIds(index, geneIds, description) {
  if (!Array.isArray(geneIds)) throw operationError(`${description} requires a geneIds array`);
  const ids = [...new Set(geneIds)];
  for (const uid of ids) {
    if (!index.geneById.has(uid)) throw operationError(`${description} refers to unknown gene ${uid}`);
  }
  return ids;
}

function recordsForOperation(index, type) {
  if (type === "genes.update") return index.geneById;
  if (type === "groups.update") return index.groupById;
  if (type === "loci.update") return index.locusById;
  if (type === "links.update") return index.linkById;
  return index.clusterById;
}

function validateUpdate(operation, index, groupIds) {
  const fields = fieldsForType[operation.type];
  if (!fields) return null;
  const ids = uniqueIds(operation.ids, operation.type);
  if (!operation.changes || typeof operation.changes !== "object" || Array.isArray(operation.changes)) {
    throw operationError(`${operation.type} requires a changes object`);
  }
  const changeKeys = Object.keys(operation.changes);
  if (!changeKeys.length || changeKeys.some((key) => !fields.has(key))) {
    throw operationError(`${operation.type} contains an unsupported field`);
  }
  if (operation.type === "links.update" && "identity" in operation.changes) {
    const identity = Number(operation.changes.identity);
    if (!Number.isFinite(identity) || identity < 0 || identity > 1) {
      throw operationError("links.update identity must be a number from 0 to 1");
    }
    operation = { ...operation, changes: { ...operation.changes, identity } };
  }
  const records = recordsForOperation(index, operation.type);
  for (const uid of ids) {
    if (operation.type === "groups.update") requireKnownGroup(groupIds, uid, operation.type);
    if (!records.has(uid)) throw operationError(`${operation.type} refers to unknown ID ${uid}`);
  }
  return { type: operation.type, ids, changes: { ...operation.changes } };
}

function requireKnownGroup(groupIds, uid, type) {
  if (!groupIds.has(uid)) throw operationError(`${type} refers to unknown group ${uid}`);
}

function validateStructuralGroupOperation(operation, index, groupIds) {
  switch (operation.type) {
    case "groups.assignGenes": {
      requireKnownGroup(groupIds, operation.groupId, operation.type);
      return { type: operation.type, groupId: operation.groupId, geneIds: validateGeneIds(index, operation.geneIds, operation.type) };
    }
    case "groups.unassignGenes":
      return { type: operation.type, geneIds: validateGeneIds(index, operation.geneIds, operation.type) };
    case "groups.delete": {
      const ids = uniqueIds(operation.ids, operation.type);
      ids.forEach((uid) => requireKnownGroup(groupIds, uid, operation.type));
      ids.forEach((uid) => groupIds.delete(uid));
      return { type: operation.type, ids };
    }
    case "groups.merge": {
      requireKnownGroup(groupIds, operation.targetId, operation.type);
      const sourceIds = uniqueIds(operation.sourceIds, operation.type).filter((uid) => uid !== operation.targetId);
      if (!sourceIds.length) throw operationError(`${operation.type} requires at least one source group other than the target`);
      sourceIds.forEach((uid) => requireKnownGroup(groupIds, uid, operation.type));
      sourceIds.forEach((uid) => groupIds.delete(uid));
      return { type: operation.type, targetId: operation.targetId, sourceIds };
    }
    case "groups.reorder": {
      const ids = uniqueIds(operation.ids, operation.type);
      if (ids.length !== groupIds.size || ids.some((uid) => !groupIds.has(uid))) {
        throw operationError(`${operation.type} must contain every group exactly once`);
      }
      return { type: operation.type, ids };
    }
    case "groups.create": {
      const group = operation.group;
      if (!group || typeof group !== "object" || Array.isArray(group)) throw operationError("groups.create requires a group object");
      if (group.uid === undefined || group.uid === null || group.uid === "") throw operationError("groups.create requires group.uid");
      if (groupIds.has(group.uid)) throw operationError(`groups.create refers to existing group ${group.uid}`);
      const unsupported = Object.keys(group).filter((key) => !["uid", "label", "subtitle", "colour", "hidden"].includes(key));
      if (unsupported.length) throw operationError("groups.create contains an unsupported group field");
      groupIds.add(group.uid);
      return {
        type: operation.type,
        group: {
          uid: group.uid,
          ...(group.label !== undefined ? { label: group.label } : {}),
          ...(group.subtitle !== undefined ? { subtitle: group.subtitle } : {}),
          ...(group.colour !== undefined ? { colour: group.colour } : {}),
          ...(group.hidden !== undefined ? { hidden: Boolean(group.hidden) } : {}),
        },
        geneIds: operation.geneIds === undefined ? [] : validateOptionalGeneIds(index, operation.geneIds, operation.type),
      };
    }
    default:
      throw operationError(`unsupported type ${String(operation.type)}`);
  }
}

function validateOperation(operation, index, groupIds) {
  if (!operation || typeof operation !== "object") throw operationError("each operation must be an object");
  if (operation.type === "genes.delete") {
    return { type: operation.type, ids: validateGeneIds(index, operation.ids, operation.type) };
  }
  if (operation.type === "links.delete") {
    const ids = uniqueIds(operation.ids, operation.type);
    for (const uid of ids) {
      if (!index.linkById.has(uid)) throw operationError(`${operation.type} refers to unknown link ${uid}`);
    }
    return { type: operation.type, ids };
  }
  // Restore operations are generated by chart history. They deliberately are
  // not part of the documented editing API, but keeping them serializable
  // means undo never needs a full copy of a chart's links or genes.
  if (operation.type === "genes.restore") {
    if (!Array.isArray(operation.records) || !operation.records.length) {
      throw operationError("genes.restore requires records");
    }
    return {
      type: operation.type,
      records: operation.records.map(({ locusId, index: position, gene }) => {
        if (!index.locusById.has(locusId) || !gene || typeof gene !== "object") {
          throw operationError("genes.restore contains an invalid record");
        }
        return { locusId, index: Math.max(0, Math.trunc(position) || 0), gene: structuredClone(gene) };
      }),
    };
  }
  if (operation.type === "links.restore") {
    if (!Array.isArray(operation.records) || !operation.records.length) {
      throw operationError("links.restore requires records");
    }
    return {
      type: operation.type,
      records: operation.records.map(({ index: position, link }) => {
        if (!link || typeof link !== "object") throw operationError("links.restore contains an invalid record");
        return { index: Math.max(0, Math.trunc(position) || 0), link: structuredClone(link) };
      }),
    };
  }
  return validateUpdate(operation, index, groupIds) || validateStructuralGroupOperation(operation, index, groupIds);
}

function removeGenesFromGroups(groups, geneIds) {
  const genes = new Set(geneIds);
  groups.forEach((group) => {
    group.genes = (group.genes || []).filter((uid) => !genes.has(uid));
  });
}

function assignGenes(groups, groupId, geneIds) {
  removeGenesFromGroups(groups, geneIds);
  const group = groups.find((candidate) => candidate.uid === groupId);
  group.genes = [...new Set([...(group.genes || []), ...geneIds])];
}

function applyOperation(data, index, operation) {
  const updateRecords = fieldsForType[operation.type] && recordsForOperation(index, operation.type);
  if (updateRecords) {
    operation.ids.forEach((uid) => Object.assign(updateRecords.get(uid), operation.changes));
    return;
  }
  switch (operation.type) {
    case "genes.delete": {
      const ids = new Set(operation.ids);
      data.clusters.forEach((cluster) => cluster.loci.forEach((locus) => {
        locus.genes = locus.genes.filter((gene) => !ids.has(gene.uid));
      }));
      return;
    }
    case "genes.restore": {
      const loci = index.locusById;
      for (const { locusId, index: position, gene } of operation.records) {
        const locus = loci.get(locusId);
        locus.genes.splice(Math.min(position, locus.genes.length), 0, structuredClone(gene));
      }
      return;
    }
    case "links.delete": {
      const ids = new Set(operation.ids);
      data.links = data.links.filter((link) => !ids.has(link.uid));
      return;
    }
    case "links.restore":
      for (const { index: position, link } of operation.records) {
        data.links.splice(Math.min(position, data.links.length), 0, structuredClone(link));
      }
      return;
    case "groups.assignGenes":
      assignGenes(data.groups, operation.groupId, operation.geneIds);
      return;
    case "groups.unassignGenes":
      removeGenesFromGroups(data.groups, operation.geneIds);
      return;
    case "groups.create":
      removeGenesFromGroups(data.groups, operation.geneIds);
      data.groups.push({ ...operation.group, genes: [...operation.geneIds] });
      return;
    case "groups.delete": {
      const ids = new Set(operation.ids);
      data.groups = data.groups.filter((group) => !ids.has(group.uid));
      return;
    }
    case "groups.merge": {
      const target = data.groups.find((group) => group.uid === operation.targetId);
      const sourceIds = new Set(operation.sourceIds);
      const sourceGenes = data.groups.filter((group) => sourceIds.has(group.uid)).flatMap((group) => group.genes || []);
      target.genes = [...new Set([...(target.genes || []), ...sourceGenes])];
      data.groups = data.groups.filter((group) => !sourceIds.has(group.uid));
      return;
    }
    case "groups.reorder": {
      const groups = new Map(data.groups.map((group) => [group.uid, group]));
      data.groups = operation.ids.map((uid) => groups.get(uid));
      return;
    }
  }
}

function publicGroup(group) {
  return Object.fromEntries(["uid", "label", "subtitle", "colour", "hidden"]
    .filter((key) => key in group)
    .map((key) => [key, structuredClone(group[key])]));
}

function inverseOperation(data, index, operation) {
  const records = fieldsForType[operation.type] && recordsForOperation(index, operation.type);
  if (records) {
    const fields = Object.keys(operation.changes);
    return operation.ids.map((uid) => {
      const record = records.get(uid);
      return {
        type: operation.type,
        ids: [record.uid],
        changes: Object.fromEntries(fields.map((field) => [field, structuredClone(record[field])])),
      };
    });
  }
  if (operation.type === "genes.delete") {
    const removed = new Set(operation.ids);
    return [{
      type: "genes.restore",
      records: data.clusters.flatMap((cluster) => cluster.loci.flatMap((locus) => locus.genes
        .map((gene, position) => removed.has(gene.uid) && { locusId: locus.uid, index: position, gene: structuredClone(gene) })
        .filter(Boolean))),
    }];
  }
  if (operation.type === "links.delete") {
    const removed = new Set(operation.ids);
    return [{
      type: "links.restore",
      records: data.links.map((link, position) => removed.has(link.uid) && { index: position, link: structuredClone(link) }).filter(Boolean),
    }];
  }
  if (operation.type === "groups.reorder") {
    return [{ type: "groups.reorder", ids: data.groups.map((group) => group.uid) }];
  }
  if (operation.type === "groups.create") {
    const affected = new Set(operation.geneIds);
    const restore = data.groups
      .map((group) => ({ group, geneIds: (group.genes || []).filter((uid) => affected.has(uid)) }))
      .filter(({ geneIds }) => geneIds.length);
    return [
      { type: "groups.delete", ids: [operation.group.uid] },
      ...restore.map(({ group, geneIds }) => ({ type: "groups.assignGenes", groupId: group.uid, geneIds })),
    ];
  }
  if (operation.type === "groups.assignGenes" || operation.type === "groups.unassignGenes") {
    const affected = new Set(operation.geneIds);
    const restore = data.groups
      .map((group) => ({ group, geneIds: (group.genes || []).filter((uid) => affected.has(uid)) }))
      .filter(({ geneIds }) => geneIds.length);
    return [
      { type: "groups.unassignGenes", geneIds: operation.geneIds },
      ...restore.map(({ group, geneIds }) => ({ type: "groups.assignGenes", groupId: group.uid, geneIds })),
    ];
  }
  if (operation.type === "groups.delete") {
    const removed = new Set(operation.ids);
    const groups = data.groups.filter((group) => removed.has(group.uid));
    return [
      ...groups.map((group) => ({ type: "groups.create", group: publicGroup(group), geneIds: [...(group.genes || [])] })),
      { type: "groups.reorder", ids: data.groups.map((group) => group.uid) },
    ];
  }
  if (operation.type === "groups.merge") {
    const sourceIds = new Set(operation.sourceIds);
    const previous = data.groups.filter((group) => sourceIds.has(group.uid) || group.uid === operation.targetId);
    const target = previous.find((group) => group.uid === operation.targetId);
    const sources = previous.filter((group) => group.uid !== operation.targetId);
    const geneIds = [...new Set(previous.flatMap((group) => group.genes || []))];
    return [
      ...(geneIds.length ? [{ type: "groups.unassignGenes", geneIds }] : []),
      ...(target?.genes?.length ? [{ type: "groups.assignGenes", groupId: target.uid, geneIds: [...target.genes] }] : []),
      ...sources.map((group) => ({ type: "groups.create", group: publicGroup(group), geneIds: [...(group.genes || [])] })),
      { type: "groups.reorder", ids: data.groups.map((group) => group.uid) },
    ];
  }
  return [];
}

/**
 * Validate then apply a serializable batch of chart edits. Structural group
 * edits are validated against a virtual group ID set first, so a malformed
 * later operation cannot leave earlier records partially modified.
 */
function applyChartOperations(data, index, operations, treeConfig = {}) {
  if (!Array.isArray(operations) || !operations.length) {
    throw operationError("operations must be a non-empty array");
  }
  const groupIds = new Set(index.groupById.keys());
  const annotationDraft = { annotationPanels: data.annotationPanels };
  const applied = operations.map((operation) => {
    if (isTreeOperation(operation)) return normalizeTreeOperation(data.tree, operation);
    if (isAnnotationOperation(operation)) {
      const normalized = normalizeAnnotationOperation(annotationDraft, operation);
      applyAnnotationOperation(annotationDraft, normalized);
      return normalized;
    }
    return validateOperation(operation, index, groupIds);
  });
  validateTreeOperationBatch(data.tree, applied, treeConfig);
  validateAnnotationChanges(data, annotationDraft.annotationPanels);
  const hasStructuralGroupEdit = applied.some((operation) => operation.type !== "groups.update" && operation.type.startsWith("groups."));
  const inverse = [];
  for (const operation of applied) {
    if (isAnnotationOperation(operation)) {
      inverse.unshift(...inverseAnnotationOperation(data, operation));
      applyAnnotationOperation(data, operation);
      continue;
    }
    if (isTreeOperation(operation)) {
      inverse.unshift(inverseTreeOperation(data.tree));
      applyTreeOperation(data.tree, operation);
      continue;
    }
    inverse.unshift(...inverseOperation(data, index, operation));
    applyOperation(data, index, operation);
  }
  // Link-derived grouping is useful for an untouched chart, but a deliberate
  // membership edit makes the user's group assignments authoritative.
  if (hasStructuralGroupEdit) data.config = { ...(data.config || {}), updateGroups: false };
  return { data, operations: applied, inverse, effects: operationEffects(applied) };
}

const palettes = {
  light: { mode: "light", background: "#ffffff", foreground: "#20252c", muted: "#687586",
    branch: "#555555", guide: "#999999", outline: "#111111", surface: "#ffffff", border: "#cbd3de", missing: "#eeeeee", subtle: "#f3f6fa", hover: "#e3ecf8", selection: "#d6e6fc", accent: "#1677ff", danger: "#b42318" },
  dark: { mode: "dark", background: "#171b22", foreground: "#e5eaf1", muted: "#a0adbd",
    branch: "#bac4d1", guide: "#748193", outline: "#c9d2df", surface: "#232a35", border: "#465365", missing: "#39414e", subtle: "#293241", hover: "#354660", selection: "#3a5276", accent: "#85b7ff", danger: "#ffaaa3" },
};

function resolveTheme(mode = "auto") {
  const dark = mode === "dark" || mode === "auto" && globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return palettes[dark ? "dark" : "light"];
}

/** Figure colours are independent of the interface/system theme. */
function figureConfig(config) {
  if (config.figureStyle) return config;
  const theme = { background: config.plot?.background ?? "#ffffff", foreground: "#000000",
    outline: "#000000", branch: "#555555", guide: "#999999",
    muted: "#687586", missing: "#eeeeee" };
  return { ...config, figureStyle: theme,
    tree: { ...config.tree, textColour: theme.foreground,
      branch: { ...config.tree?.branch, colour: config.tree?.branch?.colour ?? theme.branch },
      leafGuide: { ...config.tree?.leafGuide, colour: config.tree?.leafGuide?.colour ?? theme.guide } },
    gene: { ...config.gene, shape: { ...config.gene?.shape, stroke: config.gene?.shape?.stroke ?? theme.outline } },
    locus: { ...config.locus, trackBar: { ...config.locus?.trackBar, colour: config.locus?.trackBar?.colour ?? theme.outline } },
    scaleBar: { ...config.scaleBar, colour: config.scaleBar?.colour ?? theme.foreground },
  };
}

/** Scoped CSS keeps multiple independently themed charts on one page possible. */
function applyTheme(element, theme) {
  if (!element) return;
  element.dataset.clustermapTheme = theme.mode;
  element.style.colorScheme = theme.mode;
  for (const [key, value] of Object.entries(theme)) if (key !== "mode") element.style.setProperty(`--cm-${key}`, value);
  const doc = element.ownerDocument;
  if (doc.getElementById("clustermap-theme-style")) return;
  const style = doc.createElement("style"); style.id = "clustermap-theme-style";
  style.textContent = `
[data-clustermap-theme] { color:var(--cm-foreground); background:var(--cm-background); }
[data-clustermap-theme] :is(.tooltip,.cm-annotation-menu,.cm-annotation-hidden,.annotation-tooltip) { color:var(--cm-foreground)!important; background:var(--cm-surface)!important; border-color:var(--cm-border)!important; }
[data-clustermap-theme] :is(button,select,input:not([type=color]):not([type=checkbox]),textarea):not(.cm-data-ui *) { color:var(--cm-foreground)!important; background:var(--cm-surface)!important; border-color:var(--cm-border)!important; }
[data-clustermap-theme] button:hover:not(.cm-data-ui *) { background:var(--cm-hover)!important; }
[data-clustermap-theme] button:disabled { opacity:.45; }
clinker-editor[data-clustermap-theme] { background:var(--cm-surface); color:var(--cm-foreground); border-color:var(--cm-border); }
[data-clustermap-theme] .cm-annotation-menu :is(p,summary) { color:var(--cm-muted); }
[data-clustermap-theme] :is(svg.clusterMap,canvas.clusterMapCanvas,canvas.clusterMapWebGpuOverlay) { position:relative; z-index:1; background:transparent; color-scheme:light; }
[data-clustermap-theme] .clusterMapFigureSurface { z-index:0; box-shadow:0 2px 12px rgba(0,0,0,.2); outline:1px solid var(--cm-border); }
[data-clustermap-theme] .clusterMapFigureDimensions { z-index:2; color:var(--cm-muted); font:12px/20px system-ui,sans-serif; white-space:nowrap; }
[data-clustermap-theme] canvas.clusterMapMinimap { color-scheme:light; }
`;
  doc.head.append(style);
}

function isObject(a) {
  return !!a && a.constructor === Object;
}

function updateConfig(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (!target.hasOwnProperty(key)) continue;
    if (isObject(value)) {
      updateConfig(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function rgbaToRgb(rgba, opacity = 0.6) {
  let colour = color(rgba).rgb();
  return rgb(
    (1 - opacity) * 255 + opacity * colour.r,
    (1 - opacity) * 255 + opacity * colour.g,
    (1 - opacity) * 255 + opacity * colour.b
  );
}

const DEFAULT_CELL_WIDTH = 100;
const DEFAULT_CELL_HEIGHT = 50;

function cellKey(x, y) {
  return `${x},${y}`;
}

function validBounds(bounds) {
  return (
    bounds &&
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxY)
  );
}

function intersects(one, two) {
  return (
    one.minX <= two.maxX &&
    one.maxX >= two.minX &&
    one.minY <= two.maxY &&
    one.maxY >= two.minY
  );
}

function cellsForBounds(bounds, { cellWidth, cellHeight }) {
  if (!validBounds(bounds)) return [];
  const cells = [];
  const minColumn = Math.floor(bounds.minX / cellWidth);
  const maxColumn = Math.floor(bounds.maxX / cellWidth);
  const minRow = Math.floor(bounds.minY / cellHeight);
  const maxRow = Math.floor(bounds.maxY / cellHeight);
  for (let column = minColumn; column <= maxColumn; column += 1) {
    for (let row = minRow; row <= maxRow; row += 1) cells.push(cellKey(column, row));
  }
  return cells;
}

/**
 * Index world-space rectangular extents in a uniform grid. The index stores
 * IDs only; callers retain ownership of the scene records and draw order.
 */
function createSpatialIndex(
  records,
  { cellWidth = DEFAULT_CELL_WIDTH, cellHeight = DEFAULT_CELL_HEIGHT } = {}
) {
  const cells = new Map();
  const boundsById = new Map();
  const orderById = new Map();
  let order = 0;
  for (const [id, bounds] of records) {
    // Retain painter order even for currently invisible records. A scene
    // patch may reveal their bounds later (e.g. a newly adjacent link).
    orderById.set(id, order);
    order += 1;
    if (!validBounds(bounds)) continue;
    boundsById.set(id, bounds);
    for (const key of cellsForBounds(bounds, { cellWidth, cellHeight })) {
      if (!cells.has(key)) cells.set(key, new Set());
      cells.get(key).add(id);
    }
  }
  return { cells, boundsById, orderById, cellWidth, cellHeight };
}

/**
 * Return a copy of an index with a small set of existing records moved or
 * removed. Scene patches use this to retain spatial lookup for untouched
 * records instead of rebuilding an index for the entire chart.
 */
function patchSpatialIndex(index, entries) {
  if (!index || !entries?.length) return index;
  const cells = new Map(index.cells);
  const boundsById = new Map(index.boundsById);
  const changedCells = new Set();
  const mutableCell = (key) => {
    if (!changedCells.has(key) || !cells.has(key)) {
      cells.set(key, new Set(cells.get(key)));
      changedCells.add(key);
    }
    return cells.get(key);
  };

  for (const [id, bounds] of entries) {
    const oldBounds = boundsById.get(id);
    for (const key of cellsForBounds(oldBounds, index)) {
      const cell = mutableCell(key);
      cell.delete(id);
      if (cell.size === 0) cells.delete(key);
    }
    if (!validBounds(bounds)) {
      boundsById.delete(id);
      continue;
    }
    boundsById.set(id, bounds);
    for (const key of cellsForBounds(bounds, index)) {
      const cell = mutableCell(key);
      cell.add(id);
    }
  }
  return { ...index, cells, boundsById };
}

/** Return candidate IDs whose exact bounds intersect a world-space viewport. */
function queryViewport(index, viewport) {
  if (!validBounds(viewport)) return new Set();
  const matches = new Set();
  const minColumn = Math.floor(viewport.minX / index.cellWidth);
  const maxColumn = Math.floor(viewport.maxX / index.cellWidth);
  const minRow = Math.floor(viewport.minY / index.cellHeight);
  const maxRow = Math.floor(viewport.maxY / index.cellHeight);
  for (let column = minColumn; column <= maxColumn; column += 1) {
    for (let row = minRow; row <= maxRow; row += 1) {
      for (const id of index.cells.get(cellKey(column, row)) || []) {
        if (intersects(index.boundsById.get(id), viewport)) matches.add(id);
      }
    }
  }
  return matches;
}

/**
 * Return viewport candidates in the order they were added to the index. This
 * preserves deterministic painter order while allowing a renderer to visit
 * only visible records.
 */
function queryViewportOrdered(index, viewport) {
  return [...queryViewport(index, viewport)].sort(
    (left, right) => index.orderById.get(left) - index.orderById.get(right)
  );
}

function pointCandidates(index, point) {
  return [...queryViewport(index, {
    minX: point.x,
    maxX: point.x,
    minY: point.y,
    maxY: point.y,
  })].filter((id) => {
    const bounds = index.boundsById.get(id);
    return (
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY
    );
  });
}

/** Return point candidates in the order they were added to the index. */
function queryPointOrdered(index, point) {
  return pointCandidates(index, point).sort(
    (left, right) => index.orderById.get(left) - index.orderById.get(right)
  );
}

function containsRect({ x, y, width, height }, point) {
  return (
    point.x >= x &&
    point.x <= x + width &&
    point.y >= y &&
    point.y <= y + height
  );
}

function pointOnSegment(point, start, end) {
  const cross =
    (point.y - start.y) * (end.x - start.x) -
    (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > Number.EPSILON) return false;
  return (
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  );
}

function containsPolygon({ points }, point) {
  let inside = false;
  for (let index = 0, previous = points.length - 2; index < points.length; previous = index, index += 2) {
    const start = { x: points[previous], y: points[previous + 1] };
    const end = { x: points[index], y: points[index + 1] };
    if (pointOnSegment(point, start, end)) return true;
    const crosses = (start.y > point.y) !== (end.y > point.y);
    if (crosses && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x) {
      inside = !inside;
    }
  }
  return inside;
}

function contains(region, point) {
  if (region.type === "rect") return containsRect(region, point);
  if (region.type === "polygon") return containsPolygon(region, point);
  return false;
}

/**
 * Returns the topmost semantic interaction target at a chart-world point.
 * The spatial indexes limit precise region tests to records whose extents
 * contain the pointer. Reverse painter order gives genes and trim handles
 * precedence over a locus move region.
 */
function hitTest(scene, point) {
  if (scene.index?.genes && scene.index?.hitLoci && scene.hitRegions.genes && scene.hitRegions.loci) {
    for (const uid of queryPointOrdered(scene.index.genes, point).reverse()) {
      const region = scene.hitRegions.genes.get(uid);
      if (region && contains(region, point)) return region;
    }
    for (const uid of queryPointOrdered(scene.index.hitLoci, point).reverse()) {
      const regions = scene.hitRegions.loci.get(uid);
      for (const region of [regions?.trimRight, regions?.trimLeft, regions?.move]) {
        if (region && contains(region, point)) return region;
      }
    }
    return null;
  }
  for (let index = scene.hitRegions.all.length - 1; index >= 0; index -= 1) {
    const region = scene.hitRegions.all[index];
    if (contains(region, point)) return region;
  }
  return null;
}

function getGenePolygonCoordinates(gene, { scaleX, shape }) {
  const scaledStart = scaleX(gene.start);
  const scaledEnd = scaleX(gene.end);
  const geneLength = scaledEnd - scaledStart;
  const bottom = shape.tipHeight * 2 + shape.bodyHeight;
  const midpoint = bottom / 2;
  const third = shape.tipHeight + shape.bodyHeight;
  let points;

  if (gene.strand === 1) {
    const shaft = scaledEnd - shape.tipLength;
    points = [
      scaledStart,
      shape.tipHeight,
      shaft,
      shape.tipHeight,
      shaft,
      0,
      scaledEnd,
      midpoint,
      shaft,
      bottom,
      shaft,
      third,
      scaledStart,
      third,
    ];
    if (geneLength < shape.tipLength) {
      [2, 4, 8, 10].forEach((index) => (points[index] = scaledStart));
    }
  } else {
    const shaft = scaledStart + shape.tipLength;
    points = [
      scaledEnd,
      shape.tipHeight,
      shaft,
      shape.tipHeight,
      shaft,
      0,
      scaledStart,
      midpoint,
      shaft,
      bottom,
      shaft,
      third,
      scaledEnd,
      third,
    ];
    if (geneLength < shape.tipLength) {
      [2, 4, 8, 10].forEach((index) => (points[index] = scaledEnd));
    }
  }

  return points;
}

function getGeneLabelLayout(gene, { scaleX, shape, label }) {
  const scaledLength = scaleX(gene.end) - scaleX(gene.start);
  const x = scaleX(gene.start) + scaledLength * label.start;
  let y;

  if (label.position === "middle") {
    y = shape.tipHeight + shape.bodyHeight / 2;
  } else if (label.position === "bottom") {
    y = 2 * shape.tipHeight + shape.bodyHeight + label.spacing;
  } else {
    y = -label.spacing;
  }

  return {
    x,
    y,
    rotation: ["start", "middle"].includes(label.anchor)
      ? -label.rotation
      : label.rotation,
  };
}

function getGeneLabelTransform(gene, options) {
  const { x, y, rotation } = getGeneLabelLayout(gene, options);
  return `translate(${x}, ${y}) rotate(${rotation})`;
}

function getGeneLabelDy(position) {
  switch (position) {
    case "top":
      return "-0.4em";
    case "middle":
      return "0.4em";
    case "bottom":
      return "0.8em";
    default:
      return undefined;
  }
}

function worldPolygon(points, x, y) {
  return points.map((point, index) => point + (index % 2 === 0 ? x : y));
}

function boundsFromPoints(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < points.length; index += 2) {
    minX = Math.min(minX, points[index]);
    maxX = Math.max(maxX, points[index]);
    minY = Math.min(minY, points[index + 1]);
    maxY = Math.max(maxY, points[index + 1]);
  }
  return { minX, maxX, minY, maxY };
}

function boundsFromLinkAnchors(anchors) {
  if (!anchors) return null;
  const [ax1, ax2, ay, bx1, bx2, by] = anchors;
  return {
    minX: Math.min(ax1, ax2, bx1, bx2),
    maxX: Math.max(ax1, ax2, bx1, bx2),
    minY: Math.min(ay, by),
    maxY: Math.max(ay, by),
  };
}

function boundsFromRegions(regions) {
  if (!regions.length) return null;
  return {
    minX: Math.min(...regions.map((region) => region.x)),
    maxX: Math.max(...regions.map((region) => region.x + region.width)),
    minY: Math.min(...regions.map((region) => region.y)),
    maxY: Math.max(...regions.map((region) => region.y + region.height)),
  };
}

function formatKilobases(basePairs) {
  return `${+(basePairs / 1000).toFixed(1)}kb`;
}

function legendPositionForBounds(bounds, legend) {
  if (legend.placement === "bottom") {
    return {
      // Lower chrome shares the fixed chart baseline. Unlike a right-side
      // legend it must not slide horizontally when a locus is dragged.
      x: 0,
      y: bounds.maxY + legend.bottomOffset + legend.marginTop,
    };
  }
  return { x: bounds.maxX + legend.marginLeft, y: 0 };
}

function extendBounds(bounds, minX, maxX, minY, maxY) {
  return {
    minX: Math.min(bounds.minX, minX),
    maxX: Math.max(bounds.maxX, maxX),
    minY: Math.min(bounds.minY, minY),
    maxY: Math.max(bounds.maxY, maxY),
  };
}

// This deliberately excludes text-width measurement: Canvas supplies exact
// glyph metrics while fitting, and SVG uses its native bounding box. The scene
// still records the chrome's structural footprint for renderer-neutral camera
// and minimap work.
function figureBoundsForChrome(bounds, chrome) {
  if (!bounds || !chrome) return bounds;
  let figureBounds = { ...bounds };
  const { legend, scaleBar, colourBar } = chrome;
  if (legend?.visible) {
    for (const item of legend.items) {
      const x = legend.position.x + item.x;
      const y = legend.position.y + item.y;
      figureBounds = extendBounds(
        figureBounds,
        x - item.radius,
        x + legend.columnWidth,
        y,
        y + (legend.hasSubtitles ? legend.entryHeight : legend.fontSize)
      );
    }
  }
  if (scaleBar?.visible) {
    figureBounds = extendBounds(
      figureBounds,
      scaleBar.position.x,
      scaleBar.position.x + scaleBar.length,
      scaleBar.position.y,
      scaleBar.position.y + scaleBar.height + scaleBar.fontSize + 5
    );
  }
  if (colourBar?.visible) {
    figureBounds = extendBounds(
      figureBounds,
      colourBar.position.x,
      colourBar.position.x + colourBar.width,
      colourBar.position.y,
      colourBar.position.y + colourBar.height + colourBar.fontSize + 5
    );
  }
  return figureBounds;
}

function buildChrome(bounds, genes, chrome) {
  if (!bounds || !chrome) return null;

  const visibleGroupIds = new Set();
  for (const gene of genes.values()) {
    if (!gene.visible) continue;
    const groupUid = chrome.legend.groupForGene(gene.source.uid);
    if (groupUid !== null) visibleGroupIds.add(groupUid);
  }

  const groups = chrome.legend.groups.filter(
    (group) => !group.hidden && visibleGroupIds.has(group.uid)
  );
  const scaleBarLength = chrome.scaleBar.coordinateFor(chrome.scaleBar.basePair);
  const scaleBar = {
    textColour: chrome.scaleBar.textColour,
    visible: chrome.scaleBar.show,
    position: {
      x: chrome.scaleBar.x,
      y: bounds.maxY + chrome.scaleBar.marginTop,
    },
    length: scaleBarLength,
    basePair: chrome.scaleBar.basePair,
    height: chrome.scaleBar.height,
    middle: chrome.scaleBar.height / 2,
    label: formatKilobases(chrome.scaleBar.basePair),
    colour: chrome.scaleBar.colour,
    strokeWidth: chrome.scaleBar.strokeWidth,
    fontSize: chrome.scaleBar.fontSize,
    fontFamily: chrome.scaleBar.fontFamily,
  };

  const identityDomain = chrome.colourBar.domain || [0, 1];
  const colourBar = {
    textColour: chrome.colourBar.textColour,
    visible: chrome.colourBar.show && !chrome.link.groupColour && chrome.link.show,
    position: {
      x: chrome.colourBar.x,
      y: bounds.maxY + chrome.colourBar.marginTop,
    },
    width: chrome.colourBar.width,
    height: chrome.colourBar.height,
    fontSize: chrome.colourBar.fontSize,
    fontFamily: chrome.colourBar.fontFamily,
    startColour: chrome.colourBar.scoreColour(identityDomain[0]),
    endColour: chrome.colourBar.scoreColour(identityDomain[1]),
    label: "Identity (%)",
    startLabel: `${Math.round(identityDomain[0] * 100)}`,
    endLabel: `${Math.round(identityDomain[1] * 100)}`,
  };

  // Bottom legends share the lower chart edge with the scale and colour bars.
  // Stack them rather than letting the first legend entry cover those bars.
  const bottomOffset = Math.max(
    scaleBar.visible
      ? scaleBar.position.y - bounds.maxY + scaleBar.height + scaleBar.fontSize + 8
      : 0,
    colourBar.visible
      ? colourBar.position.y - bounds.maxY + colourBar.height + colourBar.fontSize + 8
      : 0
  );
  const columns = Math.min(
    groups.length || 1,
    Math.max(1, Math.floor(Number(chrome.legend.columns) || 1))
  );
  const columnWidth = Number(chrome.legend.columnWidth) || 160;
  const rows = Math.ceil(groups.length / columns);
  const fontSize = Number(chrome.legend.fontSize) || 14;
  const subtitleFontSize = Number(chrome.legend.subtitleFontSize) || Math.max(10, Math.round(fontSize * 0.72));
  const hasSubtitles = groups.some((group) => Boolean(group.subtitle));
  const entryHeight = hasSubtitles
    ? Math.max(Number(chrome.legend.entryHeight) || 18, fontSize + subtitleFontSize + 4)
    : Number(chrome.legend.entryHeight) || 18;
  const totalHeight = entryHeight * rows;
  const step = rows > 1 ? totalHeight / (rows - 0.5) : totalHeight;
  const radius = step / 4;
  const placement = chrome.legend.placement === "bottom" ? "bottom" : "right";
  const legend = {
    textColour: chrome.legend.textColour, subtitleColour: chrome.legend.subtitleColour,
    visible: chrome.legend.show,
    placement,
    columns,
    columnWidth,
    marginLeft: chrome.legend.marginLeft,
    marginTop: chrome.legend.marginTop,
    bottomOffset,
    position: legendPositionForBounds(bounds, {
      ...chrome.legend,
      placement,
      bottomOffset,
    }),
    entryHeight,
    fontSize,
    subtitleFontSize,
    hasSubtitles,
    fontFamily: chrome.legend.fontFamily,
    items: groups.map((group, index) => {
      const column = Math.floor(index / rows);
      const row = index % rows;
      return {
      uid: group.uid,
      source: group,
      label: group.label,
      colour: chrome.legend.colourForGroup(group.uid),
      x: column * columnWidth,
      y: row * step,
      radius,
      circleY: hasSubtitles ? entryHeight / 2 : radius,
      textX: radius + 6,
      textY: hasSubtitles ? entryHeight / 2 - subtitleFontSize * 0.42 : radius + 1,
      ...(group.subtitle ? { subtitle: group.subtitle, subtitleY: entryHeight / 2 + fontSize * 0.48 } : {}),
      };
    }),
  };

  return { legend, scaleBar, colourBar };
}

function createLocusLayout(locus, clusterLayout, {
  scaleX,
  getLocusState,
  getGeneState,
  locusOffset,
  shape,
  geneMidpoint,
}) {
  const state = { ...getLocusState(locus) };
  const localX = locusOffset(locus.uid);
  const start = scaleX(state.start);
  const end = scaleX(state.end);
  const worldX = clusterLayout.x + localX;
  return {
    source: locus,
    cluster: clusterLayout.source,
    state,
    localX,
    x: worldX,
    y: clusterLayout.y,
    start,
    end,
    worldStart: worldX + start,
    worldEnd: worldX + end,
    bounds: {
      minX: worldX + start,
      maxX: worldX + end,
      minY: clusterLayout.y - 10,
      maxY: clusterLayout.y + shape.tipHeight * 2 + shape.bodyHeight + 10,
    },
    transform: { x: localX, y: 0 },
    track: {
      // The physical extent is unchanged by a flip, but retaining the
      // endpoint orientation lets renderers animate the bar collapsing
      // through its midpoint and growing out in the reversed direction.
      x1: state.flipped ? end : start,
      x2: state.flipped ? start : end,
      y: geneMidpoint,
    },
    hover: {
      x: start,
      y: -10,
      width: end - start,
      height: shape.tipHeight * 2 + shape.bodyHeight + 20,
      leftHandleX: start - 8,
      rightHandleX: end,
    },
    trimIndicators: createTrimIndicators({ locus, state, getGeneState, scaleX, shape }),
    genes: [],
  };
}

function extendLocusBoundsForTrimIndicators(locus, trimIndicatorStyle) {
  const { fontSize } = resolveTrimIndicatorStyle(trimIndicatorStyle);
  const maxY = Math.max(
    locus.y + locus.hover.y + locus.hover.height,
    ...locus.trimIndicators.map((indicator) => locus.y + indicator.y + fontSize + 1)
  );
  locus.bounds = { ...locus.bounds, maxY };
  return locus;
}

function createGeneLayout(gene, locusLayout, { scaleX, getGeneState, shape, label }) {
  const display = { ...gene, ...getGeneState(gene) };
  const visible =
    display.start >= locusLayout.state.start && display.end <= locusLayout.state.end + 1;
  const localPolygon = getGenePolygonCoordinates(display, { scaleX, shape });
  const polygon = worldPolygon(localPolygon, locusLayout.x, locusLayout.y);
  return {
    source: gene,
    display,
    locus: locusLayout,
    visible,
    localPolygon,
    polygon,
    bounds: boundsFromPoints(polygon),
    label: getGeneLabelLayout(display, { scaleX, shape, label }),
    labelTransform: getGeneLabelTransform(display, { scaleX, shape, label }),
    labelDy: getGeneLabelDy(label.position),
  };
}

function createLinkLayout(source, order, {
  genes,
  loci,
  clusters,
  areClustersAdjacent,
  scaleX,
  link,
  linkVisible = () => true,
  geneMidpoint,
}) {
  const query = genes.get(source.query.uid);
  const target = genes.get(source.target.uid);
  let anchors = null;
  if (query && target) {
    anchors = getLinkAnchors(source, {
      geneForUid: (uid) => genes.get(uid)?.display,
      areClustersAdjacent,
      scaleX,
      horizontalOffset: (gene) => {
        const locus = loci.get(gene.locusUid);
        return locus ? locus.x : 0;
      },
      verticalPosition: (gene) => clusters.get(gene.clusterUid)?.y ?? 0,
      geneMidpoint,
    });
  }
  const allowed = linkVisible(source);
  return {
    source,
    order,
    // Renderer policy (group membership, best-only reduction, hidden links)
    // is resolved once by the runtime. Keeping it on the retained record lets
    // all renderers, including dynamic cluster-drag previews, agree on it.
    allowed,
    anchors,
    bounds: boundsFromLinkAnchors(anchors),
    path: getLinkPath(anchors, link),
    labelPosition: anchors ? getLinkLabelPosition(anchors, link.labelPosition) : null,
    visible:
      Boolean(anchors) &&
      allowed &&
      !source.hidden &&
      source.identity >= link.threshold &&
      query?.visible &&
      target?.visible,
  };
}

function createLocusHitRegions(locus) {
  const { source, worldStart, worldEnd, y, hover } = locus;
  const move = {
    type: "rect",
    action: "move-locus",
    locusUid: source.uid,
    x: worldStart,
    y: y + hover.y,
    width: worldEnd - worldStart,
    height: hover.height,
  };
  const trimLeft = {
    type: "rect",
    action: "trim-locus-left",
    locusUid: source.uid,
    x: worldStart + hover.leftHandleX - hover.x,
    y: y + hover.y,
    width: hover.x - hover.leftHandleX,
    height: hover.height,
  };
  const trimRight = {
    type: "rect",
    action: "trim-locus-right",
    locusUid: source.uid,
    x: worldEnd,
    y: y + hover.y,
    width: 8,
    height: hover.height,
  };
  return { move, trimLeft, trimRight };
}

function createGeneHitRegion(gene) {
  if (!gene.visible) return null;
  return {
    type: "polygon",
    action: "gene",
    geneUid: gene.source.uid,
    points: gene.polygon,
  };
}

function buildHitRegions(loci, genes) {
  const locusRegions = new Map();
  const geneRegions = new Map();
  const all = [];

  for (const locus of loci.values()) {
    const regions = createLocusHitRegions(locus);
    locusRegions.set(locus.source.uid, regions);
    all.push(regions.move, regions.trimLeft, regions.trimRight);
  }

  for (const gene of genes.values()) {
    const region = createGeneHitRegion(gene);
    if (!region) continue;
    geneRegions.set(gene.source.uid, region);
    all.push(region);
  }

  return { all, loci: locusRegions, genes: geneRegions };
}

function adjacencyForOrder(order, fallback) {
  if (!order) return fallback;
  const positions = new Map(order.map((uid, index) => [uid, index]));
  return (one, two) => Math.abs(positions.get(one) - positions.get(two)) === 1;
}

/**
 * Derive renderer-neutral, world-space geometry from chart data and state.
 * The returned records contain no DOM selections and can be consumed by SVG,
 * Canvas, or an SVG export renderer.
 */
function buildScene(
  data,
  {
    scaleX,
    scaleY,
    clusterPosition = scaleY,
    clusterOffset,
    locusOffset,
    getLocusState,
    getGeneState,
    areClustersAdjacent,
    clusterOrder = null,
    shape,
    label,
    link,
    linkVisible = () => true,
    clusterLabel = () => "",
    alignLabels = true,
    trimIndicatorStyle = {},
    chrome = null,
    fontFamily = "sans-serif",
    measureText = null,
    annotationsEnabled = false,
    tree = null,
    theme = null,
  }
) {
  const clusters = new Map();
  const loci = new Map();
  const genes = new Map();
  const links = new Map();
  const linksByClusterPair = new Map();
  const linksByGene = new Map();
  areClustersAdjacent = adjacencyForOrder(clusterOrder, areClustersAdjacent);
  const geneMidpoint = shape.tipHeight + shape.bodyHeight / 2;

  for (const cluster of data.clusters) {
    const x = clusterOffset(cluster.uid);
    const y = clusterPosition(cluster.uid);
    const clusterLayout = { source: cluster, x, y, loci: [] };
    clusters.set(cluster.uid, clusterLayout);

    for (const locus of cluster.loci) {
      const locusLayout = createLocusLayout(locus, clusterLayout, {
        scaleX,
        getLocusState,
        getGeneState,
        locusOffset,
        shape,
        geneMidpoint,
      });
      loci.set(locus.uid, locusLayout);
      clusterLayout.loci.push(locusLayout);

      for (const gene of locus.genes) {
        const geneLayout = createGeneLayout(gene, locusLayout, {
          scaleX,
          getGeneState,
          shape,
          label,
        });
        genes.set(gene.uid, geneLayout);
        locusLayout.genes.push(geneLayout);
      }
    }
  }

  const arrangedTrimIndicators = arrangeTrimIndicators(loci.values(), new Map(), trimIndicatorStyle);
  for (const locus of loci.values()) {
    locus.rawTrimIndicators = locus.trimIndicators;
    locus.trimIndicators = arrangedTrimIndicators.get(locus.source.uid) || [];
    extendLocusBoundsForTrimIndicators(locus, trimIndicatorStyle);
  }
  const bounds = sceneBounds(loci, { shape, trimIndicatorStyle });
  for (const cluster of clusters.values()) {
    cluster.bounds = boundsForLoci(cluster.loci);
    cluster.info = clusterInfo(cluster, bounds, { alignLabels, clusterLabel });
  }

  for (const [order, source] of data.links.entries()) {
    const linkLayout = createLinkLayout(source, order, {
      genes,
      loci,
      clusters,
      areClustersAdjacent,
      scaleX,
      link,
      linkVisible,
      geneMidpoint,
    });
    links.set(source.uid, linkLayout);
    for (const uid of new Set([source.query.uid, source.target.uid])) {
      if (!linksByGene.has(uid)) linksByGene.set(uid, []);
      linksByGene.get(uid).push(source);
    }
    const query = genes.get(source.query.uid);
    const target = genes.get(source.target.uid);
    if (query && target) {
      const key = clusterPairKey(query.locus.cluster.uid, target.locus.cluster.uid);
      const pairLinks = linksByClusterPair.get(key) || [];
      pairLinks.push(source.uid);
      linksByClusterPair.set(key, pairLinks);
    }
  }

  const hitRegions = buildHitRegions(loci, genes);
  const chromeLayout = buildChrome(bounds, genes, chrome);
  const annotations = projectSceneAnnotations(data.annotationPanels, clusters, bounds, chromeLayout,
    { annotationsEnabled, fontFamily, rowOffset: geneMidpoint, measureText, theme, tree });
  return {
    clusters,
    loci,
    genes,
    links,
    linksByClusterPair,
    linksByGene,
    bounds,
    ...annotations,
    index: {
      genes: createSpatialIndex([...genes].map(([uid, gene]) => [uid, gene.bounds])),
      loci: createSpatialIndex([...loci].map(([uid, locus]) => [uid, locus.bounds])),
      links: createSpatialIndex([...links].map(([uid, link]) => [uid, link.bounds])),
      hitLoci: createSpatialIndex(
        [...hitRegions.loci].map(([uid, regions]) => [
          uid,
          boundsFromRegions([regions.move, regions.trimLeft, regions.trimRight]),
        ])
      ),
    },
    hitRegions,
    chrome: chromeLayout,
  };
}

function translateBounds(bounds, x, y = 0) {
  if (!bounds) return bounds;
  return {
    minX: bounds.minX + x, maxX: bounds.maxX + x,
    minY: bounds.minY + y, maxY: bounds.maxY + y,
  };
}

function boundsForLoci(loci) {
  const bounds = loci.map((locus) => locus.bounds).filter(Boolean);
  return bounds.length ? {
    minX: Math.min(...bounds.map((bounds) => bounds.minX)),
    maxX: Math.max(...bounds.map((bounds) => bounds.maxX)),
    minY: Math.min(...bounds.map((bounds) => bounds.minY)),
    maxY: Math.max(...bounds.map((bounds) => bounds.maxY)),
  } : null;
}

function sceneBounds(loci, { shape, trimIndicatorStyle = {} }) {
  const { fontSize } = resolveTrimIndicatorStyle(trimIndicatorStyle);
  let bounds = null;
  for (const locus of loci.values()) {
    const maxY = Math.max(
      locus.y + shape.tipHeight * 2 + shape.bodyHeight,
      ...locus.trimIndicators.map((indicator) => locus.y + indicator.y + fontSize + 1)
    );
    const next = {
      minX: locus.worldStart, maxX: locus.worldEnd, minY: locus.y, maxY,
    };
    bounds = bounds ? extendBounds(bounds, next.minX, next.maxX, next.minY, next.maxY) : next;
  }
  return bounds;
}

function clusterInfo(cluster, bounds, { alignLabels = true, clusterLabel = () => "" }) {
  const start = cluster.loci.length
    ? Math.min(...cluster.loci.map((locus) => locus.worldStart)) : cluster.x;
  return {
    x: (alignLabels && bounds ? bounds.minX : start) - cluster.x - 10,
    y: 0,
    locusText: clusterLabel(cluster.source),
  };
}

function updateSpatialIndex(index, changedEntries, entriesForRebuild) {
  // Dense changes (e.g. a large reorder) are cheaper to rebuild than to patch
  // cell by cell. Construct the complete entry list only on that path.
  return changedEntries.length > (index?.boundsById.size || 0) / 4
    ? createSpatialIndex(entriesForRebuild())
    : patchSpatialIndex(index, changedEntries);
}

function repositionChrome(chrome, bounds, previousBounds) {
  if (!chrome || !bounds) return null;
  const dy = bounds.maxY - previousBounds.maxY;
  return {
    ...chrome,
    legend: { ...chrome.legend, position: legendPositionForBounds(bounds, chrome.legend) },
    scaleBar: { ...chrome.scaleBar, position: {
      ...chrome.scaleBar.position, y: chrome.scaleBar.position.y + dy,
    } },
    colourBar: { ...chrome.colourBar, position: {
      ...chrome.colourBar.position, y: chrome.colourBar.position.y + dy,
    } },
  };
}

const emptyAnnotationPanels = Object.freeze([]);

// Data/configuration builds project cells; geometry-only commits retain them.
// This is the single placement path for both kinds of scene update.
function projectSceneAnnotations(definitions, clusters, bounds, chrome, options, previous = null) {
  const annotationPanelData = options.annotationsEnabled ? definitions : undefined;
  const visible = annotationPanelData?.some((panel) => panel.show !== false);
  const annotationChromeRight = visible ? annotationChromeRightEdge(chrome, options.measureText) : -Infinity;
  const annotationAnchorX = Math.max(bounds?.maxX ?? 0, annotationChromeRight);
  let annotationPanels = emptyAnnotationPanels;
  if (visible) {
    if (previous?.annotationPanelData === annotationPanelData) {
      const dx = annotationAnchorX - previous.annotationAnchorX;
      annotationPanels = dx ? previous.annotationPanels.map((panel) => ({ ...panel, x: panel.x + dx })) : previous.annotationPanels;
    } else {
      annotationPanels = layoutAnnotationPanels(annotationPanelData, clusters, bounds,
        { ...options, anchorX: annotationAnchorX, previousPanels: previous?.annotationPanels });
    }
    placeLegendAfterAnnotations(chrome, annotationPanels);
  }
  return { annotationPanelData, annotationPanels, annotationAnchorX, annotationChromeRight,
    figureBounds: annotationFigureBounds(figureBoundsForChrome(bounds, chrome), annotationPanels, clusters) };
}

/** Presentation/data edits to annotations leave synteny and its indexes intact. */
function patchAnnotationScene(scene, definitions, options) {
  const chrome = repositionChrome(scene.chrome, scene.bounds, scene.bounds);
  return { ...scene, chrome,
    ...projectSceneAnnotations(definitions, scene.clusters, scene.bounds, chrome,
      { ...options, rowOffset: options.shape.tipHeight + options.shape.bodyHeight / 2 }, scene),
    changes: { annotationsOnly: true } };
}

function placeLegendAfterAnnotations(chrome, panels) {
  if (chrome?.legend.placement === "right" && panels.length) {
    const right = Math.max(...panels.map((panel) => panel.x + panel.extentWidth));
    chrome.legend.position = { ...chrome.legend.position, x: right + chrome.legend.marginLeft };
  }
}

/**
 * Commit geometry edits to an existing renderer-neutral scene. IDs and data
 * membership must be unchanged; use buildScene for data/configuration changes.
 * Explicit loci cover flips/trims, clusters cover translations/reorders, and
 * the caller supplies current authoritative state/scales rather than deltas.
 * Unchanged records are shared. All changed links, bounds, labels, chrome and
 * hit indexes are finalized once, including for batch edits.
 */
function patchScene(scene, { loci: locusIds = [], clusters: clusterIds = [] } = {}, options) {
  if (!scene) return scene;
  options = { ...options, areClustersAdjacent: adjacencyForOrder(options.clusterOrder, options.areClustersAdjacent) };
  const {
    scaleX, shape, label, getGeneState, getLocusState, locusOffset,
    clusterOffset = (uid) => scene.clusters.get(uid).x,
    clusterPosition = (uid) => scene.clusters.get(uid).y,
    trimIndicatorStyle = {},
  } = options;
  const requestedLoci = new Set(locusIds);
  const requestedClusters = new Set(clusterIds);
  for (const uid of requestedClusters) {
    for (const locus of scene.clusters.get(uid)?.loci || []) requestedLoci.add(locus.source.uid);
  }
  for (const uid of requestedLoci) {
    const locus = scene.loci.get(uid);
    if (locus) requestedClusters.add(locus.cluster.uid);
  }
  if (!requestedLoci.size) return scene;

  const clusters = new Map(scene.clusters);
  const loci = new Map(scene.loci);
  const genes = new Map(scene.genes);
  const changedLoci = new Set();
  const changedGenes = new Set();
  let visibilityChanged = false;
  const geneMidpoint = shape.tipHeight + shape.bodyHeight / 2;
  for (const uid of requestedClusters) {
    const previous = clusters.get(uid);
    if (previous) clusters.set(uid, {
      ...previous, x: clusterOffset(uid), y: clusterPosition(uid), loci: [...previous.loci],
    });
  }
  for (const uid of requestedLoci) {
    const previous = scene.loci.get(uid);
    if (!previous) continue;
    const cluster = clusters.get(previous.cluster.uid);
    const state = getLocusState(previous.source);
    const localX = locusOffset(uid);
    const dx = cluster.x + localX - previous.x, dy = cluster.y - previous.y;
    const translated = state.start === previous.state.start && state.end === previous.state.end &&
      state.flipped === previous.state.flipped;
    const locus = translated ? {
      ...previous, state: { ...state }, localX, x: previous.x + dx, y: previous.y + dy,
      worldStart: previous.worldStart + dx, worldEnd: previous.worldEnd + dx,
      bounds: translateBounds(previous.bounds, dx, dy),
      transform: { x: localX, y: 0 }, genes: [],
      trimIndicators: previous.rawTrimIndicators || previous.trimIndicators,
    } : createLocusLayout(previous.source, cluster, { ...options, geneMidpoint });
    locus.rawTrimIndicators = locus.trimIndicators;
    for (const source of locus.source.genes) {
      const previousGene = scene.genes.get(source.uid);
      const gene = translated && previousGene ? {
        ...previousGene, locus,
        polygon: worldPolygon(previousGene.polygon, dx, dy),
        bounds: translateBounds(previousGene.bounds, dx, dy),
      } : createGeneLayout(source, locus, { scaleX, getGeneState, shape, label });
      if (gene.visible !== previousGene?.visible) visibilityChanged = true;
      genes.set(source.uid, gene);
      locus.genes.push(gene);
      changedGenes.add(source.uid);
    }
    loci.set(uid, locus);
    changedLoci.add(uid);
  }

  // Moving a trimmed locus can also change a neighbour's indicator placement.
  // Reflow the small indicator set from its original local rows, retaining all
  // other locus/gene geometry when only an indicator row changes.
  const rawIndicators = new Map([...loci].map(([uid, locus]) =>
    [uid, locus.rawTrimIndicators || locus.trimIndicators]
  ));
  const arranged = arrangeTrimIndicators(loci.values(), rawIndicators, trimIndicatorStyle);
  for (const [uid, previous] of loci) {
    const indicators = arranged.get(uid) || [];
    if (!changedLoci.has(uid) && JSON.stringify(indicators) === JSON.stringify(previous.trimIndicators)) continue;
    const locus = changedLoci.has(uid) ? previous : { ...previous, genes: [] };
    locus.rawTrimIndicators = rawIndicators.get(uid);
    locus.trimIndicators = indicators;
    extendLocusBoundsForTrimIndicators(locus, trimIndicatorStyle);
    if (!changedLoci.has(uid)) {
      for (const previousGene of previous.genes) {
        const gene = { ...previousGene, locus };
        genes.set(gene.source.uid, gene);
        locus.genes.push(gene);
      }
      loci.set(uid, locus);
      requestedClusters.add(locus.cluster.uid);
      const cluster = clusters.get(locus.cluster.uid);
      if (cluster === scene.clusters.get(locus.cluster.uid)) clusters.set(locus.cluster.uid, { ...cluster });
    }
    changedLoci.add(uid);
  }
  for (const uid of requestedClusters) {
    const cluster = clusters.get(uid);
    if (!cluster) continue;
    cluster.loci = cluster.loci.map((locus) => loci.get(locus.source.uid));
    cluster.bounds = boundsForLoci(cluster.loci);
  }
  const bounds = sceneBounds(loci, options);
  for (const [uid, cluster] of clusters) {
    const info = clusterInfo(cluster, bounds, options);
    if (info.x !== cluster.info.x || info.locusText !== cluster.info.locusText) {
      clusters.set(uid, { ...cluster, info });
    }
  }

  const sources = new Map();
  for (const uid of changedGenes) {
    for (const source of scene.linksByGene.get(uid) || []) sources.set(source.uid, source);
  }
  const links = new Map(scene.links);
  for (const source of sources.values()) {
    const previous = links.get(source.uid);
    if (previous) links.set(source.uid, createLinkLayout(source, previous.order, {
      ...options, genes, loci, clusters, geneMidpoint,
    }));
  }

  const locusRegions = new Map(scene.hitRegions.loci);
  const geneRegions = new Map(scene.hitRegions.genes);
  for (const uid of changedLoci) locusRegions.set(uid, createLocusHitRegions(loci.get(uid)));
  for (const uid of changedGenes) {
    const region = createGeneHitRegion(genes.get(uid));
    if (region) geneRegions.set(uid, region);
    else geneRegions.delete(uid);
  }
  const hitRegions = {
    loci: locusRegions, genes: geneRegions,
    // Match full-build hit order: all locus handles, then visible genes.
    all: [...locusRegions.values()].flatMap(({ move, trimLeft, trimRight }) => [move, trimLeft, trimRight])
      .concat([...genes.keys()].map((uid) => geneRegions.get(uid)).filter(Boolean)),
  };
  const entries = (records, ids, boundsFor = (record) => record.bounds) =>
    [...ids].map((uid) => [uid, boundsFor(records.get(uid))]);
  const hitBounds = (regions) => boundsFromRegions([regions.move, regions.trimLeft, regions.trimRight]);
  const chrome = visibilityChanged && options.chrome
    ? buildChrome(bounds, genes, options.chrome)
    : repositionChrome(scene.chrome, bounds, scene.bounds);
  const annotations = projectSceneAnnotations(scene.annotationPanelData, clusters, bounds, chrome,
    { ...options, rowOffset: geneMidpoint }, scene);
  return {
    ...scene, clusters, loci, genes, links, bounds, chrome, hitRegions, ...annotations,
    changes: { loci: changedLoci, genes: changedGenes, links: new Set(sources.keys()), clusters: requestedClusters },
    index: {
      genes: updateSpatialIndex(scene.index.genes, entries(genes, changedGenes), () => entries(genes, genes.keys())),
      loci: updateSpatialIndex(scene.index.loci, entries(loci, changedLoci), () => entries(loci, loci.keys())),
      links: updateSpatialIndex(scene.index.links, entries(links, sources.keys()), () => entries(links, links.keys())),
      hitLoci: updateSpatialIndex(scene.index.hitLoci, entries(locusRegions, changedLoci, hitBounds),
        () => entries(locusRegions, locusRegions.keys(), hitBounds)),
    },
  };
}

/** Canvas owns text metrics; all tree geometry comes from the shared layout. */
function layoutCanvasTree(context, tree, scene, config, options = {}) {
  if (!tree || !config.tree?.show || !scene?.clusters.size) return null;
  context.save();
  try {
    return layoutTree({
      ...options,
      tree, scene, config,
      measureText: (text, style) => {
        context.font = `${style.fontStyle || "normal"} ${style.fontWeight || 400} ${style.fontSize}px ${style.fontFamily}`;
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        const metrics = context.measureText(text);
        const overhang = Math.max(0, metrics.actualBoundingBoxLeft || 0, (metrics.actualBoundingBoxRight || 0) - metrics.width);
        return { width: metrics.width + overhang * 2, overhang, height: Math.max(style.fontSize, (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0)) };
      },
      measureLabel: (cluster, locusText) => {
        context.font = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
        const nameWidth = context.measureText(cluster.source.name || "").width;
        context.font = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
        return Math.max(nameWidth, context.measureText(locusText).width);
      },
    });
  } finally {
    context.restore();
  }
}

function traceLines(context, lines) {
  context.beginPath();
  for (const line of lines) {
    context.moveTo(line.x1, line.y1);
    context.lineTo(line.x2, line.y2);
  }
  context.stroke();
}

/** Paint an already positioned tree frame, also used by the WebGPU overlay. */
function drawCanvasTree(context, layout) {
  if (!layout) return;
  context.save();
  context.strokeStyle = layout.guide.colour;
  context.lineWidth = layout.guide.width;
  context.setLineDash(layout.guide.dash);
  traceLines(context, layout.guides);
  context.setLineDash([]);
  if (layout.cutLine) {
    const cut = layout.cutLine;
    context.strokeStyle = cut.colour;
    context.lineWidth = cut.width;
    context.setLineDash([4, 3]);
    traceLines(context, [cut]);
    context.setLineDash([]);
    context.fillStyle = cut.colour;
    context.font = `${cut.label.fontSize}px ${cut.label.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(cut.label.text, cut.label.x, cut.label.y);
  }
  const groups = new Map();
  for (const mark of [layout.rootBranch, ...layout.stems, ...layout.branches]) {
    const key = `${mark.style.colour}:${mark.style.width}:${mark.lineCap || "butt"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mark);
  }
  for (const lines of groups.values()) {
    context.strokeStyle = lines[0].style.colour;
    context.lineWidth = lines[0].style.width;
    context.lineCap = lines[0].lineCap || "butt";
    traceLines(context, lines);
  }
  context.lineCap = "butt";
  context.strokeStyle = layout.branch.colour;
  context.lineWidth = layout.branch.width;
  context.fillStyle = layout.background;
  for (const node of layout.nodes) {
    context.beginPath();
    context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.fillStyle = layout.support.colour;
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.font = `${layout.support.fontSize}px ${layout.support.fontFamily}`;
  for (const label of layout.supports) context.fillText(label.text, label.x, label.y);
  for (const label of layout.annotations) {
    context.fillStyle = label.colour;
    context.textAlign = "left";
    context.textBaseline = "top";
    context.font = `${label.fontStyle} ${label.fontWeight} ${label.fontSize}px ${label.fontFamily}`;
    context.fillText(label.text, label.x, label.y);
  }
  if (layout.scaleBar) {
    const bar = layout.scaleBar;
    context.strokeStyle = bar.colour;
    context.lineWidth = bar.strokeWidth;
    traceLines(context, bar.lines);
    context.fillStyle = layout.foreground;
    context.font = `${bar.fontSize}px ${bar.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(bar.label.text, bar.label.x, bar.label.y);
  }
  context.restore();
}

/**
 * Choose Canvas backing-store resolution from the view scale.  This affects
 * only raster detail: the CSS canvas size and chart-world coordinates remain
 * unchanged.  Active gestures always favour throughput over sharpness.
 */
function canvasPixelRatioForCamera({
  camera,
  moving = false,
  devicePixelRatio = globalThis.devicePixelRatio || 1,
}) {
  if (moving) return Math.min(devicePixelRatio, 1);

  const zoom = camera?.k ?? 1;
  if (zoom < 0.35) return Math.min(devicePixelRatio, 0.75);
  if (zoom < 0.6) return Math.min(devicePixelRatio, 1);
  if (zoom < 0.85) return Math.min(devicePixelRatio, 1.5);
  return devicePixelRatio;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Project the complete chart bounds into a fixed-size screen-space minimap. */
function createMinimapProjection({ bounds, width, height, padding = 4 }) {
  if (!bounds || !width || !height) return null;
  const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
  const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(availableWidth / worldWidth, availableHeight / worldHeight);
  const frame = {
    x: (width - worldWidth * scale) / 2,
    y: (height - worldHeight * scale) / 2,
    width: worldWidth * scale,
    height: worldHeight * scale,
  };
  return {
    bounds,
    width,
    height,
    scale,
    frame,
    x: frame.x - bounds.minX * scale,
    y: frame.y - bounds.minY * scale,
  };
}

/** Return the main viewport rectangle in minimap screen coordinates. */
function canvasMinimapViewport(projection, camera, viewport) {
  if (!projection || !camera || !viewport) return null;
  const minX = -camera.x / camera.k;
  const maxX = (viewport.width - camera.x) / camera.k;
  const minY = -camera.y / camera.k;
  const maxY = (viewport.height - camera.y) / camera.k;
  const { bounds, scale, x, y, frame } = projection;
  const left = clamp(x + minX * scale, frame.x, frame.x + frame.width);
  const right = clamp(x + maxX * scale, frame.x, frame.x + frame.width);
  const top = clamp(y + minY * scale, frame.y, frame.y + frame.height);
  const bottom = clamp(y + maxY * scale, frame.y, frame.y + frame.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Centre the existing camera scale on a point selected in the minimap. */
function cameraForMinimapPoint(projection, point, viewport, camera) {
  const worldX = clamp(
    (point.x - projection.x) / projection.scale,
    projection.bounds.minX,
    projection.bounds.maxX
  );
  const worldY = clamp(
    (point.y - projection.y) / projection.scale,
    projection.bounds.minY,
    projection.bounds.maxY
  );
  return {
    ...camera,
    x: viewport.width / 2 - worldX * camera.k,
    y: viewport.height / 2 - worldY * camera.k,
  };
}

/** Composite a cached overview raster with the live main-camera viewport. */
function renderCanvasMinimap({
  canvas,
  baseCanvas = null,
  projection,
  camera,
  viewport,
  pixelRatio = globalThis.devicePixelRatio || 1,
}) {
  if (!projection) return null;
  const { width, height, frame } = projection;
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  if (baseCanvas) context.drawImage(baseCanvas, 0, 0, width, height);
  else {
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
  }
  context.strokeStyle = "rgba(0, 0, 0, 0.55)";
  context.lineWidth = 1;
  context.strokeRect(frame.x, frame.y, frame.width, frame.height);
  const visible = canvasMinimapViewport(projection, camera, viewport);
  if (visible) {
    context.fillStyle = "rgba(30, 120, 255, 0.16)";
    context.fillRect(visible.x, visible.y, visible.width, visible.height);
    context.strokeStyle = "rgb(30, 120, 255)";
    context.strokeRect(visible.x, visible.y, visible.width, visible.height);
  }
  return { width, height, pixelRatio, viewport: visible };
}

function canvasWorldPoint(canvas, event, camera) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left - camera.x) / camera.k,
    y: (event.clientY - bounds.top - camera.y) / camera.k,
  };
}

/**
 * Return the portion of chart-world space covered by a Canvas. A small
 * screen-space margin prevents records from popping at its edge while panning.
 */
function canvasWorldViewport(canvas, camera, overscan = 20, dimensions = null) {
  return worldViewport(camera, dimensions || canvas.getBoundingClientRect(), overscan);
}

/**
 * Extend the scene's structural figure bounds with exact Canvas text metrics.
 * Scene layout deliberately records only renderer-neutral chrome extents; the
 * raster adapter owns glyph measurement for initial camera fitting.
 */
function canvasFigureBounds(context, scene, config, tree = null, { preview = null, textMetrics = null } = {}) {
  if (!scene?.bounds) return null;
  let structural = scene.bounds;
  const chrome = preview?.chrome || scene.chrome;
  const panels = annotationPanelsForFrame(scene, preview);
  if (preview) {
    structural = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const locus of scene.loci.values()) {
      const geometry = locusGeometryForPreview(preview, locus);
      const { x = 0, y = 0 } = geometry.offsets;
      structural.minX = Math.min(structural.minX, geometry.worldStart ?? locus.worldStart + x);
      structural.maxX = Math.max(structural.maxX, geometry.worldEnd ?? locus.worldEnd + x);
      structural.minY = Math.min(structural.minY, locus.bounds.minY + y);
      structural.maxY = Math.max(structural.maxY, locus.bounds.maxY + y);
    }
  }
  const bounds = { ...(preview ? annotationFigureBounds(figureBoundsForChrome(structural, chrome),
    scene.annotationPanels || [], scene.clusters, panels) : scene.figureBounds || structural) };
  const include = (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  const includeText = (text, x, y, { fontSize, fontFamily = config.plot.fontFamily,
    fontWeight = 400, align = "left", baseline = "alphabetic", rotation = 0, border = 0 }) => {
    if (!text) return;
    const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const key = JSON.stringify([font, align, baseline, String(text)]);
    let metrics = textMetrics?.get(key);
    if (!metrics) {
      context.save();
      context.font = font;
      context.textAlign = align;
      context.textBaseline = baseline;
      metrics = context.measureText(String(text));
      context.restore();
      textMetrics?.set(key, metrics);
    }
    const left = align === "center" ? -metrics.width / 2 : ["right", "end"].includes(align) ? -metrics.width : 0;
    const top = baseline === "top" ? 0 : baseline === "middle" ? -fontSize / 2 : -fontSize;
    const x1 = Number.isFinite(metrics.actualBoundingBoxLeft) ? -metrics.actualBoundingBoxLeft : left;
    const x2 = Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : left + metrics.width;
    const y1 = Number.isFinite(metrics.actualBoundingBoxAscent) ? -metrics.actualBoundingBoxAscent : top;
    const y2 = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : top + fontSize * 1.25;
    const radians = rotation * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    for (const [tx, ty] of [[x1, y1], [x1, y2], [x2, y1], [x2, y2]]) {
      const px = x + tx * cos - ty * sin, py = y + tx * sin + ty * cos;
      include(px - border / 2, py - border / 2);
      include(px + border / 2, py + border / 2);
    }
  };

  // Structural scene bounds already enclose loci, gene polygons and ribbons.
  // Add stroke extent without walking every homology link when labels are off.
  const halfStroke = Math.max(config.gene.shape.strokeWidth || 0, config.locus.trackBar.stroke || 0,
    config.link.show ? config.link.strokeWidth || 0 : 0) / 2;
  include(structural.minX - halfStroke, structural.minY - halfStroke);
  include(structural.maxX + halfStroke, structural.maxY + halfStroke);
  for (const cluster of scene.clusters.values()) {
    const x = cluster.x + cluster.info.x + clusterLabelOffsetForPreview(preview, cluster.source.uid);
    const y = cluster.y + clusterOffsetForPreview(preview, cluster.source.uid);
    includeText(cluster.source.name, x, y + 8,
      { fontSize: config.cluster.nameFontSize, fontWeight: 700, align: "right" });
    includeText(clusterLabelTextForPreview(preview, cluster.source.uid, cluster.info.locusText), x, y + 12,
      { fontSize: config.cluster.lociFontSize, align: "right", baseline: "top" });
  }
  if (config.gene.label.show) {
    for (const gene of scene.genes.values()) {
      if (!geneVisibleForPreview(preview, gene)) continue;
      const offsets = offsetsForGene(preview, gene);
      const geometry = geneGeometryForPreview(preview, gene);
      includeText(gene.source.label || gene.source.name || gene.source.uid,
        (geometry.labelX ?? gene.locus.x + gene.label.x) + offsets.x, gene.locus.y + gene.label.y + offsets.y,
        { fontSize: config.gene.label.fontSize, align: config.gene.label.anchor === "middle" ? "center" : config.gene.label.anchor, rotation: gene.label.rotation });
    }
  }
  if (config.link.show && config.link.label.show) {
    for (const link of scene.links.values()) {
      const geometry = linkGeometryForPreview(scene, link, preview, config);
      if (!geometry.visible || !link.labelPosition) continue;
      const anchors = preview ? previewLinkAnchors(scene, link, preview) : link.anchors;
      const position = preview && anchors ? getLinkLabelPosition(anchors, config.link.label.position) : link.labelPosition;
      includeText(link.source.label ?? link.source.identity.toFixed(2), position.x, position.y,
        { fontSize: config.link.label.fontSize, align: "center" });
    }
  }
  if (config.locus.trimIndicators?.show !== false) {
    const style = resolveTrimIndicatorStyle(config.locus.trimIndicators);
    for (const locus of scene.loci.values()) {
      const geometry = locusGeometryForPreview(preview, locus);
      const { x = 0, y = 0 } = geometry.offsets;
      for (const indicator of geometry.trimIndicators || locus.trimIndicators || []) {
        includeText(indicator.text, locus.x + indicator.x + x, locus.y + indicator.y + y,
          { fontSize: style.fontSize, fontWeight: style.fontWeight, align: indicator.anchor, baseline: "top", border: style.borderWidth });
      }
    }
  }
  const treeLayout = layoutCanvasTree(context, tree, scene, config, { preview, trackAnchor: Boolean(preview) });
  if (treeLayout) {
    include(treeLayout.bounds.minX, treeLayout.bounds.minY);
    include(treeLayout.bounds.maxX, treeLayout.bounds.maxY);
  }
  for (const panel of panels) {
    for (const item of panel.texts) includeText(item.text, panel.x + item.x, item.y,
      { fontSize: panel.fontSize, fontFamily: panel.fontFamily, fontWeight: item.weight || 400,
        align: item.anchor === "end" ? "right" : item.anchor === "middle" ? "center" : "left", rotation: item.rotation || 0 });
  }
  if (chrome?.legend.visible) {
    const legend = chrome.legend;
    const subtitleSize = legend.subtitleFontSize || Math.max(10, legend.fontSize * 0.72);
    for (const item of legend.items) {
      const x = legend.position.x + item.x, y = legend.position.y + item.y + item.circleY;
      include(x - item.radius, y - item.radius);
      include(x + item.radius, y + item.radius);
      includeText(item.label, legend.position.x + item.textX, legend.position.y + item.y + item.textY,
        { fontSize: legend.fontSize, fontFamily: legend.fontFamily, baseline: "middle" });
      includeText(item.subtitle, legend.position.x + item.textX, legend.position.y + item.y + item.subtitleY,
        { fontSize: subtitleSize, fontFamily: legend.fontFamily, baseline: "middle" });
    }
  }
  if (chrome?.scaleBar.visible) {
    const bar = chrome.scaleBar;
    const half = bar.strokeWidth / 2;
    include(bar.position.x - half, bar.position.y - half);
    include(bar.position.x + bar.length + half, bar.position.y + bar.height + half);
    includeText(bar.label, bar.position.x + bar.length / 2, bar.position.y + bar.height + 5,
      { fontSize: bar.fontSize * 4 / 3, fontFamily: bar.fontFamily, align: "center", baseline: "top" });
  }
  if (chrome?.colourBar.visible) {
    const bar = chrome.colourBar;
    include(bar.position.x - 0.5, bar.position.y - 0.5);
    include(bar.position.x + bar.width + 0.5, bar.position.y + bar.height + 0.5);
    const font = { fontSize: bar.fontSize * 4 / 3, fontFamily: bar.fontFamily, baseline: "top" };
    const y = bar.position.y + bar.height + 5;
    includeText(bar.label, bar.position.x + bar.width / 2, y, { ...font, align: "center" });
    includeText(bar.startLabel, bar.position.x, y, font);
    includeText(bar.endLabel, bar.position.x + bar.width, y, { ...font, align: "right" });
  }
  return bounds;
}

function clusterLabelHit(context, scene, point, config) {
  for (const cluster of [...scene.clusters.values()].reverse()) {
    const anchorX = cluster.x + cluster.info.x;
    const nameFont = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
    const locusFont = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
    context.save();
    context.font = nameFont;
    const nameWidth = context.measureText(cluster.source.name || "").width;
    context.font = locusFont;
    const locusWidth = context.measureText(cluster.info.locusText).width;
    context.restore();
    const width = Math.max(nameWidth, locusWidth);
    if (
      point.x >= anchorX - width &&
      point.x <= anchorX &&
      point.y >= cluster.y - config.cluster.nameFontSize &&
      point.y <= cluster.y + config.cluster.lociFontSize + 12
    ) {
      return { action: "move-cluster", clusterUid: cluster.source.uid };
    }
  }
  return null;
}

function chromeHit(context, scene, point) {
  const chrome = scene.chrome;
  if (!chrome) return null;

  const { legend, scaleBar } = chrome;
  if (legend.visible) {
    context.save();
    context.font = `${legend.fontSize}px ${legend.fontFamily}`;
    const subtitleFontSize = legend.subtitleFontSize || Math.max(10, Math.round(legend.fontSize * 0.72));
    for (const item of [...legend.items].reverse()) {
      const x = legend.position.x + item.x;
      const y = legend.position.y + item.y;
      const circleX = x;
      const circleY = y + item.circleY;
      if (Math.hypot(point.x - circleX, point.y - circleY) <= item.radius) {
        context.restore();
        return { action: "legend-colour", group: item.source };
      }
      const textX = x + item.textX;
      const labelWidth = context.measureText(item.label).width;
      context.font = `${subtitleFontSize}px ${legend.fontFamily}`;
      const subtitleWidth = item.subtitle ? context.measureText(item.subtitle).width : 0;
      context.font = `${legend.fontSize}px ${legend.fontFamily}`;
      const textWidth = Math.max(labelWidth, subtitleWidth);
      if (
        point.x >= textX &&
        point.x <= textX + textWidth &&
        point.y >= y + item.textY - legend.fontSize / 2 &&
        point.y <= y + (item.subtitleY ?? item.textY) + subtitleFontSize / 2
      ) {
        context.restore();
        return { action: "legend-text", group: item.source };
      }
    }
    context.restore();
  }

  if (scaleBar.visible) {
    const x = scaleBar.position.x + scaleBar.length / 2;
    const y = scaleBar.position.y + scaleBar.height + 5;
    context.save();
    context.font = `${scaleBar.fontSize}px ${scaleBar.fontFamily}`;
    const width = context.measureText(scaleBar.label).width;
    context.restore();
    if (
      point.x >= x - width / 2 &&
      point.x <= x + width / 2 &&
      point.y >= y &&
      point.y <= y + scaleBar.fontSize
    ) {
      return { action: "scale-bar" };
    }
  }

  return null;
}

function hitTestCanvas({ canvas, scene, camera, config, event, tree = null, treeDragging = false }) {
  const point = canvasWorldPoint(canvas, event, camera);
  const context = canvas.getContext("2d");
  return hitTest(scene, point) || treeNodeHit(context, scene, point, config, tree, treeDragging) || clusterLabelHit(context, scene, point, config) || chromeHit(context, scene, point);
}

function treeNodeHit(context, scene, point, config, tree, dragging = false) {
  return hitTestTreeNode(layoutCanvasTree(context, tree, scene, config, { dragging }), point);
}

function drawTree(context, tree, scene, config, preview, motion) {
  const layout = layoutCanvasTree(context, tree, scene, config, {
    preview,
    previousTree: motion.previousTree,
    previousScene: motion.previousScene,
    targetScene: motion.targetScene || scene,
    trackAnchor: motion.trackAnchor,
  });
  drawCanvasTree(context, interpolateTreeLayout(layout, motion.progress));
}

function polygon(context, points) {
  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    context.lineTo(points[index], points[index + 1]);
  }
  context.closePath();
}

function drawLinkLabel(context, layout, source, config, anchors, geometry = {}) {
  if (!config.link.label.show || !(geometry.labelPosition || layout.labelPosition)) return;
  let [ax1, ax2, ay, bx1, bx2, by] = anchors;
  ax1 += geometry.a || 0;
  ax2 += geometry.a || 0;
  bx1 += geometry.b || 0;
  bx2 += geometry.b || 0;
  const aMid = (ax1 + ax2) / 2;
  const bMid = (bx1 + bx2) / 2;
  const labelPosition = geometry.labelPosition || {
    x: aMid + (bMid - aMid) * config.link.label.position,
    y: ay + Math.abs(by - ay) * config.link.label.position,
  };
  context.fillStyle = "white";
  context.font = `${config.link.label.fontSize}px ${config.plot.fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(source.label ?? source.identity.toFixed(2), labelPosition.x, labelPosition.y);
}

function drawLink(context, layout, source, config, scales, geometry, showLabel) {
  const visible = geometry.visible ?? layout.visible;
  const anchors = geometry.anchors ?? layout.anchors;
  if (!visible || !anchors) return;
  context.save();
  context.globalAlpha *= layout.opacity ?? 1;
  let [ax1, ax2, ay, bx1, bx2, by] = anchors;
  ax1 += geometry.a || 0;
  ax2 += geometry.a || 0;
  bx1 += geometry.b || 0;
  bx2 += geometry.b || 0;
  const group = scales.group(source.query.uid);
  const colour = source.colour || scales.colour(group);
  const score = scales.score(source.identity);

  context.beginPath();
  const adjustedAnchors = [ax1, ax2, ay, bx1, bx2, by];
  traceLinkPath(context, adjustedAnchors, config.link);
  if (config.link.asLine) {
    context.strokeStyle = source.colour || (config.link.groupColour ? rgbaToRgb(colour) : score);
  } else {
    context.fillStyle = source.colour || (config.link.groupColour ? rgbaToRgb(colour) : score);
    context.fill();
    context.strokeStyle = source.colour || (config.link.groupColour ? colour : config.figureStyle.outline);
  }
  context.lineWidth = config.link.strokeWidth;
  context.stroke();

  if (showLabel) drawLinkLabel(context, layout, source, config, anchors, geometry);
  context.restore();
}

function drawLinkHighlight(context, layout, source, config, geometry = {}) {
  const visible = geometry.visible ?? layout.visible;
  const anchors = geometry.anchors ?? layout.anchors;
  if (!visible || !anchors) return;
  let [ax1, ax2, ay, bx1, bx2, by] = anchors;
  ax1 += geometry.a || 0;
  ax2 += geometry.a || 0;
  bx1 += geometry.b || 0;
  bx2 += geometry.b || 0;
  context.beginPath();
  traceLinkPath(context, [ax1, ax2, ay, bx1, bx2, by], config.link);
  if (config.link.asLine) ; else {
    context.fillStyle = "rgba(22, 119, 255, 0.18)";
    context.fill();
  }
  context.strokeStyle = "#1677ff";
  context.lineWidth = Math.max(2, config.link.strokeWidth + 1);
  context.stroke();
}

function drawClusterInfo(
  context,
  cluster,
  config,
  { x: offsetX = 0, y: offsetY = 0, locusText = cluster.info.locusText } = {}
) {
  const { x, y } = cluster;
  const anchorX = x + cluster.info.x + offsetX;
  context.fillStyle = config.figureStyle?.foreground || "black";
  context.textAlign = "end";
  context.font = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
  context.textBaseline = "alphabetic";
  context.fillText(cluster.source.name, anchorX, y + offsetY + 8);
  context.font = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
  context.textBaseline = "top";
  context.fillText(locusText, anchorX, y + offsetY + 12);
}

function drawGene(
  context,
  gene,
  config,
  scales,
  { x: offsetX = 0, y: offsetY = 0 } = {},
  visible = gene.visible,
  geometry = {},
  showLabel = true
) {
  if (!visible) return;
  context.save();
  context.translate(offsetX, offsetY);
  if (geometry.flipAxis !== undefined) {
    // A flip preview is a uniform affine transform about the locus axis:
    // x' = axis + (x - axis) * (1 - 2p). Applying it to the context avoids
    // allocating a reflected polygon for every gene on every animation frame.
    context.save();
    context.translate(geometry.flipAxis, 0);
    context.scale(geometry.flipScale, 1);
    context.translate(-geometry.flipAxis, 0);
    polygon(context, gene.polygon);
  } else {
    polygon(context, gene.polygon);
  }
  const group = scales.group(gene.source.uid);
  context.fillStyle = gene.source.colour || scales.colour(group);
  context.strokeStyle = config.gene.shape.stroke;
  context.lineWidth = config.gene.shape.strokeWidth;
  context.fill();
  context.stroke();
  if (geometry.flipAxis !== undefined) context.restore();

  if (showLabel) drawGeneLabel(context, gene, config, geometry);
  context.restore();
}

function drawGeneLabel(context, gene, config, geometry = {}, { x: offsetX = 0, y: offsetY = 0 } = {}) {
  if (!config.gene.label.show) return;
  const { x, y, rotation } = gene.label;
  const labelX = (geometry.labelX ?? gene.locus.x + x) + offsetX;
  context.save();
  context.translate(labelX, gene.locus.y + y + offsetY);
  context.rotate((rotation * Math.PI) / 180);
  context.fillStyle = config.figureStyle?.foreground || "black";
  context.font = `${config.gene.label.fontSize}px ${config.plot.fontFamily}`;
  context.textAlign = config.gene.label.anchor === "middle" ? "center" : config.gene.label.anchor;
  context.textBaseline = "alphabetic";
  context.fillText(gene.source.label || gene.source.name || gene.source.uid, 0, 0);
  context.restore();
}

function drawGeneHighlight(context, gene, camera, geometry = {}, { x: offsetX = 0, y: offsetY = 0 } = {}) {
  context.save();
  context.translate(offsetX, offsetY);
  if (geometry.flipAxis !== undefined) {
    context.translate(geometry.flipAxis, 0);
    context.scale(geometry.flipScale, 1);
    context.translate(-geometry.flipAxis, 0);
  }
  polygon(context, gene.polygon);
  context.fillStyle = "rgba(22, 119, 255, 0.18)";
  context.fill();
  // Keep the editor-selection ring readable at every zoom level.
  context.strokeStyle = "#1677ff";
  context.lineWidth = 2.5 / camera.k;
  context.stroke();
  context.restore();
}

function drawLocusHighlight(context, locus, camera, geometry = {}) {
  const hover = geometry.hover || locus.hover;
  const offsets = geometry.offsets || {};
  const x = locus.x + hover.x + (offsets.x || 0);
  const y = locus.y + hover.y + (offsets.y || 0);
  context.save();
  context.fillStyle = "rgba(22, 119, 255, 0.12)";
  context.fillRect(x, y, hover.width, hover.height);
  context.strokeStyle = "#1677ff";
  context.lineWidth = 2 / camera.k;
  context.strokeRect(x, y, hover.width, hover.height);
  context.restore();
}

function drawLocusHover(context, scene, locusUid, geometry = {}, foreground = "black") {
  if (!locusUid) return;
  const locus = scene.loci.get(locusUid);
  if (!locus) return;

  geometry ||= {};
  const hover = geometry.hover || locus.hover;
  const offsets = geometry.offsets || {};
  const x = locus.x + hover.x + (offsets.x || 0);
  const y = locus.y + hover.y + (offsets.y || 0);
  context.fillStyle = "rgba(0, 0, 0, 0.4)";
  context.fillRect(x, y, hover.width, hover.height);
  context.fillStyle = foreground;
  context.fillRect(locus.x + hover.leftHandleX + (offsets?.x || 0), y, 8, hover.height);
  context.fillRect(locus.x + hover.rightHandleX + (offsets?.x || 0), y, 8, hover.height);
}

function drawLocusTrack(context, locus, viewport, config, geometry = {}) {
  const { x: offsetX = 0, y: offsetY = 0 } = geometry.offsets || geometry;
  const track = geometry.track || locus.track;
  // Compact test scenes and third-party scene consumers may only provide the
  // physical locus extent. Production scenes retain oriented track endpoints.
  const worldStart =
    track.x1 === undefined ? geometry.worldStart ?? locus.worldStart + offsetX : locus.x + track.x1 + offsetX;
  const worldEnd =
    track.x2 === undefined ? geometry.worldEnd ?? locus.worldEnd + offsetX : locus.x + track.x2 + offsetX;
  const start = viewport ? Math.max(Math.min(worldStart, worldEnd), viewport.minX) : worldStart;
  const end = viewport ? Math.min(Math.max(worldStart, worldEnd), viewport.maxX) : worldEnd;
  if (end < start) return;
  context.beginPath();
  context.moveTo(start, locus.y + track.y + offsetY);
  context.lineTo(end, locus.y + track.y + offsetY);
  context.strokeStyle = config.locus.trackBar.colour;
  context.lineWidth = config.locus.trackBar.stroke;
  context.stroke();
}

function drawLocusTrimIndicators(context, locus, config, geometry = {}) {
  if (config.locus.trimIndicators?.show === false) return;
  const { fontSize, fontWeight, borderWidth, borderOpacity } = resolveTrimIndicatorStyle(
    config.locus.trimIndicators
  );
  const indicators = geometry.trimIndicators || locus.trimIndicators || [];
  if (!indicators.length) return;
  const { x: offsetX = 0, y: offsetY = 0 } = geometry.offsets || geometry;
  context.save();
  context.fillStyle = "#536b88";
  context.strokeStyle = `rgba(255, 255, 255, ${borderOpacity})`;
  context.lineWidth = borderWidth;
  context.lineJoin = "round";
  context.font = `${fontWeight} ${fontSize}px ${config.plot.fontFamily}`;
  context.textBaseline = "top";
  for (const indicator of indicators) {
    context.textAlign = indicator.anchor;
    context.strokeText(indicator.text, locus.x + indicator.x + offsetX, locus.y + indicator.y + offsetY);
    context.fillText(indicator.text, locus.x + indicator.x + offsetX, locus.y + indicator.y + offsetY);
  }
  context.restore();
}

function recordsForClusterPreview(
  scene,
  preview,
  viewport,
  { includeLinks = true, includeGenes = true } = {}
) {
  const { clusters, pairs } = clusterPreviewInViewport(scene, preview, viewport, { includeLinks });

  const loci = [];
  const genes = [];
  for (const cluster of clusters) {
    for (const locus of cluster.loci) {
      const offsets = previewOffsetsForLocus(preview, locus);
      if (!boundsInViewport(locus.bounds, viewport, offsets)) continue;
      loci.push(locus);
      if (!includeGenes) continue;
      const locusGenes =
        locus.genes ||
        [...scene.genes.values()].filter((gene) => gene.locus.source?.uid === locus.source.uid);
      for (const gene of locusGenes) {
        if (
          geneVisibleForPreview(preview, gene) &&
          boundsInViewport(gene.bounds, viewport, offsetsForGene(preview, gene))
        ) {
          genes.push(gene);
        }
      }
    }
  }

  const linkUids = new Set();
  for (const pair of pairs) {
    for (const uid of scene.linksByClusterPair?.get(pair) || []) linkUids.add(uid);
  }
  const links = [...linkUids]
    .map((uid) => scene.links.get(uid))
    .filter(Boolean)
    .sort((left, right) => left.order - right.order);

  return { clusters, loci, genes, links };
}

function drawLegend(context, legend) {
  if (!legend.visible) return;
  context.save();
  context.translate(legend.position.x, legend.position.y);
  context.font = `${legend.fontSize}px ${legend.fontFamily}`;
  const subtitleFontSize = legend.subtitleFontSize || Math.max(10, Math.round(legend.fontSize * 0.72));
  context.textAlign = "start";
  context.textBaseline = "middle";
  for (const item of legend.items) {
    context.beginPath();
    context.arc(item.x, item.y + item.circleY, item.radius, 0, 2 * Math.PI);
    context.fillStyle = item.colour;
    context.fill();
    context.fillStyle = legend.textColour || "black";
    context.fillText(item.label, item.x + item.textX, item.y + item.textY);
    if (item.subtitle) {
      context.fillStyle = legend.subtitleColour || "#566273";
      context.font = `${subtitleFontSize}px ${legend.fontFamily}`;
      context.fillText(item.subtitle, item.x + item.textX, item.y + item.subtitleY);
      context.font = `${legend.fontSize}px ${legend.fontFamily}`;
    }
  }
  context.restore();
}

function drawScaleBar(context, scaleBar) {
  if (!scaleBar.visible) return;
  const { x, y } = scaleBar.position;
  context.save();
  context.translate(x, y);
  context.strokeStyle = scaleBar.colour;
  context.lineWidth = scaleBar.strokeWidth;
  context.beginPath();
  context.moveTo(0, scaleBar.middle);
  context.lineTo(scaleBar.length, scaleBar.middle);
  context.moveTo(0, 0);
  context.lineTo(0, scaleBar.height);
  context.moveTo(scaleBar.length, 0);
  context.lineTo(scaleBar.length, scaleBar.height);
  context.stroke();
  context.fillStyle = scaleBar.textColour || "black";
  context.font = `${scaleBar.fontSize}px ${scaleBar.fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(scaleBar.label, scaleBar.length / 2, scaleBar.height + 5);
  context.restore();
}

function drawColourBar(context, colourBar) {
  if (!colourBar.visible) return;
  const { x, y } = colourBar.position;
  context.save();
  context.translate(x, y);
  const gradient = context.createLinearGradient(0, 0, colourBar.width, 0);
  gradient.addColorStop(0, colourBar.startColour);
  gradient.addColorStop(1, colourBar.endColour);
  context.fillStyle = gradient;
  context.fillRect(0, 0, colourBar.width, colourBar.height);
  context.strokeStyle = colourBar.textColour || "black";
  context.lineWidth = 1;
  context.strokeRect(0, 0, colourBar.width, colourBar.height);
  context.fillStyle = colourBar.textColour || "black";
  context.font = `${colourBar.fontSize}px ${colourBar.fontFamily}`;
  context.textBaseline = "top";
  context.textAlign = "center";
  context.fillText(colourBar.label, colourBar.width / 2, colourBar.height + 5);
  context.textAlign = "start";
  context.fillText(colourBar.startLabel, 0, colourBar.height + 5);
  context.textAlign = "end";
  context.fillText(colourBar.endLabel, colourBar.width, colourBar.height + 5);
  context.restore();
}

const interpolateNumber = (from, to, amount) => from + (to - from) * amount;

function interpolatePosition(from, to, amount) {
  if (!from || !to) return to;
  return {
    ...to,
    x: interpolateNumber(from.x, to.x, amount),
    y: interpolateNumber(from.y, to.y, amount),
  };
}

function interpolateArray(from, to, amount) {
  if (!from || !to || from.length !== to.length) return to;
  return to.map((value, index) => interpolateNumber(from[index], value, amount));
}

function interpolateLocus(from, to, amount) {
  if (!from) return to;
  const trackX = (locus, side) =>
    locus.track[side] ??
    locus[side === "x1" ? "worldStart" : "worldEnd"] - locus.x;
  return {
    ...to,
    x: interpolateNumber(from.x, to.x, amount),
    y: interpolateNumber(from.y, to.y, amount),
    worldStart: interpolateNumber(from.worldStart, to.worldStart, amount),
    worldEnd: interpolateNumber(from.worldEnd, to.worldEnd, amount),
    transform: interpolatePosition(from.transform, to.transform, amount),
    track: {
      ...to.track,
      x1: interpolateNumber(trackX(from, "x1"), trackX(to, "x1"), amount),
      x2: interpolateNumber(trackX(from, "x2"), trackX(to, "x2"), amount),
      y: interpolateNumber(from.track.y, to.track.y, amount),
    },
    hover: from.hover && to.hover
      ? {
          ...to.hover,
          x: interpolateNumber(from.hover.x, to.hover.x, amount),
          y: interpolateNumber(from.hover.y, to.hover.y, amount),
          width: interpolateNumber(from.hover.width, to.hover.width, amount),
          height: interpolateNumber(from.hover.height, to.hover.height, amount),
          leftHandleX: interpolateNumber(from.hover.leftHandleX, to.hover.leftHandleX, amount),
          rightHandleX: interpolateNumber(from.hover.rightHandleX, to.hover.rightHandleX, amount),
        }
      : to.hover,
  };
}

/**
 * Interpolate compatible scene geometry for Canvas animation. Sources,
 * hit-regions, and semantic state remain those of the target scene; only the
 * pixels in flight are interpolated.
 */
function interpolateCanvasScene(previous, scene, amount) {
  if (!previous || amount >= 1) return scene;
  const loci = new Map();
  for (const [uid, locus] of scene.loci) {
    loci.set(uid, interpolateLocus(previous.loci.get(uid), locus, amount));
  }

  const clusters = new Map();
  for (const [uid, cluster] of scene.clusters) {
    const prior = previous.clusters.get(uid);
    clusters.set(uid, {
      ...cluster,
      x: prior ? interpolateNumber(prior.x, cluster.x, amount) : cluster.x,
      y: prior ? interpolateNumber(prior.y, cluster.y, amount) : cluster.y,
      info: interpolatePosition(prior?.info, cluster.info, amount),
      loci: cluster.loci.map((locus) => loci.get(locus.source.uid)),
    });
  }

  const genes = new Map();
  for (const [uid, gene] of scene.genes) {
    const prior = previous.genes.get(uid);
    genes.set(uid, {
      ...gene,
      polygon: interpolateArray(prior?.polygon, gene.polygon, amount),
      locus: interpolatePosition(prior?.locus, gene.locus, amount),
      label: {
        ...gene.label,
        x: interpolateNumber(prior?.label?.x ?? gene.label.x, gene.label.x, amount),
        y: interpolateNumber(prior?.label?.y ?? gene.label.y, gene.label.y, amount),
        rotation: interpolateNumber(
          prior?.label?.rotation ?? gene.label.rotation,
          gene.label.rotation,
          amount
        ),
      },
    });
  }

  const links = new Map();
  for (const [uid, link] of scene.links) {
    const prior = previous.links.get(uid);
    const opacity = interpolateLinkOpacity(prior, link, amount);
    const anchors = interpolateLinkAnchors(previous, prior, scene, link, amount);
    links.set(uid, {
      ...link,
      // Retained scene link anchors are normalized upper-to-lower. During a
      // row swap that reverses which endpoint is upper, so interpolate in
      // stable query/target order to keep each end attached to its gene.
      anchors,
      labelPosition: interpolatePosition(prior?.labelPosition, link.labelPosition, amount),
      opacity,
      visible: opacity > 0 && Boolean(prior?.visible || link.visible),
    });
  }

  const priorPanels = new Map((previous.annotationPanels || []).map((panel) => [panel.uid, panel]));
  const annotationPanels = (scene.annotationPanels || []).map((panel) => ({ ...panel,
    x: interpolateNumber(priorPanels.get(panel.uid)?.x ?? panel.x, panel.x, amount) }));
  return { ...scene, clusters, loci, genes, links, annotationPanels };
}

const CANVAS_LAYERS = ["links", "linkLabels", "tracks", "trimIndicators", "genes", "geneLabels", "clusterLabels", "tree", "annotations", "annotationLabels", "chrome"];

/** Draw selected layers of a renderer-neutral scene into Canvas 2D. */
function renderCanvas({
  canvas,
  scene,
  tree = null,
  previousScene = null,
  previousTree = null,
  previousTreeScene = null,
  treeTargetScene = null,
  treeProgress = 1,
  treeTrackAnchor = true,
  progress = 1,
  camera,
  config,
  scales,
  hoverLocusUid = null,
  suppressLocusHover = false,
  pixelRatio: requestedPixelRatio = globalThis.devicePixelRatio || 1,
  dimensions = null,
  fullScene = false,
  preview = null,
  clear = true,
  include = null,
  omit = null,
  layers = CANVAS_LAYERS,
  highlightGeneIds = null,
  highlightLinkIds = null,
  highlightLocusIds = null,
}) {
  config = figureConfig(config);
  const show = (layer) => layers.includes(layer);
  const showLinks = show("links"), showGenes = show("genes");
  const showLoci = show("trimIndicators") || show("tracks");
  const showGeneLabels = show("geneLabels") && config.gene.label.show;
  const showLinkLabels = show("linkLabels") && config.link.label.show;
  const displayScene = interpolateCanvasScene(previousScene, scene, progress);
  const context = canvas.getContext("2d");
  const bounds = dimensions || canvas.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;
  const pixelRatio = requestedPixelRatio;
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (clear) {
    context.clearRect(0, 0, width, height);
  }
  context.save();
  context.translate(camera.x, camera.y);
  context.scale(camera.k, camera.k);

  // During an animation, geometry is between the previous and target scenes,
  // while the index describes only the target scene. Draw the full frame then
  // so an in-flight record cannot be incorrectly culled.
  const viewport = previousScene || fullScene
    ? null
    : canvasWorldViewport(canvas, camera, 20, dimensions);
  const clusterPreview = preview?.type === "cluster-drag";
  const visible = !clusterPreview && viewport && displayScene.index
    ? {
        links: (showLinks || showLinkLabels) ? queryViewportOrdered(displayScene.index.links, viewport) : null,
        loci: showLoci ? queryViewportOrdered(displayScene.index.loci, viewport) : null,
        genes: (showGenes || showGeneLabels) ? queryViewportOrdered(displayScene.index.genes, viewport) : null,
      }
    : null;

  const recordsFor = (records, ids, type, { ignoreOmit = false } = {}) => {
    const included = include?.[type];
    const omitted = ignoreOmit ? null : omit?.[type];
    const recordIds = ids || [...records.keys()];
    return recordIds
      .filter((uid) => (!included || included.has(uid)) && !omitted?.has(uid))
      .map((uid) => records.get(uid))
      .filter(Boolean);
  };
  const previewRecords = clusterPreview
    ? recordsForClusterPreview(displayScene, preview, viewport, {
        includeLinks: showLinks || showLinkLabels,
        includeGenes: showGenes || showGeneLabels,
      })
    : null;

  for (const link of (showLinks || showLinkLabels)
    ? previewRecords?.links || recordsFor(displayScene.links, visible?.links, "links")
    : []) {
    const geometry = linkGeometryForPreview(displayScene, link, preview, config);
    // Ordinary frames retain anchors on the link layout; only dynamic previews
    // provide replacement anchors in their sparse geometry patch.
    const anchors = geometry.anchors ?? link.anchors;
    if (!geometry.visible || !anchors) continue;
    if (
      clusterPreview &&
      (!boundsInViewport({
        minX: Math.min(anchors[0], anchors[1], anchors[3], anchors[4]),
        maxX: Math.max(anchors[0], anchors[1], anchors[3], anchors[4]),
        minY: Math.min(anchors[2], anchors[5]),
        maxY: Math.max(anchors[2], anchors[5]),
      }, viewport))
    ) {
      continue;
    }
    if (showLinks) drawLink(context, link, link.source, config, scales, geometry, showLinkLabels);
    else drawLinkLabel(context, link, link.source, config, anchors, geometry);
  }
  if (show("tree")) drawTree(context, tree, displayScene, config, preview, {
    trackAnchor: treeTrackAnchor,
    previousTree,
    previousScene: previousTreeScene,
    targetScene: treeTargetScene || scene,
    progress: treeProgress,
  });
  if (highlightLinkIds?.size) {
    for (const uid of highlightLinkIds) {
      if (visible?.links && !visible.links.includes(uid)) continue;
      const link = displayScene.links.get(uid);
      if (!link) continue;
      drawLinkHighlight(context, link, link.source, config, linkGeometryForPreview(displayScene, link, preview));
    }
  }
  const loci = showLoci
    ? previewRecords?.loci || recordsFor(displayScene.loci, visible?.loci, "loci")
    : [];
  // Labels are the only immediate indication that a very large, initially
  // cropped figure rendered at all. Do not derive them from culled loci: a
  // cluster label can be on screen while every locus body is just outside the
  // viewport. Text is inexpensive and Canvas clips truly offscreen labels.
  const labelClusters = show("clusterLabels")
    ? recordsFor(displayScene.clusters, null, "clusters", { ignoreOmit: true })
    : [];
  for (const cluster of labelClusters) {
    drawClusterInfo(context, cluster, config, {
      x: clusterLabelOffsetForPreview(preview, cluster.source.uid),
      y: clusterOffsetForPreview(preview, cluster.source.uid),
      locusText: clusterLabelTextForPreview(
        preview,
        cluster.source.uid,
        cluster.info.locusText
      ),
    });
  }
  if (show("tracks")) {
    for (const locus of loci) {
      drawLocusTrack(
        context,
        locus,
        viewport,
        config,
        locusGeometryForPreview(preview, locus)
      );
    }
  }
  if (show("trimIndicators")) {
    for (const locus of loci) {
      drawLocusTrimIndicators(
        context,
        locus,
        config,
        locusGeometryForPreview(preview, locus)
      );
    }
  }
  if (highlightLocusIds?.size) {
    for (const uid of highlightLocusIds) {
      if (visible?.loci && !visible.loci.includes(uid)) continue;
      const locus = displayScene.loci.get(uid);
      if (locus) drawLocusHighlight(context, locus, camera, locusGeometryForPreview(preview, locus));
    }
  }
  if (!suppressLocusHover) {
    const hoveredLocus = hoverLocusUid ? displayScene.loci.get(hoverLocusUid) : null;
    drawLocusHover(
      context,
      displayScene,
      hoverLocusUid,
      hoveredLocus ? locusGeometryForPreview(preview, hoveredLocus) : null,
      config.figureStyle.foreground
    );
  }
  for (const gene of (showGenes || showGeneLabels)
    ? previewRecords?.genes || recordsFor(displayScene.genes, visible?.genes, "genes")
    : []) {
    const offsets = offsetsForGene(preview, gene);
    const visible = geneVisibleForPreview(preview, gene);
    const geometry = geneGeometryForPreview(preview, gene);
    if (showGenes) drawGene(context, gene, config, scales, offsets, visible, geometry, showGeneLabels);
    else if (visible) drawGeneLabel(context, gene, config, geometry, offsets);
  }
  if (highlightGeneIds?.size) {
    for (const uid of highlightGeneIds) {
      if (visible?.genes && !visible.genes.includes(uid)) continue;
      const gene = displayScene.genes.get(uid);
      if (!gene || !geneVisibleForPreview(preview, gene)) continue;
      drawGeneHighlight(
        context,
        gene,
        camera,
        geneGeometryForPreview(preview, gene),
        offsetsForGene(preview, gene)
      );
    }
  }
  if (show("annotations") || show("annotationLabels")) drawCanvasAnnotations(context, displayScene, preview, {
    showGeometry: show("annotations"), showLabels: show("annotationLabels"), viewport,
  });
  if (show("chrome") && displayScene.chrome) {
    const chrome = preview?.chrome || displayScene.chrome;
    drawLegend(context, chrome.legend);
    drawScaleBar(context, chrome.scaleBar);
    drawColourBar(context, chrome.colourBar);
  }
  context.restore();
  return { width, height, pixelRatio };
}

/** One backdrop shared by all renderers; camera changes only update its transform. */
function createFigureSurface() {
  let context = null, measuredScene = null, measuredConfig = null, measuredBounds = null, measuredPreview = null;
  const textMetrics = new Map();

  function bounds(container, scene, config, tree, preview = null) {
    if (!container || !scene?.bounds) return null;
    if (scene !== measuredScene || config !== measuredConfig) textMetrics.clear();
    if (scene !== measuredScene || config !== measuredConfig || preview !== measuredPreview) {
      context ||= container.ownerDocument.createElement("canvas").getContext("2d");
      measuredBounds = canvasFigureBounds(context, scene, config, tree, { preview, textMetrics });
      measuredScene = scene;
      measuredConfig = config;
      measuredPreview = preview;
    }
    return { ...measuredBounds };
  }

  function update(container, scene, config, tree, camera, preview = null) {
    const extent = bounds(container.node(), scene, config, tree, preview);
    if (!extent) return;
    const padding = 20;
    const { x, y, k } = camera;
    const width = extent.maxX - extent.minX + padding * 2;
    const height = extent.maxY - extent.minY + padding * 2;
    const left = x + (extent.minX - padding) * k;
    const top = y + (extent.minY - padding) * k;
    container.selectAll("div.clusterMapFigureSurface").data([extent]).join(
      (enter) => enter.insert("div", ":first-child")
        .attr("class", "clusterMapFigureSurface").attr("aria-hidden", "true")
        .style("position", "absolute").style("left", "0").style("top", "0")
        .style("pointer-events", "none").style("transform-origin", "0 0")
    )
      .style("width", `${width}px`)
      .style("height", `${height}px`)
      .style("background", config.plot.background)
      .style("transform", `translate(${left}px, ${top}px) scale(${k})`);
    const label = container.selectAll("div.clusterMapFigureDimensions").data([extent]).join(
      (enter) => enter.append("div").attr("class", "clusterMapFigureDimensions")
        .attr("title", "Figure width × height at 100% zoom, including padding. SVG output is resolution independent.")
        .style("position", "absolute").style("left", "0").style("top", "0")
        .style("pointer-events", "none")
    ).style("transform", `translate(${left}px, ${top - 24}px)`);
    const text = `${Math.round(width).toLocaleString("en-US")} × ${Math.round(height).toLocaleString("en-US")} px`;
    if (label.text() !== text) label.text(text);
  }

  function clear() {
    context = measuredScene = measuredConfig = measuredBounds = measuredPreview = null;
    textMetrics.clear();
  }

  return { bounds, update, clear };
}

const colourHex = (value, fallback = "#888888") => color(value)?.formatHex() || fallback;

/** Native controls with consistent labels, values and validity handling. */
function createControls(document) {
  const el = (tag, text, parent, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    parent?.append(node); return node;
  };
  const row = (parent, label) => {
    const node = el("label", undefined, parent); el("span", label, node); return node;
  };
  const button = (parent, label, action, className) => {
    const node = el("button", label, parent, className); node.type = "button"; node.onclick = action; return node;
  };
  const input = (parent, label, value, type = "text", onChange, options = {}) => {
    const node = el("input", undefined, parent); Object.assign(node, { type, ...options });
    node.setAttribute("aria-label", label);
    if (type === "checkbox") node.checked = Boolean(value);
    else node.value = type === "color" ? colourHex(value) : value ?? "";
    if (type === "number" && options.step === undefined) node.step = "any";
    if (onChange) node.onchange = () => { if (node.checkValidity()) onChange(type === "checkbox" ? node.checked : node.value); };
    return node;
  };
  const select = (parent, label, value, entries, onChange) => {
    const node = el("select", undefined, parent); node.setAttribute("aria-label", label);
    for (const entry of entries) {
      const [key, title] = Array.isArray(entry) ? entry : [entry, entry];
      el("option", title, node).value = key;
    }
    node.value = value;
    if (onChange) node.onchange = () => onChange(node.value);
    return node;
  };
  const field = (parent, label, value, { type = "text", entries, options, commit, cancel } = {}) =>
    bindEditableField(entries ? select(parent, label, value, entries) : input(parent, label, value, type, undefined, options),
      { commit, cancel });
  return { el, row, button, input, select, field };
}

/** The same inline-field behaviour for DOM-built and markup-built tables. */
function bindEditableField(control, { commit, cancel }) {
  control.classList.add("cm-data-field");
  let saved = control.value;
  control.onchange = () => {
    control.setCustomValidity("");
    if (!control.checkValidity()) { control.reportValidity(); return; }
    if (control.value === saved) return;
    if (commit(control.value, control) !== false) saved = control.value;
    else control.reportValidity();
  };
  control.onkeydown = (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      control.value = saved; control.setCustomValidity(""); cancel?.();
    } else if (event.key === "Enter" && control.tagName === "INPUT") {
      event.preventDefault(); control.blur();
    }
  };
  return control;
}

/** Report rejected UI edits consistently while leaving validation in the model. */
function createActionRunner(report) {
  return (action, control) => {
    control?.setCustomValidity("");
    try { action(); report(""); return true; }
    catch (error) { report(error.message); control?.setCustomValidity(error.message); return false; }
  };
}

/** Shared fixed-height row window for scrollable data editors. */
const DATA_ROW_HEIGHT = 34;

function installDataEditorStyle(document) {
  if (document.getElementById("cm-data-editor-style")) return;
  const style = document.createElement("style"); style.id = "cm-data-editor-style";
  style.textContent = `
@layer clinker-editor {
.cm-data-ui { color:var(--cm-foreground,#273444); font:13px/1.4 system-ui,sans-serif; }
.cm-data-ui [hidden] { display:none!important; }
.cm-data-ui form { margin:0; }
.cm-data-ui :is(button,input,select,textarea) { font:inherit; color:inherit; box-sizing:border-box; }
.cm-data-ui :where(button,select,input:not([type=color]):not([type=checkbox]):not([type=range]),textarea) { min-height:var(--cm-control-height,30px); padding:var(--cm-control-padding,4px 8px); border:1px solid var(--cm-border,#cbd3de); border-radius:var(--cm-control-radius,6px); background:var(--cm-surface,#fff); }
.cm-data-ui input[type=checkbox] { cursor:pointer; }
.cm-data-ui input[type=color] { width:30px; height:22px; padding:0; border:0; background:transparent; }
.cm-data-ui button { cursor:pointer; }
.cm-data-ui button:hover:not(:disabled) { border-color:var(--cm-accent,#78a9ed); background:var(--cm-hover,#f4f8ff); }
.cm-data-ui :where(button,summary):focus-visible { outline:2px solid var(--cm-accent,#1677ff); outline-offset:2px; }
.cm-data-ui summary { cursor:pointer; }
.cm-data-ui summary:hover { color:var(--cm-accent,#1677ff); }
.cm-data-ui button:disabled { color:var(--cm-muted,#8993a1); opacity:.45; cursor:default; }
.cm-data-segmented { display:flex; padding:3px; border:1px solid var(--cm-border,#e0e5eb); border-radius:7px; background:var(--cm-subtle,#f3f6fa); }
.cm-data-segmented button { min-height:28px; border:0; background:transparent; }
.cm-data-segmented button[aria-pressed=true] { background:var(--cm-surface,#fff); box-shadow:0 1px 2px rgba(29,43,61,.16); font-weight:600; }
.cm-data-segmented button:hover:not(:disabled) { background:var(--cm-hover,#e3ecf8); color:var(--cm-foreground,#273444); }
.cm-data-ui .cm-data-icon-button { display:inline-grid; place-items:center; width:var(--cm-icon-size,28px); min-width:var(--cm-icon-size,28px); min-height:var(--cm-icon-size,28px); padding:0; border:0; background:transparent; color:var(--cm-muted,#64748b); line-height:1; }
.cm-data-ui .cm-data-icon-button:hover:not(:disabled) { background:var(--cm-hover,#e3ecf8); color:var(--cm-accent,#1677ff); }
.cm-data-icon-button svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.cm-data-ui .cm-data-icon-button--edit { --cm-icon-size:20px; display:none; flex:0 0 20px; }
.cm-data-row:is(:hover,:focus-within,.is-selected) .cm-data-icon-button--edit { display:inline-grid; }
.cm-data-icon-button--edit svg { width:14px; height:14px; }
.cm-data-action-group { display:flex; align-items:center; gap:6px; }
.cm-data-action-group + .cm-data-action-group { border-left:1px solid var(--cm-border,#d5e0ee); padding-left:10px; }
.cm-data-action-group label { display:flex; align-items:center; gap:5px; white-space:nowrap; }
.cm-data-action-group input[type=number] { width:112px; }
.cm-data-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; flex-shrink:0; }
.cm-data-search { display:flex; flex:1; min-width:140px; }
.cm-data-search input { width:100%; }
.cm-data-error { color:var(--cm-danger,#b42318); font-size:12px; margin:6px 0; }
.cm-data-error:empty { display:none; }
.cm-data-panel { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; gap:8px; }
.cm-data-tools { flex-shrink:0; }
.cm-data-meta { display:flex; align-items:center; justify-content:space-between; min-height:30px; flex-shrink:0; color:var(--cm-muted,#687586); font-size:12px; }
.cm-data-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; flex-shrink:0; padding:8px 10px; border:1px solid var(--cm-border,#cbd3de); border-radius:8px; background:var(--cm-subtle,#f3f6fa); }
.cm-data-actions strong { padding:4px 7px; border-radius:5px; background:var(--cm-selection,#d6e6fc); color:var(--cm-foreground,#273444); }
.cm-data-selection-actions { display:contents; }
.cm-data-table { flex:1; min-height:120px; overflow:auto; overflow-anchor:none; }
.cm-data-head { box-sizing:border-box; height:32px; border-bottom:1px solid var(--cm-border,#dbe2eb); background:var(--cm-subtle,#f3f6fa); color:var(--cm-muted,#556274); font-size:11px; line-height:20px; font-weight:650; text-align:left; }
.cm-data-row { --cm-row-background:var(--cm-surface,#fff); box-sizing:border-box; height:${DATA_ROW_HEIGHT}px; border-bottom:1px solid var(--cm-border,#eee); background:var(--cm-row-background); font-size:13px; line-height:20px; }
.cm-data-row > :is(th,td) { height:${DATA_ROW_HEIGHT}px; box-sizing:border-box; background:var(--cm-row-background); border-bottom:1px solid var(--cm-border,#eee); }
.cm-data-row:is(:hover,:focus-within) { --cm-row-background:var(--cm-hover,#e3ecf8); }
.cm-data-row.is-selected { --cm-row-background:var(--cm-selection,#d6e6fc); }
.cm-data-cell { box-sizing:border-box; padding:0 8px; text-align:left; vertical-align:middle; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-data-cell--select { width:32px; min-width:32px; padding:0; text-align:center; }
span.cm-data-cell--select { display:flex; align-items:center; justify-content:center; }
.cm-data-cell--select input { display:block; margin:auto; }
.cm-data-cell > input[type=color] { display:block; }
.cm-data-ui .cm-data-cell .cm-data-field { padding-inline:0; margin-inline:-1px; }
.cm-data-ui input.cm-data-field.cm-data-cell { padding-inline:7px; }
.cm-data-placeholder { color:var(--cm-muted,#687586); font-style:normal; }
.cm-data-ui .cm-data-field { min-width:0; border-color:transparent!important; background:transparent!important; }
.cm-data-ui .cm-data-row .cm-data-field { height:28px; min-height:28px; padding-block:2px; line-height:20px; }
.cm-data-ui .cm-data-field:is(:hover,:focus) { border-color:var(--cm-accent,#c6d8f0)!important; background:var(--cm-surface,#fff)!important; }
.cm-data-ui .cm-data-field:focus-visible { outline:2px solid var(--cm-accent,#1677ff); outline-offset:-2px; }
.cm-data-field::placeholder { color:var(--cm-muted,#7b8796); }
.cm-data-field[type=number]:not(:hover):not(:focus) { appearance:textfield; -moz-appearance:textfield; }
.cm-data-field[type=number]:not(:hover):not(:focus)::-webkit-inner-spin-button { appearance:none; }
select.cm-data-field:not(:hover):not(:focus) { appearance:none; }
}
`;
  document.head.append(style);
}

// Structural styles and the same neutral controls used by the plot editor.
function installTreeControlsStyle(doc) {
  if (doc.getElementById("clustermap-tree-controls-style")) return;
  const style = doc.createElement("style");
  style.id = "clustermap-tree-controls-style";
  style.textContent = `
.cm-tree-controls { font:inherit; color:inherit; text-align:left; }
.cm-tree-controls * { box-sizing:border-box; }
.cm-tree-controls [hidden] { display:none!important; }
.cm-tree-controls fieldset { min-width:0; margin:0 0 10px; padding:8px; border:1px solid var(--cm-border,#ddd); border-radius:4px; }
.cm-tree-controls legend { padding:0 4px; font-weight:600; }
.cm-tree-controls button[aria-pressed=true] { font-weight:600; }
.cm-tree-controls .cm-tree-row { display:flex; align-items:center; gap:6px; margin:6px 0; }
.cm-tree-controls .cm-tree-row > span { flex:1; min-width:0; }
.cm-tree-controls input[type=number] { width:64px; min-width:0; }
.cm-tree-controls input[type=range] { width:100%; }
.cm-tree-controls select { width:132px; min-width:0; }
.cm-tree-controls input[type=color] { width:30px; height:24px; padding:0; border:0; background:transparent; cursor:pointer; }
.cm-tree-controls .cm-tree-heading { font-weight:600; margin-bottom:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-tree-controls .cm-tree-branch-row { display:grid; grid-template-columns:minmax(0,1fr) 30px 64px 28px; gap:6px; align-items:center; margin:8px 0; }
.cm-tree-controls .cm-tree-reset { width:28px; padding:2px; min-height:26px; }
.cm-tree-controls .cm-tree-wide { display:block; }
.cm-tree-controls .cm-tree-wide > span { display:block; margin-bottom:4px; }
.cm-tree-controls .cm-tree-wide input, .cm-tree-controls .cm-tree-wide select { width:100%; }
.cm-tree-controls .cm-tree-format { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
.cm-tree-controls .cm-tree-format .cm-tree-row { gap:3px; }
.cm-tree-controls .cm-tree-separator { border:0; border-top:1px solid var(--cm-border,#e5e9ef); margin:10px 0; }
.cm-tree-controls .cm-tree-actions { display:flex; gap:6px; margin-top:10px; }
.cm-tree-controls [role=status]:empty { display:none; }
.cm-tree-controls [role=status] { color:var(--cm-danger,#a13c46); margin:6px 0 0; }
.cm-tree-controls--popover { width:260px; max-width:calc(100vw - 40px); max-height:75vh; overflow:auto; font-size:12px; line-height:1.3; }
.cm-tree-controls--popover .cm-tree-heading { font-size:12px; margin-bottom:6px; }
.cm-tree-controls--popover button, .cm-tree-controls--popover input:not([type=checkbox]):not([type=color]) { min-height:24px; padding:2px 5px; border-radius:4px; }
.cm-tree-controls--popover input[type=number] { width:52px; }
.cm-tree-controls--popover input[type=color] { width:24px; height:20px; }
.cm-tree-controls--popover input[type=checkbox] { width:12px; height:12px; margin:0; }
.cm-tree-controls--popover .cm-tree-branch-row { grid-template-columns:minmax(0,1fr) 24px 52px 22px; gap:5px; margin:5px 0; }
.cm-tree-controls--popover .cm-tree-reset { width:22px; min-height:22px; padding:0; }
.cm-tree-controls--popover .cm-tree-row { margin:4px 0; gap:4px; }
.cm-tree-controls--popover .cm-tree-format { gap:5px; }
.cm-tree-controls--popover .cm-tree-separator { margin:6px 0; }
.cm-tree-controls--popover .cm-tree-actions { margin-top:6px; }
`;
  doc.head.append(style);
}

/** Policy settings and node popovers share the same compact editing form. */
function createTreeControls({ tree, config, patch, preview, rotate, clusters = [], nodeUid = null,
  policy = true, onResize, document: doc = globalThis.document }) {
  installDataEditorStyle(doc);
  installTreeControlsStyle(doc);
  const ui = createControls(doc);
  const element = (tag, parent, text, className) => ui.el(tag, text, parent, className);
  const container = element("div", null, undefined, `cm-data-ui cm-tree-controls${policy ? "" : " cm-tree-controls--popover"}`);
  const message = element("p"); message.setAttribute("role", "status");
  const run = createActionRunner((text) => { message.textContent = text; });
  const button = (parent, title, action, className) => ui.button(parent, title, () => run(action), className);
  const section = (title) => { const field = element("fieldset", container); element("legend", field, title); return field; };
  const input = (parent, title, type, value, options = {}) => {
    const row = ui.row(parent, title); row.className = "cm-tree-row";
    return ui.input(row, title, value, type, undefined, options);
  };
  const reset = (scope, uid) => patch([{ type: "tree.presentation.reset", scope, ...(uid ? { ids: [uid] } : {}) }]);
  const resolved = resolveTreePresentation(tree, config);

  let compatible = tree.distance?.kind === "mergeHeight";
  try { validateTreePresentation({ ...tree, presentation: { ...tree.presentation, colouring: { ...resolved.policy, mode: "cutHeight" } } }, config); }
  catch { compatible = false; }
  if (policy && compatible) {
    const field = section("Clade colouring");
    const effective = resolved.policy;
    const change = (changes) => [{ type: "tree.presentation.update", scope: "tree", changes: { colouring: changes } }];
    const enabled = input(field, "Colour clades", "checkbox", effective.mode === "cutHeight");
    enabled.onchange = () => run(() => patch(change({ mode: enabled.checked ? "cutHeight" : "none" })));
    const options = element("div", field); options.hidden = !enabled.checked;
    const actual = effective.cutHeight === "auto" ? resolved.height * 0.7 : effective.cutHeight;
    const number = input(options, "Cut height", "number", actual, { min: "0", step: "any" });
    number.onchange = () => run(() => patch(change({ cutHeight: Number(number.value) })));
    const slider = element("input", options); slider.type = "range";
    Object.assign(slider, { min: "0", max: String(Math.max(resolved.height, actual) || 1), step: String(resolved.height / 1000 || 0.001), value: actual });
    slider.setAttribute("aria-label", "Preview cut height");
    let cancelled = false;
    const cancel = () => { cancelled = true; preview?.(null); slider.value = actual; number.value = actual; };
    slider.oninput = () => run(() => { cancelled = false; number.value = slider.value; preview?.(change({ cutHeight: Number(slider.value) })); });
    slider.onchange = () => { if (!cancelled) run(() => patch(change({ cutHeight: Number(slider.value) }))); };
    slider.onkeydown = (event) => { if (event.key === "Escape") { cancel(); event.preventDefault(); } };
    slider.onpointercancel = cancel;
    const auto = button(number.parentElement, "Auto", () => patch(change({ cutHeight: "auto" })));
    auto.title = "Use automatic cut height (70%)";
    auto.setAttribute("aria-pressed", String(effective.cutHeight === "auto"));
    const palettes = [
      ["Muted", ["#267c9e", "#d7752d", "#5c8f39", "#9963a5", "#c34d61", "#9e8433"]],
      ["Colorblind friendly", ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#d55e00", "#56b4e9"]],
    ];
    if (!palettes.some(([, colours]) => JSON.stringify(colours) === JSON.stringify(effective.palette))) palettes.unshift(["Custom", effective.palette]);
    const paletteRow = element("label", options, undefined, "cm-tree-row"); element("span", paletteRow, "Palette");
    const select = element("select", paletteRow); select.setAttribute("aria-label", "Clade palette");
    palettes.forEach(([name, colours], index) => { const option = element("option", select, name); option.value = index; option.selected = JSON.stringify(colours) === JSON.stringify(effective.palette); });
    select.onchange = () => run(() => patch(change({ palette: palettes[Number(select.value)][1] })));
    const line = input(options, "Show cut line", "checkbox", effective.showCutLine);
    line.onchange = () => run(() => patch(change({ showCutLine: line.checked })));
  }

  if (policy) {
    const resetAll = button(container, "Reset all manual styles", () => reset("manual"));
    resetAll.title = "Clear manual tree styles and labels; keep automatic clade colouring.";
    resetAll.disabled = !Object.keys(tree.presentation?.nodes || {}).length && !Object.keys(tree.presentation?.subtrees || {}).length;
    container.append(message);
    return container;
  }

  const nodesById = new Map(tree.nodes.map((node) => [node.uid, node]));
  const clusterNames = new Map(clusters.map((cluster) => [cluster.uid, cluster.name || cluster.label || cluster.uid]));
  const descriptions = new Map();
  const describe = (uid) => {
    if (descriptions.has(uid)) return descriptions.get(uid);
    const node = nodesById.get(uid);
    const children = node.children?.map(describe);
    const info = children ? { count: children.reduce((sum, child) => sum + child.count, 0), labels: children.flatMap((child) => child.labels).slice(0, 2) }
      : { count: 1, labels: [node.label || clusterNames.get(node.cluster) || node.cluster] };
    descriptions.set(uid, info);
    return info;
  };
  const titleFor = (uid) => {
    const node = nodesById.get(uid);
    if (node.label) return node.label;
    const { count, labels } = describe(uid);
    return uid === tree.root ? `All ${count} clusters` : `${labels.join(" + ")}${count > 2 ? ` + ${count - 2} more` : ""}`;
  };
  const uid = nodesById.get(nodeUid)?.children ? nodeUid : nodesById.get(tree.root)?.children ? tree.root : null;
  const host = element("div", container);

  const colourInput = (parent, title, value, fallback, onChange) => {
    const picker = element("input", parent); picker.type = "color";
    const initial = color(value || fallback)?.formatHex() || "#555555";
    let override = value ?? null;
    const refresh = () => {
      picker.value = color(override || fallback)?.formatHex() || initial;
      picker.title = `${title}${override === null ? " (inherited)" : ""}`;
    };
    picker.setAttribute("aria-label", title); refresh();
    picker.oninput = () => {
      if (picker.value === override) return;
      run(() => { onChange(picker.value); override = picker.value; picker.title = title; });
    };
    picker.onchange = picker.oninput;
    return { reset: () => { override = null; refresh(); } };
  };
  const liveNumber = (control, onChange) => {
    let previous = control.value === "" ? null : Number(control.value);
    control.oninput = () => {
      if (!control.validity.valid) return;
      const next = control.value === "" ? null : Number(control.value);
      if (next === previous) return;
      run(() => { onChange(next); previous = next; });
    };
    control.onchange = control.oninput;
    return (value = "") => { control.value = value; previous = value === "" ? null : Number(value); };
  };
  const resetButton = (parent, title, action) => {
    const control = button(parent, "↺", action, "cm-tree-reset");
    control.title = title; control.setAttribute("aria-label", title); return control;
  };
  function renderNode() {
    if (!host || !uid) return;
    host.replaceChildren();
    host.setAttribute("role", "group"); host.setAttribute("aria-label", "Tree node settings");
    const heading = element("div", host, titleFor(uid), "cm-tree-heading"); heading.title = heading.textContent;
    button(host, "Rotate branches", () => rotate(uid));
    const inheritedBranch = (scope) => {
      const collection = scope === "subtree" ? "subtrees" : "nodes";
      const records = tree.presentation?.[collection] || {};
      const record = { ...records[uid] }; delete record.branch;
      const inherited = resolveTreePresentation({ ...tree, presentation: {
        ...tree.presentation, [collection]: { ...records, [uid]: record },
      } }, config);
      return (scope === "subtree" ? inherited.stems : inherited.branches).get(uid) || inherited.base;
    };
    const branchControls = (scope, title, style, fallback) => {
      const row = element("div", host, undefined, "cm-tree-branch-row");
      const name = element("span", row, title);
      name.title = scope === "subtree" ? "Branches within this clade, excluding its incoming branch." : "Only the horizontal branch entering this node.";
      const update = (branch) => patch([{ type: "tree.presentation.update", scope, ids: [uid], changes: { branch } }]);
      const colour = colourInput(row, `${title} colour`, style?.colour, fallback.colour, (colour) => update({ colour }));
      const width = element("input", row); width.type = "number";
      Object.assign(width, { min: "0.1", step: "any", value: style?.width ?? fallback.width });
      width.setAttribute("aria-label", `${title} thickness`); width.title = "Thickness (px); leave blank to inherit";
      const clearWidth = liveNumber(width, (width) => update({ width }));
      width.onblur = () => {
        if (width.value !== "") return;
        const current = resolveTreePresentation(tree, config);
        clearWidth((scope === "subtree" ? current.stems : current.branches).get(uid)?.width ?? current.base.width);
      };
      resetButton(row, `Reset ${title.toLowerCase()} style`, () => { update(null); colour.reset(); clearWidth(fallback.width); });
    };
    branchControls("subtree", "Subtree", tree.presentation?.subtrees?.[uid]?.branch, inheritedBranch("subtree"));
    const record = tree.presentation?.nodes?.[uid] || {};
    if (uid !== tree.root) branchControls("node", "Incoming branch", record.branch, inheritedBranch("node"));
    element("hr", host, undefined, "cm-tree-separator");
    const label = record.label || {};
    const text = input(host, "Label", "text", label.text, { placeholder: "Clade label" });
    text.setAttribute("aria-label", "Annotation text"); text.parentElement.classList.add("cm-tree-wide");
    const updateLabel = (label) => patch([{ type: "tree.presentation.update", scope: "node", ids: [uid], changes: { label } }]);
    let previousText = text.value;
    text.oninput = () => {
      if (text.value === previousText) return;
      run(() => { updateLabel({ text: text.value || null }); previousText = text.value; });
    };
    const formatting = element("div", host, undefined, "cm-tree-format");
    const colour = colourInput(formatting, "Text colour", label.colour, "#333", (colour) => updateLabel({ colour }));
    const size = element("input", formatting); size.type = "number";
    Object.assign(size, { min: "1", step: "any", value: label.fontSize ?? "", placeholder: "10" });
    size.setAttribute("aria-label", "Text size"); size.title = "Text size (px); leave blank to inherit";
    const bold = input(formatting, "Bold", "checkbox", label.fontWeight === 700);
    const italic = input(formatting, "Italic", "checkbox", label.fontStyle === "italic");
    const clearSize = liveNumber(size, (fontSize) => updateLabel({ fontSize }));
    bold.onchange = () => run(() => updateLabel({ fontWeight: bold.checked ? 700 : null }));
    italic.onchange = () => run(() => updateLabel({ fontStyle: italic.checked ? "italic" : null }));
    resetButton(formatting, "Clear label and formatting", () => {
      updateLabel(null);
      text.value = ""; previousText = ""; colour.reset(); clearSize(); bold.checked = false; italic.checked = false;
    });
    const actions = element("div", host, undefined, "cm-tree-actions");
    const resetNode = button(actions, "Reset", () => {
      if (tree.presentation?.subtrees?.[uid] || tree.presentation?.nodes?.[uid]) {
        patch([
          { type: "tree.presentation.reset", scope: "subtree", ids: [uid] },
          { type: "tree.presentation.reset", scope: "node", ids: [uid] },
        ]);
      }
      renderNode();
      host.querySelector(".cm-tree-actions button")?.focus({ preventScroll: true });
    });
    resetNode.title = "Reset this node's subtree style, incoming branch and label; keep descendant overrides and automatic colouring.";
    onResize?.();
  }
  renderNode();
  container.append(message);
  return container;
}

// Browser-only tooltip lifecycle shared by any chart renderer. Menu content is

function createHtmlOverlay({
  tooltip,
  scales,
  actions,
  eventNamespace = ".clusterMapTooltip",
}) {
  const windowRef = tooltip.node()?.ownerDocument?.defaultView;
  const clickEvent = `click${eventNamespace}`;
  const keyEvent = `keydown${eventNamespace}`;
  let focusTarget = null;
  let treeMenu = false;
  let menuTree = null;

  const hide = (returnFocus = false) => {
    if (windowRef) select(windowRef).on(clickEvent, null).on(keyEvent, null);
    tooltip.style("opacity", 0).style("pointer-events", "none").attr("aria-hidden", "true").property("inert", true);
    const wasTreeMenu = treeMenu;
    treeMenu = false;
    menuTree = null;
    if (returnFocus && focusTarget?.isConnected) focusTarget.focus?.({ preventScroll: true });
    focusTarget = null;
    if (wasTreeMenu) tooltip.html("");
  };

  const dismissOnOutsideClick = (event) => {
    const node = tooltip.node();
    if (!node || event.target === node || node.contains(event.target) || event.composedPath?.().includes(node)) return;
    hide();
  };

  const position = (event) => {
    const bounds = tooltip.node().getBoundingClientRect();
    const rect = event.target?.getBoundingClientRect?.();
    const x = event.clientX ?? (rect ? rect.x + rect.width / 2 : 0);
    const y = event.clientY ?? (rect ? rect.y + rect.height : 0);
    tooltip
      .interrupt()
      .style("left", `${Math.max(8, Math.min(x - bounds.width / 2, (windowRef?.innerWidth || Infinity) - bounds.width - 8))}px`)
      .style("top", `${Math.max(8, Math.min(y + 12, (windowRef?.innerHeight || Infinity) - bounds.height - 8))}px`)
      .style("opacity", 1)
      .style("pointer-events", "all");
  };
  const show = (event, contents) => {
    tooltip.html("").append(() => contents.node());
    tooltip.attr("aria-hidden", null).property("inert", false).style("position", "fixed");
    position(event);
  };

  const geneContents = (gene) => {
    const div = create$1("div").attr("class", "tooltip-contents")
      .style("display", "flex").style("flex-direction", "column")
      .style("gap", "4px").style("width", "260px");
    div.append("label").attr("for", "gene-label-input").text("Edit label");
    const text = div.append("input").attr("id", "gene-label-input").attr("type", "text")
      .attr("value", gene.label || gene.name || gene.uid).style("box-sizing", "border-box").style("width", "100%");
    div.append("label").attr("for", "gene-qualifiers-input").text("Gene qualifiers");
    const select = div.append("select").attr("id", "gene-qualifiers-input").attr("multiple", true)
      .attr("size", 4).style("box-sizing", "border-box").style("width", "100%");
    const names = gene.names || {};
    select.selectAll("option").data(Object.keys(names)).join("option")
      .text((key) => `${names[key]} [${key}]`).attr("value", (key) => names[key]);
    const groupId = scales.group(gene.uid);
    const group = div.append("div").style("margin-top", "2px");
    group.append("span").text("Similarity group: ");
    group.append("span").text(scales.name(groupId)).style("color", scales.colour(groupId)).style("font-weight", "bold");
    const colour = color(gene.colour || scales.colour(groupId));
    const pickerColour = colour ? colour.formatHex() : "#000000";
    div.append("label").text("Choose gene colour: ").append("input")
      .attr("type", "color").attr("value", pickerColour).property("value", pickerColour)
      .on("change", (event) => actions.updateGene(gene, { colour: event.target.value }));
    div.append("button").text("Anchor map on gene").on("click", () => actions.anchorGene(gene));
    if (typeof actions.revealGene === "function") {
      div.append("button").text("Reveal in data editor").on("click", () => {
        actions.revealGene(gene);
        hide();
      });
    }
    text.on("input", (event) => { actions.updateGene(gene, { label: event.target.value }); select.attr("value", null); });
    select.on("change", (event) => { actions.updateGene(gene, { label: event.target.value }); text.attr("value", event.target.value); });
    return div;
  };

  const groupContents = (group) => {
    const div = create$1("div").attr("class", "tooltip-contents")
      .style("display", "flex").style("flex-direction", "column");
    div.append("label").text("Edit label");
    const text = div.append("input").attr("type", "text").attr("value", group.label || group.uid);
    div.append("label").text("Merge with...");
    const groups = actions.getGroups();
    const select = div.append("select").attr("multiple", true);
    select.selectAll("option").data(groups.filter((candidate) => candidate.uid !== group.uid)).join("option")
      .text((candidate) => candidate.label).attr("value", (candidate) => candidate.uid);
    div.append("button").text("Merge!").on("click", () => {
      const sourceIds = [...select.node().options]
        .filter((option) => option.selected)
        .map((option) => groups.find((candidate) => String(candidate.uid) === option.value)?.uid)
        .filter((uid) => uid !== undefined);
      if (sourceIds.length) actions.mergeGroups(group, sourceIds);
    });
    const colour = color(group.colour);
    const pickerColour = colour ? colour.formatHex() : "#000000";
    div.append("label").text("Choose group colour: ").append("input")
      .attr("type", "color").attr("value", pickerColour).property("value", pickerColour)
      .on("change", (event) => actions.updateGroup(group, { colour: event.target.value }));
    div.append("button").text("Hide group").on("click", () => actions.updateGroup(group, { hidden: true }));
    if (typeof actions.revealGroup === "function") {
      div.append("button").text("Reveal in data editor").on("click", () => {
        actions.revealGroup(group);
        hide();
      });
    }
    text.on("input", (event) => actions.updateGroup(group, { label: event.target.value }));
    return div;
  };

  return {
    node: tooltip.node(),
    hide,
    isTreeMenuOpen: (tree) => treeMenu && menuTree === tree,
    enter: () => {
      tooltip
        .interrupt()
        .attr("aria-hidden", null).property("inert", false)
        .style("opacity", 1)
        .style("pointer-events", "all");
      // A chart must never replace another chart's window listener. The
      // namespace is supplied by the chart runtime and removed on dismissal.
      if (windowRef) select(windowRef).on(clickEvent, dismissOnOutsideClick);
    },
    leave: () => {
      if (treeMenu) return;
      const active = document.activeElement;
      if (active?.tagName === "INPUT" && tooltip.node().contains(active)) return;
      tooltip
        .transition()
        .delay(400)
        .style("opacity", 0)
        .style("pointer-events", "none");
    },
    show,
    showGeneMenu: (event, gene) => { event.preventDefault(); show(event, geneContents(gene)); },
    showGroupMenu: (event, group) => { event.preventDefault(); show(event, groupContents(group)); },
    showTreeMenu: (event, uid) => {
      event.preventDefault(); event.stopPropagation();
      focusTarget = event.target;
      const options = actions.treeControls();
      menuTree = options.tree;
      const controls = createTreeControls({ ...options, nodeUid: uid, policy: false,
        onResize: () => { if (treeMenu) position(event); } });
      show(event, select(controls));
      treeMenu = true;
      if (windowRef) {
        select(windowRef).on(clickEvent, dismissOnOutsideClick).on(keyEvent, (key) => {
          if (key.key === "Escape" && treeMenu) { key.preventDefault(); hide(true); }
        });
      }
      controls.querySelector("button, input, select")?.focus({ preventScroll: true });
    },
    dispose: () => {
      tooltip.interrupt();
      hide(treeMenu);
    },
  };
}

// Translates renderer-independent pointer coordinates into chart-state actions.
// Renderers only need to forward pointer events in chart-world coordinates.
function createInteractionController({
  clusterRows,
  getClusterOrder,
  getClusterPosition,
  getTree = () => null,
  getLocusOffset,
  selectedLocusIds = () => [],
  selectedClusterIds = () => [],
  setDragging,
  previewClusterDrag,
  commitClusterOrder,
  previewLocusOffset,
  previewLocusOffsets = null,
  commitLocusOffset,
  previewLocusTrim,
  commitLocusTrim,
  cancelInteraction = () => {},
  flipLocus,
}) {
  let clusterDrag = null;
  let locusDrag = null;

  const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));

  return {
    beginClusterDrag(uid, pointerY) {
      const order = [...getClusterOrder()];
      const selected = new Set(selectedClusterIds());
      // Dragging a selected cluster moves every selected cluster as one
      // ordered block. A cluster outside the selection keeps the familiar
      // single-row drag behaviour.
      const uids = selected.has(uid)
        ? order.filter((clusterUid) => selected.has(clusterUid))
        : [uid];
      const remaining = order.filter((clusterUid) => !uids.includes(clusterUid));
      const draggedIndex = uids.indexOf(uid);
      const legalInsertions = [];
      for (let insertion = 0; insertion <= remaining.length; insertion += 1) {
        const candidate = [
          ...remaining.slice(0, insertion),
          ...uids,
          ...remaining.slice(insertion),
        ];
        if (isTreeOrderCompatible(getTree(), candidate)) legalInsertions.push(insertion);
      }
      clusterDrag = {
        uid,
        uids,
        draggedIndex,
        legalInsertions,
        baseOrder: order,
        blocked: legalInsertions.length === 0,
        selected: new Set(uids),
        order,
        positions: new Map(uids.map((clusterUid) => [
          clusterUid,
          getClusterPosition(clusterUid),
        ])),
        pointerOffset: getClusterPosition(uid) - pointerY,
      };
      setDragging(true);
    },

    moveClusterDrag(pointerY) {
      if (!clusterDrag) return;
      if (clusterDrag.blocked) return;
      const range = clusterRows();
      const selectedYs = [...clusterDrag.positions.values()];
      const anchorY = clusterDrag.positions.get(clusterDrag.uid);
      const rowMin = Math.min(...range);
      const rowMax = Math.max(...range);
      const extentMin = rowMin + anchorY - Math.min(...selectedYs);
      const extentMax = rowMax - (Math.max(...selectedYs) - anchorY);
      const legalTargets = clusterDrag.legalInsertions.map((insertion) => ({
        insertion,
        index: insertion + clusterDrag.draggedIndex,
        y: range[insertion + clusterDrag.draggedIndex],
      })).filter((candidate) => candidate.y >= extentMin && candidate.y <= extentMax);
      if (!legalTargets.length) return;
      const legalMin = Math.min(...legalTargets.map((candidate) => candidate.y));
      const legalMax = Math.max(...legalTargets.map((candidate) => candidate.y));
      // Keep the whole selected set inside the plot and stop at the first or
      // last tree-compatible insertion. Using only the dragged row's range
      // lets a multi-row selection overrun either boundary.
      const allowedY = [Math.max(legalMin, extentMin), Math.min(legalMax, extentMax)];
      const rawY = clamp(pointerY + clusterDrag.pointerOffset, allowedY);
      const target = legalTargets.reduce((closest, candidate) =>
        Math.abs(candidate.y - rawY) < Math.abs(closest.y - rawY) ? candidate : closest
      , legalTargets[0]);
      const previous = legalTargets
        .filter((candidate) => candidate.y < target.y)
        .at(-1);
      const next = legalTargets.find((candidate) => candidate.y > target.y);
      const minY = previous ? (previous.y + target.y) / 2 : legalMin;
      const maxY = next ? (next.y + target.y) / 2 : legalMax;
      const y = clamp(rawY, [
        Math.max(Math.min(minY, maxY), allowedY[0]),
        Math.min(Math.max(minY, maxY), allowedY[1]),
      ]);
      const remaining = clusterDrag.baseOrder.filter((uid) => !clusterDrag.selected.has(uid));
      const order = [
        ...remaining.slice(0, target.insertion),
        ...clusterDrag.uids,
        ...remaining.slice(target.insertion),
      ];
      clusterDrag.order = order;
      const delta = y - clusterDrag.positions.get(clusterDrag.uid);
      const positions = new Map(
        [...clusterDrag.positions].map(([uid, position]) => [uid, position + delta])
      );
      previewClusterDrag(clusterDrag.uid, y, order, positions);
    },

    endClusterDrag() {
      if (!clusterDrag) return;
      clusterDrag = null;
      setDragging(false);
      commitClusterOrder();
    },

    cancelClusterDrag() {
      if (!clusterDrag) return;
      clusterDrag = null;
      setDragging(false);
      cancelInteraction();
    },

    beginLocusDrag(uid, pointerX) {
      const selected = new Set(selectedLocusIds());
      const locusUids = selected.has(uid) ? [...selected] : [uid];
      locusDrag = {
        uids: locusUids,
        pointerStart: pointerX,
        initialOffsets: new Map(locusUids.map((locusUid) => [locusUid, getLocusOffset(locusUid)])),
      };
      setDragging(true);
    },

    moveLocusDrag(pointerX) {
      if (!locusDrag) return;
      const delta = pointerX - locusDrag.pointerStart;
      const offsets = new Map(
        locusDrag.uids.map((uid) => [uid, locusDrag.initialOffsets.get(uid) + delta])
      );
      if (locusDrag.uids.length > 1 && previewLocusOffsets) {
        previewLocusOffsets(offsets);
        return;
      }
      previewLocusOffset(locusDrag.uids[0], offsets.get(locusDrag.uids[0]));
    },

    endLocusDrag() {
      if (!locusDrag) return;
      const { uids } = locusDrag;
      locusDrag = null;
      setDragging(false);
      commitLocusOffset(uids.length === 1 ? uids[0] : uids);
    },

    cancelLocusDrag() {
      if (!locusDrag) return;
      locusDrag = null;
      setDragging(false);
      cancelInteraction();
    },

    beginLocusTrim() {
      setDragging(true);
    },

    moveLocusTrim(locus, edge, pointerX) {
      previewLocusTrim(locus, edge, pointerX);
    },

    endLocusTrim(locus) {
      setDragging(false);
      commitLocusTrim(locus);
    },

    cancelLocusTrim() {
      setDragging(false);
      cancelInteraction();
    },

    flipLocus,
  };
}

function positionLines(selection, lines) {
  selection.data(lines, (line) => line.uid)
    .attr("x1", (line) => line.x1).attr("y1", (line) => line.y1)
    .attr("x2", (line) => line.x2).attr("y2", (line) => line.y2);
}

function positionBranches(selection, lines) {
  selection.data(lines, (line) => line.uid)
    .attr("d", (line) => `M${line.x1},${line.y1}H${line.x2}`);
}

/** SVG owns DOM joins and transitions; the shared layout supplies every frame. */
function renderSvgTree(plot, tree, scene, config, interactions, transition, animate, motion = {}) {
  const labelWidths = new Map();
  if (tree && config.tree?.show) {
    for (const clusterGroup of plot.selectAll("g.cluster").nodes()) {
      let width = 0;
      for (const selector of ["text.clusterText", "text.locusText"]) {
        try { width = Math.max(width, clusterGroup.querySelector(selector)?.getBBox().width || 0); }
        catch { /* SVG text must be attached for measurement. */ }
      }
      labelWidths.set(clusterGroup.__data__.uid, width);
    }
  }
  const layout = layoutTree({
    tree, scene, config, preview: motion.preview,
    measureText: (text, style) => {
      const node = plot.append("text").text(text).attr("font-family", style.fontFamily)
        .attr("font-size", style.fontSize).attr("font-weight", style.fontWeight).attr("font-style", style.fontStyle);
      try { const box = node.node().getBBox(); return { width: box.width, height: Math.max(box.height, style.fontSize) }; }
      finally { node.remove(); }
    },
    measureLabel: (cluster) => labelWidths.get(cluster.source.uid) || 0,
    previousTree: motion.previousTree,
    previousScene: motion.previousScene,
    dragging: motion.preview ? motion.preview.type === "cluster-drag" : interactions.isDragging?.() || false,
  });
  const group = plot.selectAll("g.phylogenetic-tree").data(layout ? [layout] : []).join("g")
    .attr("class", "phylogenetic-tree").interrupt();
  if (!layout) return;
  const branchMarks = (tag, className, records) => group.selectAll(`${tag}.${className}`)
    .data(records, (mark) => mark.uid).join(tag).attr("class", className)
    .attr("fill", "none").attr("stroke", (mark) => mark.style.colour).attr("stroke-width", (mark) => mark.style.width)
    .attr("stroke-linecap", (mark) => mark.lineCap || "butt");
  const cut = group.selectAll("g.tree-cut").data(layout.cutLine ? [layout.cutLine] : []).join("g")
    .attr("class", "tree-cut").attr("pointer-events", "none");
  cut.selectAll("line").data((line) => [line]).join("line")
    .attr("x1", (line) => line.x1).attr("x2", (line) => line.x2)
    .attr("y1", (line) => line.y1).attr("y2", (line) => line.y2)
    .attr("stroke", (line) => line.colour).attr("stroke-width", (line) => line.width).attr("stroke-dasharray", "4 3");
  cut.selectAll("text").data((line) => [line]).join("text")
    .attr("x", (line) => line.label.x).attr("y", (line) => line.label.y)
    .attr("font-size", (line) => `${line.label.fontSize}px`).attr("font-family", (line) => line.label.fontFamily)
    .attr("text-anchor", "middle").attr("fill", (line) => line.colour).text((line) => line.label.text);
  const root = branchMarks("path", "tree-root-stub", [layout.rootBranch]);
  const branches = branchMarks("path", "tree-branch", layout.branches);
  const stems = branchMarks("line", "tree-stem", layout.stems);
  const guides = group.selectAll("line.tree-leaf-guide").data(layout.guides, (guide) => guide.uid).join("line")
    .attr("class", "tree-leaf-guide")
    .attr("stroke", layout.guide.colour).attr("stroke-width", layout.guide.width)
    .attr("stroke-dasharray", layout.guide.dash.join(" ")).attr("pointer-events", "none");
  const nodes = group.selectAll("circle.tree-node").data(layout.nodes, (node) => node.uid).join("circle")
    .attr("class", "tree-node").attr("r", (node) => node.radius)
    .attr("fill", layout.background).attr("stroke", layout.branch.colour).attr("stroke-width", layout.branch.width)
    .attr("cursor", "pointer")
    .attr("tabindex", 0).attr("role", "button").attr("aria-label", (node) => `Tree node ${node.uid}: rotate children or open context menu`)
    .on("contextmenu", (event, node) => interactions.showTreeMenu?.(event, node.uid))
    .on("keydown", (event, node) => {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) interactions.showTreeMenu?.(event, node.uid);
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); interactions.rotateTreeNode?.(node.uid); }
    })
    .on("click", (event, node) => { event.stopPropagation(); interactions.rotateTreeNode?.(node.uid); });
  const supports = group.selectAll("text.tree-support").data(layout.supports, (label) => label.uid).join("text")
    .attr("class", "tree-support").attr("fill", layout.support.colour)
    .attr("font-size", `${layout.support.fontSize}px`).style("font-family", layout.support.fontFamily)
    .attr("text-anchor", "end").attr("dominant-baseline", "text-after-edge")
    .text((label) => label.text);
  const annotations = group.selectAll("text.tree-annotation").data(layout.annotations, (label) => label.uid).join("text")
    .attr("class", "tree-annotation").attr("dominant-baseline", "hanging")
    .attr("font-family", (label) => label.fontFamily).attr("font-size", (label) => label.fontSize)
    .attr("font-weight", (label) => label.fontWeight).attr("font-style", (label) => label.fontStyle)
    .attr("fill", (label) => label.colour).text((label) => label.text);
  const scale = group.selectAll("g.tree-scale-bar").data(layout.scaleBar ? [layout.scaleBar] : []).join("g")
    .attr("class", "tree-scale-bar");
  scale.selectAll("line").data((bar) => bar.lines).join("line")
    .attr("x1", (line) => line.x1).attr("y1", (line) => line.y1)
    .attr("x2", (line) => line.x2).attr("y2", (line) => line.y2)
    .attr("stroke", layout.scaleBar?.colour).attr("stroke-width", layout.scaleBar?.strokeWidth);
  scale.selectAll("text").data((bar) => [bar.label]).join("text")
    .attr("x", (label) => label.x).attr("y", (label) => label.y)
    .attr("text-anchor", "middle").attr("dominant-baseline", "hanging")
    // Match the existing SVG clustermap scale bar, whose font size uses pt.
    .attr("font-size", `${layout.scaleBar?.fontSize}pt`).attr("font-family", layout.scaleBar?.fontFamily)
    .attr("fill", layout.foreground).text((label) => label.text);
  const paintFrame = (frame) => {
    positionBranches(root, [frame.rootBranch]);
    positionBranches(branches, frame.branches);
    positionLines(stems, frame.stems);
    positionLines(guides, frame.guides);
    nodes.data(frame.nodes, (node) => node.uid).attr("cx", (node) => node.x).attr("cy", (node) => node.y);
    annotations.data(frame.annotations, (label) => label.uid).attr("x", (label) => label.x).attr("y", (label) => label.y);
    supports.data(frame.supports, (label) => label.uid).attr("x", (label) => label.x).attr("y", (label) => label.y);
  };
  paintFrame(interpolateTreeLayout(layout, animate ? 0 : 1));
  if (animate && layout.previousYs) {
    // One shared frame per tick keeps stems, labels, and nodes on the same clock.
    group.transition(transition).tween("tree.geometry", () =>
      (amount) => paintFrame(interpolateTreeLayout(layout, amount)));
  }
}

const previewStates = new WeakMap();

// Owns the D3 joins for chart-world SVG. The chart controller owns the SVG
// host, camera viewport, and interaction state that causes a redraw.
function renderSvg({
  plot,
  data,
  scene,
  annotationsOnly = false,
  annotationViewport = null,
  preview = null,
  previousScene = null,
  previousTree = null,
  previousTreeScene = null,
  transition,
  animate,
  config,
  scales,
  ids,
  lookup,
  interactions = {},
  highlightGeneIds = new Set(),
  highlightLinkIds = new Set(),
  highlightLocusIds = new Set(),
}) {
  config = figureConfig(config);
  plot.attr("fill", config.figureStyle.foreground);
  if (preview) return renderPreview({ plot, data, scene, preview, config, scales, ids, interactions,
    highlightGeneIds, highlightLocusIds });
  previewStates.delete(plot.node());
  if (annotationsOnly) {
    renderChrome({ plot, chrome: scene.chrome, ids, interactions });
    renderSvgAnnotations(plot, scene, { viewport: annotationViewport });
    return;
  }
  const linkGroup = plot
    .selectAll("g.links")
    .data([data])
    .join("g")
    .attr("class", "links");
  const clusterGroup = plot
    .selectAll("g.clusters")
    .data([data.clusters])
    .join("g")
    .attr("class", "clusters");
  const clusters = clusterGroup
    .selectAll("g.cluster")
    .data(data.clusters, (d) => d.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", ids.cluster)
          .attr("class", "cluster");
        const info = enter
          .append("g")
          .attr("id", ids.clusterInfo)
          .attr("class", "clusterInfo")
          .attr("transform", "translate(-10, 0)")
          .call(createClusterDrag({ plot, ids, interactions }));

        info
          .append("text")
          .attr("class", "clusterText")
          .attr("y", 8)
          .attr("cursor", "pointer")
          .style("font-weight", "bold")
          .style("font-size", `${config.cluster.nameFontSize}px`)
          .style("font-family", config.plot.fontFamily)
          .on("click", interactions.renameCluster);
        info
          .append("text")
          .attr("class", "locusText")
          .attr("y", 12)
          .attr("dominant-baseline", "hanging")
          .style("text-rendering", "geometricPrecision")
          .style("font-size", `${config.cluster.lociFontSize}px`)
          .style("font-family", config.plot.fontFamily);
        info.selectAll("text").attr("text-anchor", "end");
        enter.append("g").attr("class", "loci");
        return enter;
      },
      (update) => update
    );

  clusters.select("text.clusterText")
    .text((cluster) => cluster.name)
    .attr("y", 8)
    .attr("dominant-baseline", null)
    .style("font-size", `${config.cluster.nameFontSize}px`);
  clusters.select("text.locusText")
    .attr("y", 12)
    .attr("dominant-baseline", "hanging")
    .style("font-size", `${config.cluster.lociFontSize}px`);

  // A cluster drag can leave an in-flight transform transition on sibling
  // rows. Cancel it before the scene supplies their snapped final positions.
  const updateRender = (selection) =>
    animate ? selection.interrupt().transition(transition) : selection.interrupt();
  // Cluster labels describe committed locus state. Keep them responsive even
  // when locus geometry is still travelling through an SVG transition.
  updateClusters(clusters.interrupt(), scene, { labelsOnly: true });
  const clusterRender = updateRender(clusters);
  updateClusters(clusterRender, scene);

  const loci = clusters
    .select("g.loci")
    .selectAll("g.locus")
    .data((cluster) => cluster.loci, (locus) => locus.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", ids.locus)
          .attr("class", "locus");
        enter.append("line").attr("class", "trackBar").style("fill", "#111");
        enter.append("g").attr("class", "trimIndicators").style("pointer-events", "none");
        enter
          .append("rect")
          .attr("class", "locusHighlight")
          .style("pointer-events", "none");
        const hover = enter
          .append("g")
          .attr("class", "hover hidden")
          .attr("opacity", 0);
        // Hover must remain below genes: a handle drag may finish over a gene,
        // and the overlay must not intercept that pointer-up event.
        enter.append("g").attr("class", "genes");
        hover
          .append("rect")
          .attr("class", "hover")
          .attr("fill", "rgba(0, 0, 0, 0.4)")
          .call(createLocusPositionDrag({ plot, interactions }));
        hover
          .append("rect")
          .attr("class", "leftHandle")
          .attr("x", -8)
          .call(createLocusResizeDrag({ plot, interactions }));
        hover
          .append("rect")
          .attr("class", "rightHandle")
          .call(createLocusResizeDrag({ plot, interactions }));
        hover
          .selectAll(".leftHandle, .rightHandle")
          .attr("width", 8)
          .attr("cursor", "pointer");
        enter
          .on("mouseenter", (event) => {
            if (!interactions.isDragging()) {
              select(event.target).select("g.hover").transition().attr("opacity", 1);
            }
          })
          .on("mouseleave", (event) => {
            if (!interactions.isDragging()) {
              select(event.target).select("g.hover").transition().attr("opacity", 0);
            }
          })
          .on("click", (event, locus) => {
            if (event.shiftKey) {
              interactions.toggleLocusSelection(locus, {
                clusterRange: event.altKey ? "remove" : (event.ctrlKey || event.metaKey ? "add" : null),
              });
            }
          })
          .on("dblclick", (event, locus) => {
            // The hover rectangle describes pointer affordances, not locus
            // geometry. It would otherwise remain visible while the locus
            // itself animates through a flip.
            const locusNode = event.currentTarget;
            const hover = select(locusNode).select("g.hover").interrupt().attr("opacity", 0);
            // Restore the affordance only if this locus is still under the
            // pointer after its geometry transition completes.
            if (animate && config.plot.transitionDuration) {
              hover
                .transition()
                .delay(config.plot.transitionDuration)
                .duration(0)
                .on("end", function () {
                  if (locusNode.matches(":hover")) select(this).attr("opacity", 1);
                });
            }
            interactions.flipLocus(locus);
          });
        return updateLoci(enter, scene, config, highlightLocusIds);
      },
      (update) =>
        update.call((selection) =>
          updateLoci(updateRender(selection), scene, config, highlightLocusIds)
        )
    );

  loci
    .select("g.genes")
    .selectAll("g.gene")
    .data((locus) => locus.genes, (gene) => gene.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", ids.gene)
          .attr("class", "gene")
          .attr("display", "inline");
        enter
          .append("polygon")
          .on("click", interactions.onGeneClick)
          .on("contextmenu", interactions.showGeneMenu)
          .attr("class", "genePolygon");
        enter
          .append("polygon")
          .attr("class", "geneHighlight")
          .style("pointer-events", "none");
        enter
          .append("text")
          .attr("class", "geneLabel")
          .attr("dy", "-0.3em")
          .style("font-family", config.plot.fontFamily);
        return updateGenes(enter, scene, config, scales, highlightGeneIds);
      },
      (update) =>
        update.call((selection) =>
          updateGenes(updateRender(selection), scene, config, scales, highlightGeneIds)
        )
    );

  const visibleLinks = filterLinks(data.links, {
    groupForGene: scales.group,
    geneForUid: lookup.gene,
    bestOnly: config.link.bestOnly,
    threshold: config.link.threshold,
  });
  linkGroup
    .selectAll("g.geneLinkG")
    .data(visibleLinks, ids.link)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", ids.link)
          .attr("class", "geneLinkG");
        enter.append("path").attr("class", "geneLink");
        enter
          .append("path")
          .attr("class", "geneLinkHighlight")
          .style("pointer-events", "none");
        enter
          .append("text")
          .text((link) => link.label ?? link.identity.toFixed(2))
          .attr("class", "geneLinkLabel")
          .style("fill", "white")
          .style("text-anchor", "middle")
          .style("font-family", config.plot.fontFamily);
        return updateLinks(enter, scene, previousScene, config, scales, ids, highlightLinkIds);
      },
      (update) =>
        update.call((selection) => {
          selection.classed("hidden", !config.link.show);
          updateRender(selection).call(updateLinks, scene, previousScene, config, scales, ids, highlightLinkIds);
        }),
      (exit) =>
        exit.call((selection) => {
          if (animate) selection.transition(transition).attr("opacity", 0).remove();
          else selection.remove();
        })
    );

  renderChrome({ plot, chrome: scene.chrome, ids, interactions });
  renderSvgAnnotations(plot, scene, { transition, animate, viewport: annotationViewport });
  renderSvgTree(plot, data.tree, scene, config, interactions, transition, animate, {
    previousTree,
    previousScene: previousTreeScene,
  });
}

// Apply renderer-neutral patches to retained SVG elements. Geometry, adjacency,
// visibility, and label movement come from the same accessors as raster marks.
function renderPreview({ plot, data, scene, preview, config, scales, ids, interactions,
  highlightGeneIds, highlightLocusIds }) {
  const current = recordsForPreview(scene, preview, { includeClusters: true });
  // Select the node directly: selection.select() would replace its bound datum
  // with the plot datum, and UID strings need not be valid CSS identifiers.
  const element = (id) => select(plot.node().ownerDocument.getElementById(id));
  const previous = previewStates.get(plot.node());
  const affected = (kind) => new Set([
    ...current[kind], ...(previous?.scene === scene ? previous.records[kind] : []),
  ]);
  updateClusters(plot.selectAll("g.cluster").interrupt(), scene, { preview });

  // DOM parents carry row and locus translations. Only trim/flip previews need
  // per-gene geometry; ordinary dragging never rewrites the gene polygons.
  const loci = new Map();
  for (const uid of affected("loci")) {
    const locus = scene.loci.get(uid);
    if (!locus) continue;
    const geometry = locusGeometryForPreview(preview, locus);
    loci.set(uid, { ...locus, ...geometry,
      transform: { x: locus.transform.x + geometry.offsets.x, y: locus.transform.y },
    });
  }
  const projected = { ...scene, loci: { get: (uid) => loci.get(uid) || scene.loci.get(uid) } };
  for (const uid of loci.keys()) {
    const group = element(ids.locus({ uid })).interrupt();
    updateLoci(group, projected, config, highlightLocusIds);
    if (preview.type === "locus-flip") group.select("g.hover").interrupt().attr("opacity", 0);
  }
  if ([preview.type, previous?.type].some((type) => type === "locus-trim" || type === "locus-flip")) {
    const genes = new Map();
    for (const uid of affected("genes")) {
      const gene = scene.genes.get(uid);
      if (!gene) continue;
      const geometry = geneGeometryForPreview(preview, gene);
      const polygon = geometry.flipAxis === undefined ? gene.localPolygon
        : genePolygonForPreview(preview, gene, { includeClusterOffset: false })
          .map((value, index) => value - (index % 2 ? gene.locus.y : gene.locus.x));
      genes.set(uid, { ...gene, localPolygon: polygon, visible: geneVisibleForPreview(preview, gene),
        labelTransform: geometry.labelX === undefined ? gene.labelTransform
          : `translate(${geometry.labelX - gene.locus.x}, ${gene.label.y}) rotate(${gene.label.rotation})`,
      });
    }
    const geneScene = { ...scene, genes: { get: (uid) => genes.get(uid) || scene.genes.get(uid) } };
    for (const uid of genes.keys()) {
      updateGenes(element(ids.gene({ uid })).interrupt(), geneScene, config, scales, highlightGeneIds);
    }
  }
  // Include last frame's records so branches/links that leave the affected set
  // are restored to their retained positions rather than left behind.
  for (const uid of affected("links")) {
    const link = scene.links.get(uid);
    if (!link) continue;
    const geometry = linkGeometryForPreview(scene, link, preview, config);
    const anchors = geometry.anchors ?? link.anchors;
    const visible = config.link.show && geometry.visible && anchors;
    const group = element(ids.link(link.source)).interrupt().attr("opacity", visible ? link.opacity ?? 1 : 0);
    if (!visible) continue;
    const adjusted = [...anchors];
    adjusted[0] += geometry.a || 0; adjusted[1] += geometry.a || 0;
    adjusted[3] += geometry.b || 0; adjusted[4] += geometry.b || 0;
    group.selectAll("path.geneLink,path.geneLinkHighlight").interrupt().attr("d", getLinkPath(adjusted, config.link));
    if (config.link.label.show) {
      const label = getLinkLabelPosition(adjusted, config.link.label.position);
      group.select("text.geneLinkLabel").attr("x", label.x).attr("y", label.y)
        .attr("opacity", 1);
    }
  }
  renderChrome({ plot, chrome: preview.chrome || scene.chrome, ids, interactions });
  renderSvgAnnotations(plot, scene, { preview });
  renderSvgTree(plot, data.tree, scene, config, interactions, null, false, { preview });
  previewStates.set(plot.node(), { scene, records: current, type: preview.type });
}

function updateClusters(selection, scene, { labelsOnly = false, preview = null } = {}) {
  const layout = (cluster) => scene.clusters.get(cluster.uid);
  if (!labelsOnly) {
    selection.attr("transform", (cluster) => {
      const { x, y } = layout(cluster);
      return `translate(${x}, ${y + clusterOffsetForPreview(preview, cluster.uid)})`;
    });
    selection.selectAll("g.clusterInfo").attr("transform", (cluster) => {
      const { x, y } = layout(cluster).info;
      return `translate(${x + clusterLabelOffsetForPreview(preview, cluster.uid)}, ${y})`;
    });
  }
  selection.selectAll("text.locusText").each(function (cluster) {
    const text = clusterLabelTextForPreview(preview, cluster.uid, layout(cluster).info.locusText);
    if (this.textContent !== text) this.textContent = text;
  });
  return selection;
}

function createClusterDrag({ plot, ids, interactions }) {
  const clusterSelection = (uid) => plot.selectAll(`#${ids.cluster({ uid })}`);
  return drag()
    .container(function () { return this.parentNode.parentNode; })
    .on("start", (event, cluster) => {
      clusterSelection(cluster.uid).classed("active", true).attr("cursor", "grabbing");
      interactions.beginClusterDrag(cluster.uid, event.y);
    })
    .on("drag", (event) => interactions.moveClusterDrag(event.y))
    .on("end", (_, cluster) => {
      clusterSelection(cluster.uid).classed("active", false).attr("cursor", null);
      interactions.endClusterDrag();
    });
}

function createLocusPositionDrag({ plot, interactions }) {
  return drag()
    .container(() => plot.node())
    .on("start", (event, locus) => interactions.beginLocusDrag(locus.uid, event.x))
    .on("drag", (event) => interactions.moveLocusDrag(event.x))
    .on("end", () => interactions.endLocusDrag());
}

function createLocusResizeDrag({ plot, interactions }) {
  return drag()
    // Trimming uses chart-world coordinates, matching Canvas and WebGPU.
    .container(() => plot.node())
    .on("start", () => interactions.beginLocusTrim())
    .on("drag", function (event, locus) {
      interactions.moveLocusTrim(locus, select(this).classed("leftHandle") ? "left" : "right", event.x);
    })
    .on("end", (_, locus) => interactions.endLocusTrim(locus));
}

function updateLoci(selection, scene, config, highlightLocusIds) {
  const trimIndicatorStyle = resolveTrimIndicatorStyle(config.locus.trimIndicators);
  const layout = (locus) => scene.loci.get(locus.uid);
  // D3 transitions are used for locus geometry, but annotation joins must be
  // performed on selections so entering/removing text does not depend on a
  // transition's timing.
  const base = typeof selection.selection === "function" ? selection.selection() : selection;

  selection.attr("transform", (locus) => {
    const { x, y } = layout(locus).transform;
    return `translate(${x}, ${y})`;
  });
  selection
    .select("line.trackBar")
    .attr("x1", (locus) => layout(locus).track.x1)
    .attr("x2", (locus) => layout(locus).track.x2)
    .attr("y1", (locus) => layout(locus).track.y)
    .attr("y2", (locus) => layout(locus).track.y)
    .style("stroke", config.locus.trackBar.colour)
    .style("stroke-width", config.locus.trackBar.stroke);
  selection
    .select("rect.locusHighlight")
    .attr("x", (locus) => layout(locus).hover.x)
    .attr("y", (locus) => layout(locus).hover.y)
    .attr("width", (locus) => layout(locus).hover.width)
    .attr("height", (locus) => layout(locus).hover.height)
    .attr("display", (locus) => (highlightLocusIds.has(locus.uid) ? "inline" : "none"))
    .attr("fill", "rgba(22, 119, 255, 0.12)")
    .style("stroke", "#1677ff")
    .style("stroke-width", Math.max(2, config.locus.trackBar.stroke));
  selection
    .selectAll("rect.hover, rect.leftHandle, rect.rightHandle")
    .attr("y", (locus) => layout(locus).hover.y)
    .attr("height", (locus) => layout(locus).hover.height);
  selection
    .select("rect.hover")
    .attr("x", (locus) => layout(locus).hover.x)
    .attr("width", (locus) => layout(locus).hover.width);
  selection
    .select("rect.leftHandle")
    .attr("x", (locus) => layout(locus).hover.leftHandleX);
  selection
    .select("rect.rightHandle")
    .attr("x", (locus) => layout(locus).hover.rightHandleX);
  base
    .select("g.trimIndicators")
    .selectAll("text.trimIndicator")
    .data(
      (locus) => (config.locus.trimIndicators?.show === false ? [] : layout(locus).trimIndicators),
      (indicator) => indicator.side
    )
    .join("text")
    .attr("class", "trimIndicator")
    .attr("x", (indicator) => indicator.x)
    .attr("y", (indicator) => indicator.y)
    .attr("text-anchor", (indicator) => indicator.anchor)
    .attr("dominant-baseline", "hanging")
    .attr("fill", "#536b88")
    .attr("stroke", `rgba(255, 255, 255, ${trimIndicatorStyle.borderOpacity})`)
    .attr("stroke-width", trimIndicatorStyle.borderWidth)
    .attr("stroke-linejoin", "round")
    .style("paint-order", "stroke")
    .style("font-size", `${trimIndicatorStyle.fontSize}px`)
    .style("font-weight", trimIndicatorStyle.fontWeight)
    .style("font-family", config.plot.fontFamily)
    .text((indicator) => indicator.text);
  return selection;
}

function updateGenes(selection, scene, config, scales, highlightGeneIds) {
  const geneLayout = (gene) => scene.genes.get(gene.uid);
  const fill = (gene) => {
    if (gene.colour) return gene.colour;
    const group = scales.group(gene.uid);
    return scales.colour(group);
  };

  selection.attr("display", (gene) =>
    geneLayout(gene)?.visible ? "inline" : "none"
  );
  selection
    .select("polygon.genePolygon")
    .attr("class", (gene) => {
      const group = scales.group(gene.uid);
      return group === null ? "genePolygon" : `genePolygon group-${group}`;
    })
    .attr("points", (gene) => geneLayout(gene)?.localPolygon.join(" ") || "")
    .attr("fill", fill)
    .style("stroke", config.gene.shape.stroke)
    .style("stroke-width", config.gene.shape.strokeWidth);
  selection
    .select("polygon.geneHighlight")
    .attr("points", (gene) => geneLayout(gene)?.localPolygon.join(" ") || "")
    .attr("display", (gene) => (highlightGeneIds.has(gene.uid) ? "inline" : "none"))
    .attr("fill", "rgba(22, 119, 255, 0.18)")
    .style("stroke", "#1677ff")
    .style("stroke-width", Math.max(2, config.gene.shape.strokeWidth))
    .style("pointer-events", "none");
  selection
    .selectAll("text.geneLabel")
    .text((gene) => gene.label || gene.name || gene.uid)
    .attr("dy", (gene) => geneLayout(gene)?.labelDy)
    .attr("display", config.gene.label.show ? "inherit" : "none")
    .attr("transform", (gene) => geneLayout(gene)?.labelTransform)
    .attr("font-size", config.gene.label.fontSize)
    .attr("text-anchor", config.gene.label.anchor);
  return selection;
}

function updateLinks(selection, scene, previousScene, config, scales, ids, highlightLinkIds) {
  const linkLayout = (link) => scene.links.get(link.uid);
  const fill = (link) => {
    if (config.link.asLine) return "none";
    if (link.colour) return link.colour;
    if (config.link.groupColour) return rgbaToRgb(scales.colour(scales.group(link.query.uid)));
    return scales.score(link.identity);
  };
  const stroke = (link) => {
    if (link.colour) return link.colour;
    if (config.link.groupColour) {
      const colour = scales.colour(scales.group(link.query.uid));
      return config.link.asLine ? rgbaToRgb(colour) : colour;
    }
    return config.link.asLine ? scales.score(link.identity) : config.figureStyle.outline;
  };

  const opacity = (link) => interpolateLinkOpacity(
    previousScene?.links.get(link.uid),
    linkLayout(link),
    1,
    config.link.show
  );
  if (typeof selection.attrTween === "function") {
    selection.attrTween("opacity", function (link) {
      const previous = previousScene?.links.get(link.uid);
      const next = linkLayout(link);
      return (amount) => interpolateLinkOpacity(previous, next, amount, config.link.show);
    });
  } else {
    selection.attr("opacity", opacity);
  }
  selection
    .select("path.geneLink")
    .call((path) => {
      if (typeof path.attrTween === "function") path.attrTween("d", function (link) {
        const previous = previousScene?.links.get(link.uid);
        const next = linkLayout(link);
        return (amount) => getLinkPath(
          interpolateLinkAnchors(previousScene, previous, scene, next, amount),
          config.link
        );
      });
      else path.attr("d", (link) => linkLayout(link)?.path || "");
    })
    .style("fill", fill)
    .style("stroke", stroke)
    .style("stroke-width", `${config.link.strokeWidth}px`);
  selection
    .select("path.geneLinkHighlight")
    .call((path) => {
      if (typeof path.attrTween === "function") path.attrTween("d", function (link) {
        const previous = previousScene?.links.get(link.uid);
        const next = linkLayout(link);
        return (amount) => getLinkPath(
          interpolateLinkAnchors(previousScene, previous, scene, next, amount),
          config.link
        );
      });
      else path.attr("d", (link) => linkLayout(link)?.path || "");
    })
    .attr("display", (link) => (highlightLinkIds.has(link.uid) ? "inline" : "none"))
    .style("fill", config.link.asLine ? "none" : "rgba(22, 119, 255, 0.18)")
    .style("stroke", "#1677ff")
    .style("stroke-width", `${Math.max(2, config.link.strokeWidth + 1)}px`)
    .style("pointer-events", "none");
  selection
    .selectAll("text")
    .text((link) => link.label ?? link.identity.toFixed(2))
    .attr("opacity", (link) =>
      config.link.label.show && linkLayout(link)?.visible ? 1 : 0
    )
    .attr("filter", config.link.label.background ? `url(#${ids.filter})` : null)
    .style("font-size", `${config.link.label.fontSize}px`)
    .attr("x", (link) => linkLayout(link)?.labelPosition?.x)
    .attr("y", (link) => linkLayout(link)?.labelPosition?.y);
  return selection;
}

function renderChrome({ plot, chrome, ids, interactions }) {
  if (!chrome) return;
  const transform = ({ x, y }) => `translate(${x}, ${y})`;
  renderLegend({ plot, legend: chrome.legend, interactions, transform });
  renderScaleBar({ plot, scaleBar: chrome.scaleBar, interactions, transform });
  renderColourBar({ plot, colourBar: chrome.colourBar, ids, transform });
}

function renderLegend({ plot, legend, interactions, transform }) {
  const key = plot
    .selectAll("g.legend")
    .data([legend])
    .join("g")
    .attr("class", "legend")
    .attr("opacity", legend.visible ? 1 : 0)
    .attr("transform", () => transform(legend.position));

  const items = key
    .selectAll("g.element")
    .data(legend.items, (item) => item.uid)
    .join((enter) => {
      const item = enter.append("g").attr("class", "element");
      item.append("circle");
      item
        .append("text")
        .attr("class", "legend-label")
        .attr("text-anchor", "start")
        .style("dominant-baseline", "middle");
      item
        .append("text")
        .attr("class", "legend-subtitle")
        .attr("text-anchor", "start")
        .style("dominant-baseline", "middle");
      return item;
    });

  items.attr("transform", (item) => `translate(${item.x}, ${item.y})`);
  items
    .select("circle")
    .attr("class", (item) => `group-${item.uid}`)
    .attr("cy", (item) => item.circleY)
    .attr("r", (item) => item.radius)
    .attr("fill", (item) => item.colour)
    .attr("cursor", "pointer")
    .on("click", (event, item) => interactions.legendColour(event, item.source));
  items
    .select("text.legend-label")
    .text((item) => item.label)
    .attr("x", (item) => item.textX)
    .attr("y", (item) => item.textY)
    .style("font-size", `${legend.fontSize}px`)
    .style("font-family", legend.fontFamily)
    .attr("cursor", "pointer")
    .on("click", (event, item) => interactions.legendText(event, item.source))
    .on("contextmenu", (event, item) => interactions.legendMenu(event, item.source));
  items
    .select("text.legend-subtitle")
    .text((item) => item.subtitle)
    .attr("x", (item) => item.textX)
    .attr("y", (item) => item.subtitleY ?? item.textY)
    .attr("opacity", (item) => item.subtitle ? 0.72 : 0)
    .style("font-size", `${legend.subtitleFontSize}px`)
    .style("font-family", legend.fontFamily)
    .attr("cursor", "pointer")
    .on("click", (event, item) => interactions.legendText(event, item.source))
    .on("contextmenu", (event, item) => interactions.legendMenu(event, item.source));
}

function renderScaleBar({ plot, scaleBar, interactions, transform }) {
  const bar = plot
    .selectAll("g.scaleBar")
    .data([scaleBar])
    .join((enter) => {
      const group = enter.append("g").attr("class", "scaleBar");
      group.append("line").attr("class", "flatBar");
      group.append("line").attr("class", "leftBar");
      group.append("line").attr("class", "rightBar");
      group.append("text").attr("class", "barText").attr("text-anchor", "middle");
      return group;
    })
    .attr("opacity", scaleBar.visible ? 1 : 0)
    .attr("transform", () => transform(scaleBar.position));

  bar
    .select("line.flatBar")
    .attr("x2", scaleBar.length)
    .attr("y1", scaleBar.middle)
    .attr("y2", scaleBar.middle);
  bar.select("line.leftBar").attr("y2", scaleBar.height);
  bar
    .select("line.rightBar")
    .attr("x1", scaleBar.length)
    .attr("x2", scaleBar.length)
    .attr("y2", scaleBar.height);
  bar
    .select("text.barText")
    .text(scaleBar.label)
    .attr("x", scaleBar.length / 2)
    .attr("y", scaleBar.height + 5)
    .style("dominant-baseline", "hanging")
    .style("font-size", `${scaleBar.fontSize}pt`)
    .style("font-family", scaleBar.fontFamily)
    .attr("cursor", "pointer")
    .on("click", () => interactions.setScaleBarLength());
  bar
    .selectAll("line")
    .style("stroke", scaleBar.colour)
    .style("stroke-width", scaleBar.strokeWidth);
}

function renderColourBar({ plot, colourBar, ids, transform }) {
  const bar = plot
    .selectAll("g.colourBar")
    .data([colourBar])
    .join((enter) => {
      const group = enter.append("g").attr("class", "colourBar");
      const gradient = group
        .append("defs")
        .append("linearGradient")
        .attr("id", ids.colourGradient)
        .attr("x1", "0%")
        .attr("x2", "100%");
      gradient.append("stop").attr("class", "startStop").attr("offset", "0%");
      gradient.append("stop").attr("class", "endStop").attr("offset", "100%");
      const parts = group.append("g").attr("class", "cbarParts");
      parts.append("rect").attr("class", "colourBarBG");
      parts.append("rect").attr("class", "colourBarFill");
      parts.append("text").attr("class", "labelText").attr("text-anchor", "middle");
      parts.append("text").attr("class", "startText").attr("text-anchor", "start");
      parts.append("text").attr("class", "endText").attr("text-anchor", "end");
      return group;
    })
    .attr("opacity", colourBar.visible ? 1 : 0)
    .attr("transform", () => transform(colourBar.position));

  bar.select(".startStop").attr("stop-color", colourBar.startColour);
  bar.select(".endStop").attr("stop-color", colourBar.endColour);
  bar
    .select(".colourBarBG")
    .attr("width", colourBar.width)
    .attr("height", colourBar.height)
    .style("fill", "white")
    .style("stroke", colourBar.textColour || "black")
    .style("stroke-width", "1px");
  bar
    .select(".colourBarFill")
    .attr("width", colourBar.width)
    .attr("height", colourBar.height)
    .style("fill", `url(#${ids.colourGradient})`);
  bar
    .select(".labelText")
    .text(colourBar.label)
    .attr("x", colourBar.width / 2)
    .attr("y", colourBar.height + 5);
  bar
    .select(".startText")
    .text(colourBar.startLabel)
    .attr("y", colourBar.height + 5);
  bar
    .select(".endText")
    .text(colourBar.endLabel)
    .attr("x", colourBar.width)
    .attr("y", colourBar.height + 5);
  bar
    .selectAll("text")
    .style("font-family", colourBar.fontFamily)
    .style("font-size", `${colourBar.fontSize}pt`)
    .style("dominant-baseline", "hanging");
}

/**
 * Retain the overview bitmap separately from either raster backend. The
 * controller deliberately knows nothing about D3 or chart state: callers
 * provide the current scene, camera, and the callback that draws an overview.
 */
function createRasterMinimap({
  requestFrame = globalThis.requestAnimationFrame,
  cancelFrame = globalThis.cancelAnimationFrame,
  createCanvas = () => document.createElement("canvas"),
} = {}) {
  let baseCanvas = null;
  let baseFrame = null;
  let gesture = false;
  let binding = null;

  const projectionFor = (scene, options) =>
    createMinimapProjection({
      bounds: scene?.figureBounds || scene?.bounds,
      width: options.width,
      height: options.height,
    });
  const cameraForPointer = ({ event, minimap, surface, scene, options, camera }) => {
    const projection = projectionFor(scene, options);
    if (!projection || !minimap || !surface) return null;
    const minimapBounds = minimap.getBoundingClientRect();
    const surfaceBounds = surface.getBoundingClientRect();
    return cameraForMinimapPoint(
      projection,
      { x: event.clientX - minimapBounds.left, y: event.clientY - minimapBounds.top },
      { width: surfaceBounds.width, height: surfaceBounds.height },
      camera
    );
  };

  return {
    clear() {
      if (baseFrame !== null) cancelFrame(baseFrame);
      baseFrame = null;
      gesture = false;
      binding?.on(".minimap", null); binding = null;
    },

    paint({ minimap, surface, scene, options, camera, pixelRatio }) {
      const projection = projectionFor(scene, options);
      if (!minimap || !surface || !projection) return null;
      const bounds = surface.getBoundingClientRect();
      return renderCanvasMinimap({
        canvas: minimap,
        baseCanvas,
        projection,
        camera,
        viewport: { width: bounds.width, height: bounds.height },
        pixelRatio,
      });
    },

    scheduleBase({ scene, minimap, options, renderBase, onPaint }) {
      if (!scene?.bounds || !minimap) return;
      if (baseFrame !== null) cancelFrame(baseFrame);
      baseFrame = requestFrame(() => {
        baseFrame = null;
        const projection = projectionFor(scene, options);
        if (!projection || !minimap.isConnected) return;
        if (!baseCanvas) baseCanvas = createCanvas();
        renderBase({ canvas: baseCanvas, scene, projection });
        onPaint();
      });
    },

    cameraForPointer,

    bind(selection, {
      getSurface,
      getScene,
      getCamera,
      getOptions,
      moveCamera,
      beginMotion,
      endMotion,
      setCursor,
    }) {
      if (binding?.node() === selection.node()) return;
      binding?.on(".minimap", null); binding = selection;
      gesture = false;
      const move = (minimap, event) => {
        const camera = cameraForPointer({
          event,
          minimap,
          surface: getSurface(),
          scene: getScene(),
          options: getOptions(),
          camera: getCamera(),
        });
        if (camera) moveCamera(camera);
      };
      selection
        .on("pointerdown.minimap", function (event) {
          if (event.button) return;
          gesture = true;
          beginMotion();
          this.setPointerCapture(event.pointerId);
          setCursor(this, "grabbing");
          move(this, event);
          event.preventDefault();
        })
        .on("pointermove.minimap", function (event) {
          if (!gesture) return;
          move(this, event);
          event.preventDefault();
        })
        .on("pointerup.minimap pointercancel.minimap", function (event) {
          if (!gesture) return;
          gesture = false;
          if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId);
          setCursor(this, "grab");
          endMotion();
        });
    },
  };
}

function cursorForTarget(target) {
  if (!target) return "grab";
  if (target.action === "move-cluster") return "grab";
  if (target.action === "tree-node") return "pointer";
  if (target.action === "move-locus") return "move";
  if (target.action.startsWith("trim-locus")) return "ew-resize";
  return "pointer";
}

/**
 * Shared pointer and keyboard lifecycle for Canvas and WebGPU surfaces.
 * It owns only gesture state and event interpretation; chart state changes,
 * menus, cursor styling, and painting remain explicit callbacks.
 */
function createRasterInteraction({
  targetForEvent,
  worldPoint,
  locusForTarget,
  setHoverLocus,
  warmLocus = () => {},
  beginMotion = () => {},
  endMotion = () => {},
  setCursor = () => {},
  interactions,
  actions,
}) {
  let gesture = null;
  let panMode = false;
  let spaceDown = false;
  let activeSurface = null;
  let boundSurface = null, disposeBinding = () => {};

  const updateAffordance = (surface, target, { warm = false } = {}) => {
    const locusUid = locusForTarget(target);
    if (setHoverLocus(locusUid) || warm) warmLocus(locusUid);
    setCursor(surface, cursorForTarget(target));
  };

  const startGesture = (surface, event, target) => {
    const point = worldPoint(surface, event);
    surface.setPointerCapture(event.pointerId);
    updateAffordance(surface, target, { warm: true });
    if (target.action === "move-cluster" || target.action === "move-locus" || target.action.startsWith("trim-locus")) {
      gesture = {
        action: target.action,
        clusterUid: target.clusterUid,
        locusUid: target.locusUid,
        start: { x: event.clientX, y: event.clientY },
        moved: false,
      };
      if (target.action === "move-cluster") interactions.beginClusterDrag(target.clusterUid, point.y);
      else if (target.action === "move-locus") interactions.beginLocusDrag(target.locusUid, point.x);
      else {
        gesture.edge = target.action.endsWith("left") ? "left" : "right";
        interactions.beginLocusTrim();
      }
    } else if (target.action === "gene") {
      gesture = { action: target.action, geneUid: target.geneUid };
    } else if (target.action === "tree-node") {
      gesture = { action: target.action, nodeUid: target.nodeUid };
    } else if (target.action === "legend-colour") {
      actions.legendColour(event, target.group);
    } else if (target.action === "legend-text") {
      actions.legendText(event, target.group);
    } else if (target.action === "scale-bar") {
      actions.scaleBar();
    }
  };

  const moveGesture = (surface, event) => {
    if (!gesture) {
      updateAffordance(surface, targetForEvent(surface, event));
      return;
    }
    if (gesture.start && !gesture.moved) {
      if (Math.hypot(event.clientX - gesture.start.x, event.clientY - gesture.start.y) < 2) return;
      gesture.moved = true;
      beginMotion();
    }
    const point = worldPoint(surface, event);
    if (gesture.action === "move-cluster") {
      interactions.moveClusterDrag(point.y);
    } else if (gesture.action === "move-locus") {
      interactions.moveLocusDrag(point.x);
    } else if (gesture.edge) {
      interactions.moveLocusTrim(gesture.locusUid, gesture.edge, point.x);
    }
  };

  const finishGesture = (surface, event) => {
    if (!gesture) return;
    const finished = gesture;
    gesture = null;
    if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    if (finished.action === "move-cluster") {
      if (finished.moved) interactions.endClusterDrag();
      else interactions.cancelClusterDrag();
    } else if (finished.action === "move-locus") {
      if (finished.moved) interactions.endLocusDrag();
      else interactions.cancelLocusDrag();
    } else if (finished.edge) {
      if (finished.moved) interactions.endLocusTrim(finished.locusUid);
      else interactions.cancelLocusTrim();
    } else if (finished.action === "gene") {
      actions.geneClick(event, finished.geneUid);
    } else if (finished.action === "tree-node") {
      actions.rotateTreeNode?.(finished.nodeUid);
    }
    if (finished.moved) endMotion();
    updateAffordance(surface, targetForEvent(surface, event));
  };

  return {
    zoomFilter(surface, event) {
      if (panMode) return event.type === "wheel" || event.button === 0;
      if (event.type === "wheel") return true;
      if (event.ctrlKey || event.button) return false;
      return !targetForEvent(surface, event);
    },

    bind(selection) {
      const surface = selection.node();
      if (surface === boundSurface) return disposeBinding;
      disposeBinding();
      boundSurface = surface;
      const windowRef = surface?.ownerDocument?.defaultView;
      const isActive = () =>
        activeSurface === surface || surface?.ownerDocument?.activeElement === surface;
      const keydown = (event) => {
        if (event.code !== "Space") return;
        if (event.target?.closest?.("input, textarea, select, button, [contenteditable='true']")) return;
        spaceDown = true;
        if (!isActive()) return;
        panMode = true;
        event.preventDefault();
        setCursor(surface, "grab");
      };
      const keyup = (event) => {
        if (event.code !== "Space") return;
        spaceDown = false;
        panMode = false;
        if (isActive()) setCursor(surface, "grab");
      };
      windowRef?.addEventListener("keydown", keydown);
      windowRef?.addEventListener("keyup", keyup);
      selection
        .on("pointerenter.canvasKeyboard", function () {
          activeSurface = this;
          this.focus({ preventScroll: true });
          if (spaceDown) {
            panMode = true;
            setCursor(this, "grab");
          }
        })
        .on("keydown.canvasKeyboard", function (event) {
          if (event.code !== "Space") return;
          spaceDown = true;
          panMode = true;
          event.preventDefault();
          setCursor(this, "grab");
        })
        .on("keyup.canvasKeyboard", function (event) {
          if (event.code !== "Space") return;
          spaceDown = false;
          panMode = false;
          setCursor(this, "grab");
        })
        .on("blur.canvasKeyboard", function () {
          panMode = false;
        })
        .on("pointerdown.canvasInteraction", function (event) {
          if (panMode || event.button) return;
          const target = targetForEvent(this, event);
          if (!target) return;
          const locusUid = locusForTarget(target);
          if (event.shiftKey && locusUid) {
            actions.toggleLocusSelection(locusUid, {
              clusterRange: event.altKey ? "remove" : (event.ctrlKey || event.metaKey ? "add" : null),
            });
            event.preventDefault();
            return;
          }
          startGesture(this, event, target);
          event.preventDefault();
        })
        .on("pointermove.canvasInteraction", function (event) {
          if (!panMode) moveGesture(this, event);
        })
        .on("pointerleave.canvasInteraction", function () {
          if (activeSurface === this) activeSurface = null;
          if (!gesture && !panMode) updateAffordance(this, null);
        })
        .on("pointerup.canvasInteraction pointercancel.canvasInteraction", function (event) {
          finishGesture(this, event);
        })
        .on("dblclick.canvasInteraction", function (event) {
          if (panMode) return;
          const target = targetForEvent(this, event);
          const locusUid = locusForTarget(target);
          if (locusUid) actions.flipLocus(locusUid);
        })
        .on("contextmenu.canvasInteraction", function (event) {
          const target = targetForEvent(this, event);
          if (target?.action === "tree-node") {
            event.preventDefault(); event.stopPropagation();
            actions.treeMenu?.(event, target.nodeUid);
          } else if (target?.action === "gene") {
            event.preventDefault();
            actions.geneMenu(event, target.geneUid);
          } else if (target?.action === "legend-text") {
            event.preventDefault();
            actions.legendMenu(event, target.group);
          }
        });
      const dispose = () => {
        if (disposeBinding !== dispose) return;
        boundSurface = activeSurface = gesture = null;
        disposeBinding = () => {};
        panMode = spaceDown = false;
        windowRef?.removeEventListener("keydown", keydown);
        windowRef?.removeEventListener("keyup", keyup);
        selection.on(".canvasKeyboard", null).on(".canvasInteraction", null);
      };
      return disposeBinding = dispose;
    },
  };
}

/**
 * Coordinate raster redraw quality during active gestures. Canvas 2D may
 * temporarily favour throughput; WebGPU remains at native resolution because
 * its geometry redraw is inexpensive and a resolution jump is distracting.
 */
function createRasterMotion({
  schedulePaint,
  getCamera,
  getRenderer,
  getAdaptiveResolution = () => true,
  devicePixelRatio = () => globalThis.devicePixelRatio || 1,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  settleDelay = 100,
}) {
  let moving = false;
  let settleTimer = null;

  return {
    begin() {
      if (settleTimer !== null) clearTimer(settleTimer);
      settleTimer = null;
      if (moving) return;
      moving = true;
      schedulePaint();
    },

    end() {
      if (settleTimer !== null) clearTimer(settleTimer);
      // D3's zoom end already debounces a wheel gesture. This short extra
      // delay avoids resizing the backing bitmap between pointer updates.
      settleTimer = setTimer(() => {
        settleTimer = null;
        if (!moving) return;
        moving = false;
        schedulePaint();
      }, settleDelay);
    },

    pixelRatio() {
      const ratio = devicePixelRatio();
      if (getRenderer() === "webgpu" || !getAdaptiveResolution()) return ratio;
      return canvasPixelRatioForCamera({ camera: getCamera(), moving, devicePixelRatio: ratio });
    },

    dispose() {
      if (settleTimer !== null) clearTimer(settleTimer);
      settleTimer = null;
      moving = false;
    },
  };
}

// Surface modules supply renderer-specific effects, but every chart camera
// uses the same D3 gesture contract and intentionally reserves double-click
// for locus flipping.
function bindCameraZoom({
  surface,
  zoomExtent,
  onZoom,
  onStart,
  onEnd,
}) {
  const zoom = createZoom()
    .scaleExtent(zoomExtent())
    .on("zoom", onZoom)
    .on("start", onStart)
    .on("end", onEnd);
  surface.call(zoom).on("dblclick.zoom", null);
  return zoom;
}

function updateCameraZoom(zoom, zoomExtent) {
  if (zoom) zoom.scaleExtent(zoomExtent());
}

// D3 keeps a transform on each gesture surface. The chart camera is shared by
// all renderers, so a surface created while switching renderer must adopt that
// camera before its first wheel or drag event. Otherwise its default identity
// transform would overwrite the already-visible camera on that first gesture.
function syncCameraZoom({ surface, zoom, camera }) {
  const node = surface?.node?.();
  if (!node || !zoom || !camera) return;
  const current = transform(node);
  if (current.x === camera.x && current.y === camera.y && current.k === camera.k) return;
  surface.call(
    zoom.transform,
    identity$2.translate(camera.x, camera.y).scale(camera.k)
  );
}

// Owns the persistent DOM surrounding an SVG chart. Scene joins and all chart

function appendLabelFilter(svg, id) {
  const filter = svg.append("defs").append("filter")
    .attr("id", id).attr("x", 0).attr("y", 0).attr("width", 1).attr("height", 1);
  filter.append("feFlood").attr("flood-color", "rgba(0, 0, 0, 0.8)");
  filter.append("feComposite").attr("in", "SourceGraphic").attr("in2", "");
}

function ensureSvgSurface({
  container,
  data,
  ids,
  fontFamily,
  zoom,
  zoomExtent,
  onZoom,
  onZoomStart,
  onZoomEnd,
}) {
  let currentZoom = zoom;
  const svg = container
    .selectAll("svg.clusterMap")
    .data([data])
    .join((enter) => {
      enter
        .append("input")
        .attr("id", ids.picker)
        .attr("class", "colourPicker")
        .attr("type", "color")
        .style("position", "absolute")
        .style("opacity", 0);

      enter
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        // Context menus must stay interactive above optional side panels that
        // share the chart container (such as the demo data editor).
        .style("z-index", 4)
        .style("box-sizing", "border-box")
        .style("padding", "8px")
        .style("background", "white")
        .style("border", "1px solid #999")
        .style("border-radius", "4px")
        .style("box-shadow", "0 2px 8px rgba(0, 0, 0, 0.2)")
        .style("font-family", fontFamily);

      const surface = enter
        .append("svg")
        .attr("class", "clusterMap")
        .attr("id", ids.root)
        .attr("cursor", "grab")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

      appendLabelFilter(surface, ids.filter);

      // Layout measures chart content in world coordinates. The viewport is
      // the only group transformed by the persisted camera.
      const viewport = surface.append("g").attr("class", "clusterMapViewport");
      viewport.append("g").attr("class", "clusterMapG");

      currentZoom = bindCameraZoom({
        surface,
        zoomExtent,
        onZoom: (event) => onZoom(event, viewport),
        onStart: () => onZoomStart(surface),
        onEnd: () => onZoomEnd(surface),
      });
      return surface;
    });

  updateCameraZoom(currentZoom, zoomExtent);
  return {
    svg,
    plot: svg.select("g.clusterMapG"),
    tooltip: container.select("div.tooltip"),
    zoom: currentZoom,
  };
}

/** Publication output uses the live SVG renderer with interaction affordances removed. */
function exportChartSvg({
  data,
  scene,
  config,
  scales,
  ids,
  lookup,
  padding = 20,
  documentRef = document,
}) {
  if (!scene) throw new Error("Cannot export an SVG before the chart has rendered.");
  config = figureConfig(config);
  const namespace = "http://www.w3.org/2000/svg";
  const svgNode = documentRef.createElementNS(namespace, "svg");
  // SVG text getBBox() is unreliable while the tree is detached. Attach it
  // invisibly before rendering so tree/label spacing uses real text metrics.
  select(documentRef.body)
    .append(() => svgNode)
    .style("position", "fixed")
    .style("visibility", "hidden")
    .style("pointer-events", "none");
  try {
    appendLabelFilter(select(svgNode), "filter_solid");
    const plot = select(svgNode).append("g").attr("class", "clusterMapG");
    const exportIds = { ...ids, filter: "filter_solid", colourGradient: "colour-gradient" };
    renderSvg({
      plot,
      data,
      scene,
      animate: false,
      config,
      scales,
      ids: exportIds,
      lookup,
    });
    // Event listeners do not serialize, but hover/trim affordances would still
    // be visible as nodes in an exported publication figure.
    plot.selectAll("g.hover").remove();
    // This is a static figure, so strip interaction affordances even when an
    // element's cursor or pointer policy was set by the live renderer.
    plot.selectAll("*").each(function () {
      this.removeAttribute("cursor");
      this.removeAttribute("tabindex");
      this.removeAttribute("role");
      this.removeAttribute("aria-label");
      this.removeAttribute("pointer-events");
      this.style.removeProperty("cursor");
      this.style.removeProperty("pointer-events");
      this.classList.remove("active");
    });
    const bounds = plot.node().getBBox();
    svgNode.removeAttribute("style");
    svgNode.setAttribute(
      "viewBox",
      `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`
    );
    svgNode.setAttribute("width", bounds.width + padding * 2);
    svgNode.setAttribute("height", bounds.height + padding * 2);
    svgNode.setAttribute("xmlns", namespace);
    select(svgNode).insert("rect", ":first-child")
      .attr("x", bounds.x - padding).attr("y", bounds.y - padding)
      .attr("width", bounds.width + padding * 2).attr("height", bounds.height + padding * 2)
      .attr("fill", config.figureStyle.background);
    return new XMLSerializer().serializeToString(svgNode);
  } finally {
    svgNode.remove();
  }
}

function colors(specifier) {
  var n = specifier.length / 6 | 0, colors = new Array(n), i = 0;
  while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
  return colors;
}

var ramp = scheme => rgbBasis(scheme[scheme.length - 1]);

var scheme = new Array(3).concat(
  "f0f0f0bdbdbd636363",
  "f7f7f7cccccc969696525252",
  "f7f7f7cccccc969696636363252525",
  "f7f7f7d9d9d9bdbdbd969696636363252525",
  "f7f7f7d9d9d9bdbdbd969696737373525252252525",
  "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525",
  "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000"
).map(colors);

var interpolateGreys = ramp(scheme);

cubehelixLong(cubehelix$1(-100, 0.75, 0.35), cubehelix$1(80, 1.50, 0.8));

cubehelixLong(cubehelix$1(260, 0.75, 0.35), cubehelix$1(80, 1.50, 0.8));

var c = cubehelix$1();

function interpolateRainbow(t) {
  if (t < 0 || t > 1) t -= Math.floor(t);
  var ts = Math.abs(t - 0.5);
  c.h = 360 * t - 100;
  c.s = 1.5 - 1.5 * ts;
  c.l = 0.8 - 0.9 * ts;
  return c + "";
}

const defaultConfig = {
  // Optional row-aligned metadata panels. Synteny remains the default view.
  annotations: { enabled: false },
  tree: {
    show: true,
    colouring: TREE_COLOURING_DEFAULTS,
    width: 100,
    useBranchLengths: true,
    branch: { width: 1.5, colour: null },
    support: { show: true, fontSize: 9, precision: 1 },
    scaleBar: { show: true },
    leafGuide: { show: false, colour: null, width: 1, dash: "4 3" },
  },
  plot: {
    theme: "auto",
    // Figure appearance is stable across interface and system themes.
    background: "#ffffff",
    transitionDuration: 250,
    renderer: "svg",
    // Canvas may reduce resolution during motion and at small zoom scales.
    // Disable for fixed-resolution output or renderer comparisons.
    adaptiveResolution: true,
    minZoom: 0,
    maxZoom: 8,
    minimap: {
      show: false,
      width: 220,
      height: 160,
      margin: 12,
      showLinks: false,
    },
    scaleFactor: 15,
    scaleGenes: true,
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Oxygen, Cantarell, sans-serif',
  },
  legend: {
    columns: 1,
    columnWidth: 160,
    entryHeight: 18,
    fontSize: 14,
    subtitleFontSize: 10,
    onClickCircle: null,
    onClickText: null,
    // Optional hook exposed as a deliberate action in the group context menu.
    // Consumers can use it to reveal a group in an adjacent inspector.
    onReveal: null,
    // "right" keeps the historical layout. "bottom" places the legend
    // below the chart's content bounds, aligned with its left edge.
    position: "right",
    show: true,
    marginLeft: 20,
    marginTop: 20,
  },
  colourBar: {
    fontSize: 10,
    height: 12,
    show: true,
    width: 150,
    marginTop: 20,
    // Bounds describe the colour mapping only; link.threshold remains the
    // separate visibility filter. "data" resolves against all link records.
    domain: {
      min: 0,
      max: 1,
      minMode: "fixed",
      maxMode: "fixed",
    },
  },
  scaleBar: {
    colour: null,
    fontSize: 10,
    height: 12,
    basePair: 2500,
    show: true,
    stroke: 1,
    marginTop: 20,
  },
  link: {
    show: true,
    asLine: false,
    straight: false,
    threshold: 0,
    strokeWidth: 0.5,
    groupColour: false,
    bestOnly: false,
    label: {
      show: false,
      fontSize: 10,
      background: true,
      position: 0.5,
    },
  },
  cluster: {
    nameFontSize: 12,
    lociFontSize: 10,
    hideLocusCoordinates: false,
    spacing: 40,
    alignLabels: true,
  },
  locus: {
    trimIndicators: {
      show: true,
      fontSize: 10,
      fontWeight: 600,
      borderWidth: 3,
      borderOpacity: 1,
    },
    trackBar: {
      colour: null,
      stroke: 1,
    },
    spacing: 50,
  },
  gene: {
    shape: {
      bodyHeight: 12,
      tipHeight: 5,
      tipLength: 12,
      onClick: null,
      // Optional hook exposed as a deliberate action in the gene context menu.
      // It intentionally does not replace the normal click-to-anchor behaviour.
      onReveal: null,
      stroke: null,
      strokeWidth: 1,
    },
    label: {
      anchor: "start",
      fontSize: 10,
      rotation: 25,
      position: "top",
      spacing: 2,
      show: false,
      start: 0.5,
      name: "uid",
    },
  },
};

function cloneConfig(value) {
  if (Array.isArray(value)) return value.map(cloneConfig);
  if (value && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneConfig(child)]));
  }
  // Functions and primitive values are immutable configuration leaves.
  return value;
}

/** Return independent, recursively cloned defaults for one chart instance. */
function createDefaultConfig() {
  return cloneConfig(defaultConfig);
}

function xDistance(scaleX, start, end) {
  return scaleX(end) - scaleX(start);
}

function getClusterLocusRange(
  cluster,
  { scaleX, locusOffset, spacing, locusState }
) {
  const range = [];
  let value = 1;
  let start;
  let end;

  for (const [index, locus] of cluster.loci.entries()) {
    if (index > 0) value = range[range.length - 1] + end - start + spacing;
    const offset = locusOffset(locus.uid) || 0;
    const state = locusState ? locusState(locus) : locus;
    start = scaleX(state.start ?? locus.start);
    end = scaleX(state.end ?? locus.end);
    range.push(value - start + offset);
  }

  return range;
}

function getLocusScaleValues(clusters, layout) {
  const domain = [];
  const range = [];

  for (const cluster of clusters) {
    domain.push(...cluster.loci.map((locus) => locus.uid));
    range.push(...getClusterLocusRange(cluster, layout));
  }

  return { domain, range };
}

const rendererModes = new Set(["svg", "canvas", "webgpu"]);

function isRendererMode(renderer) {
  return rendererModes.has(renderer);
}

function isCanvasRenderer(renderer) {
  return renderer === "canvas";
}

function isWebGpuRenderer(renderer) {
  return renderer === "webgpu";
}

// Canvas and WebGPU share the retained scene, pointer interaction, minimap,
// and preview paths. SVG is intentionally separate because D3 owns its DOM.
function isRasterRenderer(renderer) {
  return isCanvasRenderer(renderer) || isWebGpuRenderer(renderer);
}

// This is deliberately one factory per chart, not a collection of tiny API
// factories: configuration, scales, indexes, and mutable scene state must not
// leak between independently mounted maps.
function createChartRuntime({ idPrefix = "", measureText = null } = {}) {
function refreshClusterOffsetScale() {
  scales.offset.range(
    scales.offset.domain().map((uid) => getClusterOffset(chartState, uid))
  );
}

function refreshLocusOffsetScale() {
  scales.locus.range(
    scales.locus.domain().map((uid) => getLocusOffset(chartState, uid))
  );
}

function locusLayout() {
  return {
    scaleX: scales.x,
    clusterOffset: scales.offset,
    locusOffset: scales.locus,
    locusState,
    spacing: config.locus.spacing,
  };
}

function synchronizeLocusLayoutState(locus, { refresh = true } = {}) {
  const { oldStart } = synchronizeLocusState(
    chartState,
    locus,
    config.plot.scaleGenes
  );
  setLocusOffset(
    chartState,
    locus.uid,
    getCommittedLocusOffset(chartState, locus.uid) +
      xDistance(scales.x, locusState(locus).start, oldStart)
  );
  if (refresh) refreshLocusOffsetScale();
}

function synchronizeLocusLayoutStates(data, locusIds = null) {
  const loci = locusIds
    ? [...locusIds].map(lookup.locusData).filter(Boolean)
    : data.clusters.flatMap((cluster) => cluster.loci);
  for (const locus of loci) synchronizeLocusLayoutState(locus, { refresh: false });
  refreshLocusOffsetScale();
}

const config = createDefaultConfig();
let renderedConfig = null;
function renderConfig() {
  if (!renderedConfig) renderedConfig = figureConfig(config);
  return renderedConfig;
}
let chartIndex = null;
let chartState = null;
let currentScene = null;
let beforeGeneAnchorUpdate = null;
let allowedLinkIds = null;

// IDs are part of the SVG surface, so they must be unique when several maps
// are mounted on the same document. Keep the logical suffix stable: it is
// useful for debugging and for data-driven selectors within a chart.
const ids = {
  root: `${idPrefix}root-svg`,
  picker: `${idPrefix}picker`,
  filter: `${idPrefix}filter_solid`,
  colourGradient: `${idPrefix}colour-gradient`,
  cluster: (d) => `${idPrefix}cluster_${d.uid}`,
  clusterInfo: (d) => `${idPrefix}cinfo_${d.uid}`,
  locus: (d) => `${idPrefix}locus_${d.uid}`,
  gene: (d) => `${idPrefix}gene_${d.uid}`,
  link: (d) => `${idPrefix}link-${d.uid}`,
};

function setChartIndex(index) {
  chartIndex = index;
}

function setChartState(state) {
  chartState = state;
}

function locusState(locus) {
  return getLocusState(chartState, locus);
}

function displayGene(gene) {
  return { ...gene, ...getGeneState(chartState, gene) };
}

const lookup = {
  geneData: (uid) => chartIndex?.geneById.get(uid),
  locusData: (uid) => chartIndex?.locusById.get(uid),
  clusterData: (uid) => chartIndex?.clusterById.get(uid),
  linksForGene: (uid) => chartIndex?.linksByGeneId.get(uid) || [],
};

function validateConfiguration(options, tree = null) {
  validateTreeColouring(options?.tree?.colouring);
  const candidate = createDefaultConfig();
  updateConfig(candidate, config);
  updateConfig(candidate, options);
  if (!["light", "dark", "auto"].includes(candidate.plot.theme)) throw new TypeError("plot.theme must be light, dark or auto.");
  if (typeof candidate.annotations?.enabled !== "boolean") {
    throw new TypeError("annotations.enabled must be a boolean.");
  }
  if (!isRendererMode(candidate.plot.renderer)) {
    throw new TypeError(`Unknown plot renderer: ${candidate.plot.renderer}. Expected svg, canvas, or webgpu.`);
  }
  validateTreePresentation(tree, candidate.tree);
  return candidate;
}

function configure(options, tree = null) {
  validateConfiguration(options, tree);
  updateConfig(config, options);
  renderedConfig = null;
}

const scales = {
  x: linear().domain([1, 1001]).range([0, config.plot.scaleFactor]),
  y: ordinal(),
  group: ordinal().unknown(null),
  colour: ordinal().unknown("#bbb"),
  name: ordinal().unknown("None"),
  score: sequential$1(interpolateGreys).domain([0, 1]),
  offset: ordinal(),
  locus: ordinal(),
};

function updateIdentityScale(data) {
  const identities = data.links
    .map((link) => Number(link.identity))
    .filter(Number.isFinite);
  const dataMin = identities.length ? min(identities) : 0;
  const dataMax = identities.length ? max(identities) : 1;
  const domain = config.colourBar.domain;
  let min$1 = domain.minMode === "data" ? dataMin : Number(domain.min);
  let max$1 = domain.maxMode === "data" ? dataMax : Number(domain.max);
  min$1 = Number.isFinite(min$1) ? Math.max(0, Math.min(1, min$1)) : 0;
  max$1 = Number.isFinite(max$1) ? Math.max(0, Math.min(1, max$1)) : 1;
  if (min$1 === max$1) {
    min$1 = Math.max(0, min$1 - 0.005);
    max$1 = Math.min(1, max$1 + 0.005);
  }
  if (min$1 > max$1) [min$1, max$1] = [max$1, min$1];
  scales.score.domain([min$1, max$1]).clamp(true);
}

// Every scene variant must project the same biological state with the same
// scales and visual policy. Keep that dependency bundle in one place so a
// configuration addition cannot silently affect full builds but not retained
// flip/anchor patches (or vice versa).
function locusText(cluster) {
  return formatLocusText(cluster.loci, chartState, config.cluster.hideLocusCoordinates);
}

function locusTextForCluster(uid) {
  const cluster = lookup.clusterData(uid);
  return cluster ? locusText(cluster) : "";
}

function sceneProjectionOptions({ clusterOrder = null, tree = null } = {}) {
  const config = renderConfig();
  return {
    scaleX: scales.x,
    locusOffset: scales.locus,
    getLocusState: locusState,
    getGeneState: (gene) => getGeneState(chartState, gene),
    clusterOrder,
    shape: config.gene.shape,
    label: config.gene.label,
    link: {
      asLine: config.link.asLine,
      straight: config.link.straight,
      threshold: config.link.threshold,
      labelPosition: config.link.label.position,
    },
    linkVisible: (link) => !allowedLinkIds || allowedLinkIds.has(link.uid),
    clusterLabel: locusText,
    alignLabels: config.cluster.alignLabels,
    trimIndicatorStyle: config.locus.trimIndicators,
    fontFamily: config.plot.fontFamily,
    measureText,
    annotationsEnabled: config.annotations.enabled,
    tree,
    theme: config.figureStyle,
  };
}

function sceneChromeOptions(data) {
  const config = renderConfig();
  return {
    legend: {
      textColour: config.figureStyle.foreground, subtitleColour: config.figureStyle.muted,
      show: config.legend.show,
      placement: config.legend.position,
      columns: config.legend.columns,
      columnWidth: config.legend.columnWidth,
      marginLeft: config.legend.marginLeft,
      marginTop: config.legend.marginTop,
      entryHeight: config.legend.entryHeight,
      fontSize: config.legend.fontSize,
      subtitleFontSize: config.legend.subtitleFontSize,
      fontFamily: config.plot.fontFamily,
      groups: data.groups,
      groupForGene: scales.group,
      colourForGroup: scales.colour,
    },
    scaleBar: {
      textColour: config.figureStyle.foreground,
      show: config.plot.scaleGenes && config.scaleBar.show,
      x: 0,
      marginTop: config.scaleBar.marginTop,
      basePair: config.scaleBar.basePair,
      coordinateFor: scales.x,
      height: config.scaleBar.height,
      colour: config.scaleBar.colour,
      strokeWidth: config.scaleBar.stroke,
      fontSize: config.scaleBar.fontSize,
      fontFamily: config.plot.fontFamily,
    },
    colourBar: {
      textColour: config.figureStyle.foreground,
      show: config.colourBar.show,
      x: config.plot.scaleGenes ? scales.x(config.scaleBar.basePair) + 20 : 0,
      marginTop: config.colourBar.marginTop,
      width: config.colourBar.width,
      height: config.colourBar.height,
      fontSize: config.colourBar.fontSize,
      fontFamily: config.plot.fontFamily,
      scoreColour: scales.score,
      domain: scales.score.domain(),
    },
    link: {
      show: config.link.show,
      groupColour: config.link.groupColour,
    },
  };
}

function buildChartScene(data) {
  // Scene construction is read-only. The controller synchronizes any
  // scale-dependent chart state before asking the runtime to project it.
  // SVG historically applies this policy while binding its link elements.
  // Keep the same result in the shared scene so Canvas and WebGPU consume the
  // exact same best-only, threshold, membership, and hidden-link set.
  allowedLinkIds = new Set(filterLinks(data.links, {
    groupForGene: scales.group,
    geneForUid: lookup.geneData,
    bestOnly: config.link.bestOnly,
    threshold: config.link.threshold,
  }).map((link) => link.uid));
  const clusterOrder = getClusterOrder(chartState);
  currentScene = buildScene(data, {
    ...sceneProjectionOptions({
      tree: data.tree,
      clusterOrder,
    }),
    scaleY: scales.y,
    clusterPosition: (uid) => getClusterPosition(chartState, uid, scales.y(uid)),
    clusterOffset: scales.offset,
    chrome: sceneChromeOptions(data),
  });
  return currentScene;
}

function patchChartScene(previousScene, changes = {}, data) {
  const loci = new Set(changes.loci || []);
  const clusters = new Set(changes.clusters || []);
  // Packing, tree rotations and state changes can affect neighbours beyond
  // the explicit edit. Compare only the cheap locus/cluster state here, never
  // re-project all genes or repeat biological link filtering.
  for (const [uid, cluster] of previousScene.clusters) {
    if (cluster.x !== scales.offset(uid) || cluster.y !== getClusterPosition(chartState, uid, scales.y(uid))) {
      clusters.add(uid);
    }
  }
  for (const [uid, locus] of previousScene.loci) {
    const state = locusState(locus.source);
    if (locus.localX !== scales.locus(uid) ||
        state.start !== locus.state.start || state.end !== locus.state.end ||
        state.flipped !== locus.state.flipped) loci.add(uid);
  }
  currentScene = patchScene(previousScene, { loci, clusters }, {
    ...sceneProjectionOptions({
      tree: data.tree,
      clusterOrder: getClusterOrder(chartState),
    }),
    clusterOffset: scales.offset,
    clusterPosition: (uid) => getClusterPosition(chartState, uid, scales.y(uid)),
    chrome: sceneChromeOptions(data),
  });
  return currentScene;
}

function getScene() {
  return currentScene;
}

function setBeforeGeneAnchorUpdate(callback) {
  beforeGeneAnchorUpdate = callback;
}

function anchorGene(anchor, { flipMismatchedLoci = false } = {}) {
  const genes = scales.group
    .domain()
    .filter((uid) => scales.group(uid) === scales.group(anchor.uid))
    .map(lookup.geneData);

  const flippedLoci = new Set();
  const changes = anchorGeneGroup(chartState, {
    anchor,
    genes,
    locusForGene: (gene) => lookup.locusData(gene.locusUid),
    coordinateForGene: (gene) => {
      const display = displayGene(gene);
      return (
        scales.x(display.start + (display.end - display.start) / 2) +
        scales.locus(gene.locusUid) +
        scales.offset(gene.clusterUid)
      );
    },
    flipMismatchedLoci,
    onLocusFlipped: (locus) => {
      synchronizeLocusLayoutState(locus);
      flippedLoci.add(locus.uid);
    },
  });

  refreshClusterOffsetScale();
  beforeGeneAnchorUpdate?.({ changes, flippedLoci });
  return { changes, flippedLoci };
}

function updateGroups(groups) {
  const { domain, range } = getGroupScaleValues(groups);
  const uids = groups.map((group) => group.uid);
  scales.group.domain(domain).range(range);
  scales.name.domain(uids).range(groups.map((group) => group.label));
  const colours = quantize(interpolateRainbow, groups.length + 1);
  groups.forEach((group, index) => {
    if (group.colour) colours[index] = group.colour;
    else group.colour = colours[index];
  });
  scales.colour.domain(uids).range(colours);
}

function rescaleRanges(oldX) {
  for (const [uid, offset] of chartState.clusterOffsets) {
    setClusterOffset(chartState, uid, scales.x(oldX.invert(offset)));
  }
  for (const [uid, offset] of chartState.locusOffsets) {
    setLocusOffset(chartState, uid, scales.x(oldX.invert(offset)));
  }
  refreshClusterOffsetScale();
  refreshLocusOffsetScale();
}

function updateScales(data, { geometryOnly = false } = {}) {
  const oldX = scales.x.copy();
  scales.x.range([0, config.plot.scaleFactor]);
  // Reproject dependent ranges only when the x-scale range actually changes.
  // Repeating invert()/scale() on every redraw accumulates small
  // floating-point errors, causing static link paths to drift after flips.
  if (oldX.range().some((value, index) => value !== scales.x.range()[index])) {
    rescaleRanges(oldX);
  }

  scales.y.domain(getClusterOrder(chartState));
  const body = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight;
  scales.y.range(data.clusters.map((cluster, index) => index * (config.cluster.spacing + body)));

  if (!geometryOnly) updateIdentityScale(data);

  scales.offset.domain(data.clusters.map((cluster) => cluster.uid));
  refreshClusterOffsetScale();
  const { domain, range } = getLocusScaleValues(data.clusters, {
    ...locusLayout(),
    locusOffset: () => 0,
  });
  // A producer such as clinker may supply an initial alignment as a locus
  // offset in sequence-coordinate units. Convert it through the active x
  // scale here, rather than making callers depend on plot.scaleFactor. An
  // existing chart/project state still wins, so data refreshes never undo a
  // user drag or restored project layout.
  const suppliedOffsets = new Map(
    data.clusters.flatMap((cluster) => cluster.loci)
      .filter((locus) => Number.isFinite(locus.offset))
      .map((locus) => [locus.uid, xDistance(scales.x, 0, locus.offset)])
  );
  initializeLocusOffsets(chartState, domain.map((uid, index) => [
    uid,
    suppliedOffsets.get(uid) ?? range[index],
  ]));
  scales.locus.domain(domain);
  refreshLocusOffsetScale();
}

return {
  config,
  get renderConfig() { return renderConfig(); },
  configure,
  validateConfiguration,
  lookup,
  ids,
  locusTextForCluster,
  synchronizeLocusLayoutState,
  synchronizeLocusLayoutStates,
  setChartIndex,
  setChartState,
  scales,
  updateScales,
  updateGroups,
  getScene,
  buildScene: buildChartScene,
  patchScene: patchChartScene,
  patchAnnotations(previousScene, data) {
    currentScene = patchAnnotationScene(previousScene, data.annotationPanels, sceneProjectionOptions({ tree: data.tree }));
    return currentScene;
  },
  setBeforeGeneAnchorUpdate,
  anchorGene,
};
}

// Retain a synchronous renderer's scene between full redraws and preview paints.
function createRetainedSceneBackend({ render, surface }) {
  let pendingScene = null;

  return {
    get pendingScene() {
      return pendingScene;
    },
    setScene: (scene) => {
      pendingScene = scene;
    },
    paint: (request) => {
      if (request.scene) pendingScene = request.scene;
      if (!request[surface] || !pendingScene) return null;
      return render({ ...request, scene: pendingScene });
    },
    destroy: () => {
      pendingScene = null;
    },
  };
}

function recordBounds(scene, records) {
  let result = null;
  for (const [type, ids] of Object.entries(records)) for (const uid of ids) {
    const bounds = scene[type].get(uid)?.bounds;
    if (!bounds) continue;
    if (!result) result = { ...bounds };
    else {
      result.minX = Math.min(result.minX, bounds.minX); result.maxX = Math.max(result.maxX, bounds.maxX);
      result.minY = Math.min(result.minY, bounds.minY); result.maxY = Math.max(result.maxY, bounds.maxY);
    }
  }
  return result;
}

function screenFrame(bounds, dimensions, camera, padding = 12) {
  if (!bounds) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.max(0, camera.x + bounds.minX * camera.k - padding);
  const y = Math.max(0, camera.y + bounds.minY * camera.k - padding);
  const right = Math.min(dimensions.width, camera.x + bounds.maxX * camera.k + padding);
  const bottom = Math.min(dimensions.height, camera.y + bounds.maxY * camera.k + padding);
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

function flipRecords(scene, locusUid) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;
  const loci = new Set([locusUid]), ownGenes = new Set(locus.genes.map((gene) => gene.source.uid));
  const genes = new Set(ownGenes), links = new Set();
  for (const uid of ownGenes) for (const link of scene.linksByGene.get(uid) || []) {
    links.add(link.uid); genes.add(link.query.uid); genes.add(link.target.uid);
  }
  return { locus: { loci, genes: ownGenes }, dynamic: { loci, genes, links },
    stationaryGenes: new Set([...genes].filter((uid) => !ownGenes.has(uid))) };
}

/** Own Canvas resources across paints; the chart supplies scenes and animation progress. */
function createCanvasBackend({ render = renderCanvas,
  requestFrame = globalThis.requestAnimationFrame, cancelFrame = globalThis.cancelAnimationFrame } = {}) {
  let pendingScene = null, latest = null, cached = null, warmFrame = null;
  const dimensions = (request) => request.dimensions || request.canvas.getBoundingClientRect();
  const matches = (request, scene, locusUid) => {
    if (!cached || cached.scene !== scene || cached.locusUid !== locusUid || cached.canvas !== request.canvas ||
        cached.config !== request.config || cached.tree !== request.tree || cached.pixelRatio !== request.pixelRatio) return false;
    const size = dimensions(request), camera = request.camera;
    return size.width === cached.width && size.height === cached.height &&
      camera.x === cached.camera.x && camera.y === cached.camera.y && camera.k === cached.camera.k;
  };
  const cancelWarm = () => {
    if (warmFrame !== null) cancelFrame(warmFrame);
    warmFrame = null;
  };
  const clearFlip = () => { cancelWarm(); cached = null; };
  const prepareFlip = (locusUid, scene = pendingScene) => {
    cancelWarm();
    if (!latest?.canvas || !scene || matches(latest, scene, locusUid)) return;
    const records = flipRecords(scene, locusUid);
    if (!records) return;
    const { canvas, camera, config, scales, tree, pixelRatio } = latest;
    const size = dimensions(latest), document = canvas.ownerDocument;
    const baseCanvas = document.createElement("canvas"), locusCanvas = document.createElement("canvas");
    const options = { scene, camera, config, scales, tree, pixelRatio, dimensions: size, suppressLocusHover: true };
    render({ ...options, canvas: baseCanvas, omit: records.dynamic, layers: ["links", "linkLabels"] });
    render({ ...options, canvas: baseCanvas, omit: { loci: records.dynamic.loci, genes: records.dynamic.genes },
      layers: CANVAS_LAYERS.filter((layer) => layer !== "links" && layer !== "linkLabels"), clear: false });
    const locusFrame = screenFrame(recordBounds(scene, records.locus), size, camera);
    render({ ...options, canvas: locusCanvas, camera: { ...camera, x: camera.x - locusFrame.x, y: camera.y - locusFrame.y },
      dimensions: locusFrame, include: records.locus, layers: ["tracks", "trimIndicators", "genes"] });
    cached = { scene, locusUid, canvas, camera: { ...camera }, config, tree, pixelRatio,
      width: size.width, height: size.height, baseCanvas, locusCanvas, locusFrame, records,
      dirtyFrame: screenFrame(recordBounds(scene, records.dynamic), size, camera) };
  };
  const paintFlip = (request) => {
    const { canvas, camera, config, preview, pixelRatio } = request;
    const { baseCanvas, locusCanvas, locusFrame, dirtyFrame, records } = cached;
    const context = canvas.getContext("2d");
    const left = Math.max(0, Math.floor(dirtyFrame.x * pixelRatio));
    const top = Math.max(0, Math.floor(dirtyFrame.y * pixelRatio));
    const width = Math.max(1, Math.min(baseCanvas.width, Math.ceil((dirtyFrame.x + dirtyFrame.width) * pixelRatio)) - left);
    const height = Math.max(1, Math.min(baseCanvas.height, Math.ceil((dirtyFrame.y + dirtyFrame.height) * pixelRatio)) - top);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(left / pixelRatio, top / pixelRatio, width / pixelRatio, height / pixelRatio);
    context.drawImage(baseCanvas, left, top, width, height, left / pixelRatio, top / pixelRatio, width / pixelRatio, height / pixelRatio);
    const options = { canvas, scene: cached.scene, camera, config, preview, pixelRatio,
      scales: request.scales, suppressLocusHover: true, clear: false };
    // Ribbons stay filled during a flip and beneath both endpoint genes.
    render({ ...options, config: { ...config, link: { ...config.link, asLine: false } },
      include: { links: records.dynamic.links }, layers: ["links"] });
    const axis = preview.axes?.get(preview.locusUid);
    if (axis !== undefined) {
      const screenAxis = camera.x + axis * camera.k;
      context.save(); context.beginPath();
      context.rect(dirtyFrame.x, dirtyFrame.y, dirtyFrame.width, dirtyFrame.height); context.clip();
      context.translate(screenAxis, 0); context.scale(1 - 2 * preview.progress, 1); context.translate(-screenAxis, 0);
      context.drawImage(locusCanvas, 0, 0, locusCanvas.width, locusCanvas.height,
        locusFrame.x, locusFrame.y, locusFrame.width, locusFrame.height);
      context.restore();
    }
    if (records.stationaryGenes.size) render({ ...options, preview: null,
      include: { genes: records.stationaryGenes }, layers: ["genes", "geneLabels"] });
    render({ ...options, include: { loci: records.locus.loci }, layers: ["trimIndicators", "clusterLabels"] });
    return dirtyFrame;
  };

  return {
    get pendingScene() { return pendingScene; },
    setScene(scene) { pendingScene = scene; },
    prepareFlip,
    clearFlip,
    warmLocus(locusUid) {
      if (!locusUid || !latest || latest.preview?.type === "locus-flip") return;
      cancelWarm();
      warmFrame = requestFrame(() => { warmFrame = null; prepareFlip(locusUid); });
    },
    paint(request) {
      if (request.scene) pendingScene = request.scene;
      if (!request.canvas || !pendingScene) return null;
      latest = { ...request, scene: pendingScene };
      if (cached && !matches(latest, pendingScene, cached.locusUid)) clearFlip();
      if (cached && request.preview?.type === "locus-flip" && cached.locusUid === request.preview.locusUid) return paintFlip(latest);
      return render(latest);
    },
    destroy() { clearFlip(); pendingScene = latest = null; },
  };
}

// Deliberately small, direct WebGPU renderer for the renderer-neutral scene.

const shader = /* wgsl */ `
struct Camera {
  // camera x/y, zoom, shared annotation x offset.
  transform: vec4f,
  viewport: vec2f,
  // vec4 alignment leaves two padding floats after viewport.
  // asLine, straight, stroke width, reserved.
  linkStyle: vec4f,
}
@group(0) @binding(0) var<uniform> camera: Camera;
struct ClusterOffsets {
  values: array<vec2f>,
}
@group(0) @binding(1) var<storage, read> clusterOffsets: ClusterOffsets;
struct LinkRecord {
  query: vec4f,
  mate: vec4f,
  fill: vec4f,
  stroke: vec4f,
}
struct LinkRecords {
  values: array<LinkRecord>,
}
struct LinkIndices {
  values: array<u32>,
}
@group(0) @binding(2) var<storage, read> linkRecords: LinkRecords;
@group(0) @binding(3) var<storage, read> linkIndices: LinkIndices;
struct LocusTransforms {
  // x translation, reserved, x scale, flip axis (in retained coordinates).
  values: array<vec4f>,
}
@group(0) @binding(4) var<storage, read> locusTransforms: LocusTransforms;

fn transformPoint(point: vec2f, slot: u32) -> vec2f {
  let transform = locusTransforms.values[slot];
  return vec2f(
    transform.w + (point.x - transform.w) * transform.z + transform.x,
    point.y,
  ) + clusterOffsets.values[slot];
}

fn transformEndpoint(endpoint: vec4f) -> vec4f {
  let slot = u32(endpoint.w);
  let first = transformPoint(vec2f(endpoint.x, endpoint.z), slot);
  let second = transformPoint(vec2f(endpoint.y, endpoint.z), slot);
  return vec4f(first.x, second.x, first.y, endpoint.w);
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) colour: vec4f,
  @location(2) transformSlot: f32,
}
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) colour: vec4f,
}

struct RectangleInput {
  @location(0) rect: vec4f,
  @location(1) colour: vec4f,
  @location(2) rowSlot: f32,
}

@vertex fn rectangleVertex(input: RectangleInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  // Annotation columns stay aligned when a cluster moves horizontally; only
  // its row translation is inherited. Locus flips never reflect heatmaps.
  let offset = vec2f(camera.transform.w, clusterOffsets.values[u32(input.rowSlot)].y);
  let world = input.rect.xy + corners[vertexIndex] * input.rect.zw + offset;
  let screen = world * camera.transform.z + camera.transform.xy;
  var output: VertexOutput;
  output.position = vec4f(screen.x / camera.viewport.x * 2.0 - 1.0,
    1.0 - screen.y / camera.viewport.y * 2.0, 0.0, 1.0);
  output.colour = input.colour;
  return output;
}

struct StrokeInput {
  @location(0) first: vec2f,
  @location(1) second: vec2f,
  @location(2) colour: vec4f,
  @location(3) transformSlot: f32,
  @location(4) width: f32,
}

@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  let screen = transformPoint(input.position, u32(input.transformSlot))
    * camera.transform.z + camera.transform.xy;
  var output: VertexOutput;
  output.position = vec4f(
    screen.x / camera.viewport.x * 2.0 - 1.0,
    1.0 - screen.y / camera.viewport.y * 2.0,
    0.0,
    1.0
  );
  output.colour = input.colour;
  return output;
}

// WebGPU line-list primitives are always one *physical* pixel wide. Draw
// gene outlines as quads instead so their configured stroke width matches
// Canvas and SVG at every device-pixel ratio and camera scale.
fn projectStroke(
  worldFirst: vec2f,
  worldSecond: vec2f,
  width: f32,
  corner: u32,
  colour: vec4f,
) -> VertexOutput {
  let first = worldFirst * camera.transform.z + camera.transform.xy;
  let second = worldSecond * camera.transform.z + camera.transform.xy;
  let delta = second - first;
  let segmentLength = max(length(delta), 0.0001);
  let direction = delta / segmentLength;
  let normal = vec2f(-direction.y, direction.x);
  let halfWidth = width * camera.transform.z / 2.0;
  let useSecond = corner == 1u || corner == 2u || corner == 4u;
  let positiveSide = corner == 2u || corner == 4u || corner == 5u;
  // Extending each endpoint by half a stroke joins adjacent edge quads at
  // polygon corners without a CPU-side miter calculation.
  let point = select(first - direction * halfWidth, second + direction * halfWidth, useSecond);
  let screen = point + normal * select(-halfWidth, halfWidth, positiveSide);
  var output: VertexOutput;
  output.position = vec4f(
    screen.x / camera.viewport.x * 2.0 - 1.0,
    1.0 - screen.y / camera.viewport.y * 2.0,
    0.0,
    1.0
  );
  output.colour = colour;
  return output;
}

@vertex fn strokeVertex(
  input: StrokeInput,
  @builtin(vertex_index) vertexIndex: u32,
) -> VertexOutput {
  return projectStroke(
    transformPoint(input.first, u32(input.transformSlot)),
    transformPoint(input.second, u32(input.transformSlot)),
    input.width,
    vertexIndex % 6u,
    input.colour,
  );
}

@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return input.colour;
}

fn cubic(start: f32, controlA: f32, controlB: f32, end: f32, amount: f32) -> f32 {
  let inverse = 1.0 - amount;
  return inverse * inverse * inverse * start +
    3.0 * inverse * inverse * amount * controlA +
    3.0 * inverse * amount * amount * controlB +
    amount * amount * amount * end;
}

fn ribbonPoint(link: LinkRecord, edge: u32, amount: f32) -> vec2f {
  let query = transformEndpoint(link.query);
  let mate = transformEndpoint(link.mate);
  let queryIsTop = query.z <= mate.z;
  let top = select(mate, query, queryIsTop);
  let bottom = select(query, mate, queryIsTop);
  let topY = top.z;
  let bottomY = bottom.z;
  let topX = select(top.x, top.y, edge == 0u);
  let bottomX = select(bottom.x, bottom.y, edge == 0u);
  let middle = topY + abs(bottomY - topY) / 2.0;
  if (camera.linkStyle.y > 0.5) {
    return vec2f(
      mix(topX, bottomX, amount),
      mix(topY, bottomY, amount)
    );
  }
  return vec2f(
    cubic(topX, topX, bottomX, bottomX, amount),
    cubic(topY, middle, middle, bottomY, amount)
  );
}

fn linkCentrePoint(link: LinkRecord, amount: f32) -> vec2f {
  let query = transformEndpoint(link.query);
  let mate = transformEndpoint(link.mate);
  let queryX = (query.x + query.y) / 2.0;
  let mateX = (mate.x + mate.y) / 2.0;
  let queryY = query.z;
  let mateY = mate.z;
  if (camera.linkStyle.y > 0.5) {
    return vec2f(mix(queryX, mateX, amount), mix(queryY, mateY, amount));
  }
  let middle = (queryY + mateY) / 2.0;
  return vec2f(
    cubic(queryX, queryX, mateX, mateX, amount),
    cubic(queryY, middle, middle, mateY, amount)
  );
}

fn projectWorld(point: vec2f, colour: vec4f) -> VertexOutput {
  let screen = point * camera.transform.z + camera.transform.xy;
  var output: VertexOutput;
  output.position = vec4f(
    screen.x / camera.viewport.x * 2.0 - 1.0,
    1.0 - screen.y / camera.viewport.y * 2.0,
    0.0,
    1.0
  );
  output.colour = colour;
  return output;
}

@vertex fn linkFillVertex(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let link = linkRecords.values[linkIndices.values[instanceIndex]];
  if (camera.linkStyle.x > 0.5) {
    return projectWorld(linkCentrePoint(link, 0.0), vec4f(link.fill.rgb, 0.0));
  }
  let segment = vertexIndex / 6u;
  let corner = vertexIndex % 6u;
  let start = f32(segment) / 10.0;
  let end = f32(segment + 1u) / 10.0;
  var edge = 0u;
  var amount = start;
  if (corner == 1u || corner == 3u) {
    amount = end;
  } else if (corner == 4u) {
    edge = 1u;
    amount = end;
  } else if (corner == 2u || corner == 5u) {
    edge = 1u;
  }
  return projectWorld(ribbonPoint(link, edge, amount), link.fill);
}

@vertex fn linkEdgeVertex(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let link = linkRecords.values[linkIndices.values[instanceIndex]];
  let segment = vertexIndex / 6u;
  let corner = vertexIndex % 6u;
  if (camera.linkStyle.x > 0.5) {
    if (segment >= 10u) {
      return projectWorld(linkCentrePoint(link, 0.0), vec4f(link.stroke.rgb, 0.0));
    }
    return projectStroke(
      linkCentrePoint(link, f32(segment) / 10.0),
      linkCentrePoint(link, f32(segment + 1u) / 10.0),
      camera.linkStyle.z,
      corner,
      link.stroke,
    );
  }
  if (segment < 10u) {
    return projectStroke(
      ribbonPoint(link, 0u, f32(segment) / 10.0),
      ribbonPoint(link, 0u, f32(segment + 1u) / 10.0),
      camera.linkStyle.z,
      corner,
      link.stroke,
    );
  }
  if (segment < 20u) {
    return projectStroke(
      ribbonPoint(link, 1u, f32(segment - 10u) / 10.0),
      ribbonPoint(link, 1u, f32(segment - 9u) / 10.0),
      camera.linkStyle.z,
      corner,
      link.stroke,
    );
  }
  if (segment == 20u) {
    return projectStroke(ribbonPoint(link, 0u, 0.0), ribbonPoint(link, 1u, 0.0), camera.linkStyle.z, corner, link.stroke);
  }
  return projectStroke(ribbonPoint(link, 0u, 1.0), ribbonPoint(link, 1u, 1.0), camera.linkStyle.z, corner, link.stroke);
}`;

function rgba(value, fallback = [0.6, 0.6, 0.6, 1]) {
  const colour = color(value)?.rgb();
  return colour
    ? [Number.isFinite(colour.r) ? colour.r / 255 : 0,
      Number.isFinite(colour.g) ? colour.g / 255 : 0,
      Number.isFinite(colour.b) ? colour.b / 255 : 0, colour.opacity ?? 1]
    : fallback;
}

function pushVertex(vertices, x, y, colour, clusterSlot = 0) {
  vertices.push(x, y, ...colour, clusterSlot);
}

function pushTriangle(vertices, first, second, third, colour, clusterSlot = 0) {
  pushVertex(vertices, first[0], first[1], colour, clusterSlot);
  pushVertex(vertices, second[0], second[1], colour, clusterSlot);
  pushVertex(vertices, third[0], third[1], colour, clusterSlot);
}

function pushStrokeSegment(vertices, first, second, colour, clusterSlot, width) {
  vertices.push(...first, ...second, ...colour, clusterSlot, width);
}

function pushGene(
  vertices,
  edges,
  gene,
  colour,
  points = gene.polygon,
  stroke = [0, 0, 0, 1],
  clusterSlot = 0,
  strokeWidth = 1
) {
  if (points.length !== 14) return;
  const point = (index) => [points[index * 2], points[index * 2 + 1]];
  // The seven-point gene arrow is concave at its shaft/arrow junction. This
  // fixed triangulation matches the Canvas/SVG polygon without a general
  // triangulation dependency.
  for (const triangle of [[0, 1, 6], [1, 5, 6], [1, 2, 5], [2, 4, 5], [2, 3, 4]]) {
    pushTriangle(vertices, point(triangle[0]), point(triangle[1]), point(triangle[2]), colour, clusterSlot);
  }
  for (let index = 0; index < 7; index += 1) {
    pushStrokeSegment(
      edges,
      point(index),
      point((index + 1) % 7),
      stroke,
      clusterSlot,
      strokeWidth
    );
  }
}

function pushLink(vertices, edges, link, colour, stroke, {
  visible = link.visible,
  anchors = link.anchors,
  segments = 10,
  asLine = false,
  straight = false,
  strokeWidth = 1,
} = {}) {
  if (!visible || !anchors) return;
  const geometry = sampleLinkGeometry(anchors, { asLine, straight, segments });
  const strokeSegment = (first, second) => pushStrokeSegment(
    edges, first, second, stroke, 0, strokeWidth
  );
  if (asLine) {
    for (let index = 1; index < geometry.line.length; index += 1) {
      strokeSegment(geometry.line[index - 1], geometry.line[index]);
    }
    return;
  }
  for (let index = 0; index < geometry.upper.length - 1; index += 1) {
    pushTriangle(vertices, geometry.upper[index], geometry.upper[index + 1], geometry.lower[index], colour);
    pushTriangle(vertices, geometry.upper[index + 1], geometry.lower[index + 1], geometry.lower[index], colour);
    strokeSegment(geometry.upper[index], geometry.upper[index + 1]);
    strokeSegment(geometry.lower[index], geometry.lower[index + 1]);
  }
  strokeSegment(geometry.upper[0], geometry.lower[0]);
  strokeSegment(geometry.upper.at(-1), geometry.lower.at(-1));
}

// A committed trim can make a gene or link invisible in the retained scene.
// Keep its GPU range while the containing locus remains trimmed: a later
// handle drag may expand the boundary and must be able to reveal it without a
// complete scene rebuild.
function locusCanChangeTrimVisibility(locus) {
  return (
    locus?.state?.start > locus?.source?.start ||
    locus?.state?.end < locus?.source?.end
  );
}

function linkCanChangeTrimVisibility(scene, link) {
  return [link.source.query.uid, link.source.target.uid].some((uid) =>
    locusCanChangeTrimVisibility(scene.genes.get(uid)?.locus)
  );
}

function transparent(colour) {
  return [colour[0], colour[1], colour[2], 0];
}

function geneVertices(gene, scales, preview = null, clusterSlot = 0, strokeWidth = 1, strokeColour = "black") {
  const fill = [];
  const edge = [];
  const visible = geneVisibleForPreview(preview, gene);
  const colour = rgba(gene.source.colour || scales.colour(scales.group(gene.source.uid)));
  pushGene(
    fill,
    edge,
    gene,
    visible ? colour : transparent(colour),
    genePolygonForPreview(preview, gene, { includeClusterOffset: false }),
    visible ? rgba(strokeColour) : [0, 0, 0, 0],
    clusterSlot,
    strokeWidth
  );
  return { genes: new Float32Array(fill), geneEdges: new Float32Array(edge) };
}

function linkVertices(scene, link, scales, config, preview = null) {
  const fill = [];
  const edge = [];
  const visible = linkVisibleForPreview(scene, link, preview, config);
  const colour = rgba(
    link.source.colour || (config.link.groupColour
      ? scales.colour(scales.group(link.source.query.uid))
      : scales.score(link.source.identity))
  );
  const stroke = rgba(
    link.source.colour || (config.link.groupColour
      ? scales.colour(scales.group(link.source.query.uid))
      : config.figureStyle?.outline || "black")
  );
  const opacity = link.opacity ?? 1;
  colour[3] *= opacity;
  stroke[3] *= opacity;
  pushLink(fill, edge, link, visible ? colour : transparent(colour), visible ? stroke : transparent(stroke), {
    // Keeping retained link records at a constant vertex count lets a trim
    // preview toggle visibility by alpha alone.
    visible: true,
    anchors: preview ? previewLinkAnchors(scene, link, preview) : link.anchors,
    asLine: config.link.asLine,
    straight: config.link.straight,
    strokeWidth: config.link.strokeWidth,
  });
  return { links: new Float32Array(fill), linkEdges: new Float32Array(edge) };
}

function linkEndpointForGpu(gene, clusterSlot, offsetX = 0, offsetY = 0) {
  const forward = gene.display.strand === 1;
  return [
    (forward ? gene.bounds.minX : gene.bounds.maxX) - offsetX,
    (forward ? gene.bounds.maxX : gene.bounds.minX) - offsetX,
    gene.locus.y + gene.locus.track.y - offsetY,
    clusterSlot,
  ];
}

function linkRecordForGpu(scene, link, scales, config, locusSlots, clusterOffsetX = () => 0, clusterOffsetY = () => 0) {
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return null;
  const fill = rgba(
    link.source.colour || (config.link.groupColour
      ? scales.colour(scales.group(link.source.query.uid))
      : scales.score(link.source.identity))
  );
  const stroke = rgba(
    link.source.colour || (config.link.groupColour
      ? scales.colour(scales.group(link.source.query.uid))
      : "black")
  );
  fill[3] *= link.opacity ?? 1;
  stroke[3] *= link.opacity ?? 1;
  return new Float32Array([
    ...linkEndpointForGpu(
      query,
      locusSlots.get(query.locus.source.uid),
      clusterOffsetX(query.locus.cluster.uid),
      clusterOffsetY(query.locus.cluster.uid)
    ),
    ...linkEndpointForGpu(
      target,
      locusSlots.get(target.locus.source.uid),
      clusterOffsetX(target.locus.cluster.uid),
      clusterOffsetY(target.locus.cluster.uid)
    ),
    ...fill,
    ...stroke,
  ]);
}

function buildLinkRecords(scene, scales, config, locusSlots) {
  const values = [];
  const indexByUid = new Map();
  for (const link of scene.links.values()) {
    const record = linkRecordForGpu(scene, link, scales, config, locusSlots);
    if (!record) continue;
    indexByUid.set(link.source.uid, indexByUid.size);
    values.push(...record);
  }
  return { values: new Float32Array(values), indexByUid };
}

function trackVertices(locus, config, preview = null, clusterSlot = 0) {
  const geometry = locusGeometryForPreview(preview, locus);
  const { x, y: previewY } = geometry.offsets || { x: 0, y: 0 };
  const y = preview?.type === "cluster-drag" ? 0 : previewY;
  const track = geometry.track || locus.track;
  const vertices = [];
  pushStrokeSegment(
    vertices,
    [locus.x + track.x1 + x, locus.y + track.y + y],
    [locus.x + track.x2 + x, locus.y + track.y + y],
    rgba(config.locus.trackBar.colour, [0.07, 0.07, 0.07, 1]),
    clusterSlot,
    config.locus.trackBar.stroke
  );
  return new Float32Array(vertices);
}

function append(target, values) {
  const range = { offset: target.length, length: values.length };
  target.push(...values);
  return range;
}

function translateVertices(values, offsetX, offsetY, stride) {
  if (!offsetX && !offsetY) return values;
  const translated = new Float32Array(values);
  for (let index = 0; index < translated.length; index += stride) {
    translated[index] -= offsetX;
    translated[index + 1] -= offsetY;
    if (stride === 10) {
      translated[index + 2] -= offsetX;
      translated[index + 3] -= offsetY;
    }
  }
  return translated;
}

function buildGeometry(scene, scales, config, preview = null, clusterSlots = null) {
  const links = [];
  const genes = [];
  const linkEdges = [];
  const geneEdges = [];
  const tracks = [];
  const ranges = { links: new Map(), genes: new Map(), loci: new Map() };
  const slots = clusterSlots || new Map(
    [...scene.clusters.keys()].map((uid, index) => [uid, index + 1])
  );
  // Each locus gets one slot shared by its genes, track, and link endpoints.
  // Cluster slots retain committed translations; locus slots inherit them.
  const locusSlots = new Map();
  let nextSlot = slots.size + 1;
  for (const uid of scene.loci.keys()) {
    locusSlots.set(uid, nextSlot++);
  }
  for (const link of scene.links.values()) {
    // Normally an invisible link has no reason to consume a GPU range. The
    // exception is a link hidden solely by a committed trim: it can reappear
    // during an expanding trim preview.
    if (!link.visible && !linkCanChangeTrimVisibility(scene, link)) continue;
    const vertices = linkVertices(scene, link, scales, config, preview);
    ranges.links.set(link.source.uid, {
      links: append(links, vertices.links),
      linkEdges: append(linkEdges, vertices.linkEdges),
    });
  }
  for (const gene of scene.genes.values()) {
    // Retain hidden genes belonging to committed trims so a later drag can
    // reveal them by changing alpha in-place. Other hidden records stay out
    // of the dense buffer as before.
    if (!gene.visible && !locusCanChangeTrimVisibility(gene.locus)) continue;
    const vertices = geneVertices(
      gene,
      scales,
      preview,
      locusSlots.get(gene.locus.source.uid),
      config.gene.shape.strokeWidth, config.gene.shape.stroke
    );
    ranges.genes.set(gene.source.uid, {
      genes: append(genes, vertices.genes),
      geneEdges: append(geneEdges, vertices.geneEdges),
    });
  }
  for (const locus of scene.loci.values()) {
    ranges.loci.set(locus.source.uid, {
      tracks: append(tracks, trackVertices(locus, config, preview, locusSlots.get(locus.source.uid))),
    });
  }
  return {
    data: {
      links: new Float32Array(links),
      linkEdges: new Float32Array(linkEdges),
      tracks: new Float32Array(tracks),
      genes: new Float32Array(genes),
      geneEdges: new Float32Array(geneEdges),
    },
    ranges,
    clusterSlots: slots,
    locusSlots,
    slotCount: nextSlot,
  };
}

function isLocusTransformPreview(preview) {
  return ["locus-offset", "locus-offsets", "locus-flip"].includes(preview?.type);
}

function viewportForCamera(camera, width, height, overscan = 20) {
  return worldViewport(camera, { width, height }, overscan);
}

function bufferFor(device, existing, data) {
  if (!data.byteLength) return null;
  if (!existing || existing.size < data.byteLength) {
    existing?.destroy();
    existing = device.createBuffer({
      size: Math.max(data.byteLength, 4),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }
  device.queue.writeBuffer(existing, 0, data);
  return existing;
}

/** Create an opt-in direct WebGPU renderer for dense scene geometry. */
async function createWebGpuRenderer(canvas) {
  if (!globalThis.navigator?.gpu) return null;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) return null;
  const format = navigator.gpu.getPreferredCanvasFormat();
  const module = device.createShaderModule({ code: shader });
  // Browser implementations are allowed to defer WGSL validation until a
  // pipeline is created, which otherwise produces an unhelpful “pipeline is
  // invalid” message. Surface compiler locations and let clusterMap use its
  // established Canvas fallback instead.
  const diagnostics = await module.getCompilationInfo();
  const errors = diagnostics.messages.filter((message) => message.type === "error");
  if (errors.length) {
    throw new Error(
      `WebGPU shader compilation failed:\n${errors
        .map((message) => `line ${message.lineNum}:${message.linePos} ${message.message}`)
        .join("\n")}`
    );
  }
  const vertexBuffers = [{
    arrayStride: 28,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" },
      { shaderLocation: 1, offset: 8, format: "float32x4" },
      { shaderLocation: 2, offset: 24, format: "float32" },
    ],
  }];
  const strokeVertexBuffers = [{
    // first.xy, second.xy, colour.rgba, cluster slot, world-space stroke width
    arrayStride: 40,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" },
      { shaderLocation: 1, offset: 8, format: "float32x2" },
      { shaderLocation: 2, offset: 16, format: "float32x4" },
      { shaderLocation: 3, offset: 32, format: "float32" },
      { shaderLocation: 4, offset: 36, format: "float32" },
    ],
    stepMode: "instance",
  }];
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const target = [{
    format,
    blend: {
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
    },
  }];
  const createPipeline = device.createRenderPipelineAsync
    ? (descriptor) => device.createRenderPipelineAsync(descriptor)
    : (descriptor) => Promise.resolve(device.createRenderPipeline(descriptor));
  // Canvas/SVG smooth shape edges by default. Use multisampling for comparable
  // WebGPU edge quality without reducing the requested backing resolution.
  const multisample = { count: 4 };
  const pipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vertexMain", buffers: vertexBuffers },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  });
  const strokePipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "strokeVertex", buffers: strokeVertexBuffers },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  });
  const linkPipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "linkFillVertex" },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  });
  const linkLinePipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "linkEdgeVertex" },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  });
  // Annotation-only pipeline: ordinary synteny charts never compile it.
  let rectanglePipeline = null;
  const rectanglePipelineDescriptor = {
    layout: pipelineLayout,
    vertex: { module, entryPoint: "rectangleVertex", buffers: [{
      arrayStride: 36,
      stepMode: "instance",
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x4" },
        { shaderLocation: 1, offset: 16, format: "float32x4" },
        { shaderLocation: 2, offset: 32, format: "float32" },
      ],
    }] },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  };
  const uniform = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  let clusterOffsetBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let clusterOffsetCapacity = 1;
  // Each cluster owns a world-space x/y translation. Reusing this tiny
  // buffer lets committed cluster moves avoid rebuilding every gene vertex.
  let clusterBaseOffsets = new Float32Array(clusterOffsetCapacity * 2);
  let linkRecordBuffer = device.createBuffer({
    // A runtime-sized WGSL array must fit at least one LinkRecord, even when
    // the chart has no links. Validation also applies to zero-instance draws.
    size: 64,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let linkRecordCapacity = 16;
  let linkIndexBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let linkIndexCapacity = 1;
  let locusTransformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let locusTransformCapacity = 1;
  const createBindGroup = () => device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniform } },
      { binding: 1, resource: { buffer: clusterOffsetBuffer } },
      { binding: 2, resource: { buffer: linkRecordBuffer } },
      { binding: 3, resource: { buffer: linkIndexBuffer } },
      { binding: 4, resource: { buffer: locusTransformBuffer } },
    ],
  });
  let bindGroup = createBindGroup();
  let linkBuffer = null;
  let linkEdgeBuffer = null;
  let trackBuffer = null;
  let geneBuffer = null;
  let geneEdgeBuffer = null;
  let linkCount = 0;
  let linkEdgeCount = 0;
  let previewLinkCount = 0;
  let previewLinksActive = false;
  let retainedClusterGeometry = false;
  let linkRecordIndexByUid = new Map();
  let clusterPreviewIndexCache = new Map();
  let trackCount = 0;
  let geneCount = 0;
  let geneEdgeCount = 0;
  let scene = null;
  let preview = null;
  let geometry = null;
  let patchedRecords = null;
  let configured = false;
  let multisampleTexture = null;
  let annotationBuffer = null, annotationKeyBuffer = null;
  let annotationCount = 0, annotationKeyCount = 0;
  let annotationPanels = null, annotationKeyPreview = null, annotationGroupRows = null;
  const annotationRows = new Map(), annotationKeys = new Map();

  const appendRectangle = (values, rect, x, y, slot = 0) => {
    values.push(x + rect.x, y + rect.y, rect.width, rect.height, ...rgba(rect.fill), slot);
  };
  const updateAnnotations = (nextPreview) => {
    if (!scene.annotationPanels?.length) {
      annotationBuffer?.destroy(); annotationKeyBuffer?.destroy();
      annotationBuffer = annotationKeyBuffer = null;
      annotationCount = annotationKeyCount = 0;
      annotationPanels = scene.annotationPanels; annotationKeyPreview = annotationGroupRows = null;
      annotationRows.clear(); annotationKeys.clear();
      return;
    }
    const changed = annotationPanels !== scene.annotationPanels;
    const cellsChanged = changed && (!annotationPanels || annotationPanels.length !== scene.annotationPanels.length ||
      scene.annotationPanels.some((panel, i) => {
        const before = annotationPanels[i];
        return panel.uid !== before.uid || panel.rows !== before.rows || panel.x !== before.x || panel.rowOffset !== before.rowOffset;
      }));
    if (changed) annotationPanels = scene.annotationPanels;
    if (cellsChanged) {
      annotationRows.clear();
      const values = [];
      for (const panel of annotationPanels || []) {
        const rows = new Map(); annotationRows.set(panel.uid, rows);
        for (const row of panel.rows) {
          const offsets = [];
          const slot = geometry.clusterSlots.get(row.uid);
          // Retained gene geometry may still use an earlier row order. Remove
          // that baseline from new cell instances before the GPU adds it back.
          const y = scene.clusters.get(row.uid).y + panel.rowOffset - clusterBaseOffsets[slot * 2 + 1];
          for (const cell of row.cells) {
            offsets.push(values.length / 9);
            for (const rect of cell.rects) appendRectangle(values, rect, panel.x, y, slot);
          }
          offsets.push(values.length / 9); rows.set(row.uid, offsets);
        }
      }
      annotationCount = values.length / 9;
      if (annotationCount) annotationBuffer = bufferFor(device, annotationBuffer, new Float32Array(values));
    }
    // Keys follow the current bottom row. Only this small buffer changes
    // during a row drag; cells remain retained and use cluster transforms.
    const keyPreview = nextPreview?.type === "cluster-drag" ? nextPreview : null;
    const groupRows = annotationPanels.some((panel) => panel.markerGroups) ? scene.clusters : null;
    if (changed || annotationKeyPreview !== keyPreview || annotationGroupRows !== groupRows) {
      annotationGroupRows = groupRows;
      annotationKeyPreview = keyPreview;
      annotationKeys.clear();
      const values = [];
      for (const panel of annotationPanelsForFrame(scene, keyPreview)) {
        annotationKeys.set(panel.uid, values.length / 9);
        for (const rect of panel.rects) appendRectangle(values, rect, panel.x, 0);
      }
      annotationKeyCount = values.length / 9;
      if (annotationKeyCount) annotationKeyBuffer = bufferFor(device, annotationKeyBuffer, new Float32Array(values));
    }
  };

  const annotationDrawRanges = (nextPreview, viewport) => {
    const bounds = scene.figureBounds;
    if (!nextPreview && bounds && viewport.minX <= bounds.minX && viewport.maxX >= bounds.maxX &&
        viewport.minY <= bounds.minY && viewport.maxY >= bounds.maxY) {
      return { cells: annotationCount ? [[0, annotationCount]] : [], keys: annotationKeyCount ? [[0, annotationKeyCount]] : [] };
    }
    const cells = [], keys = [];
    for (const panel of annotationPanelsInViewport(scene, nextPreview, viewport, { labels: false })) {
      const rows = annotationRows.get(panel.uid);
      for (const row of panel.rows) {
        const offsets = rows.get(row.uid);
        cells.push([offsets[row.firstCell], offsets[row.lastCell]]);
      }
      const base = annotationKeys.get(panel.uid);
      for (const rect of panel.rects) keys.push([base + rect.keyIndex, base + rect.keyIndex + 1]);
    }
    const merge = (ranges) => {
      ranges.sort((a, b) => a[0] - b[0]);
      const result = [];
      for (const range of ranges) {
        const last = result[result.length - 1];
        if (last && last[1] >= range[0]) last[1] = Math.max(last[1], range[1]);
        else if (range[1] > range[0]) result.push(range);
      }
      return result;
    };
    return { cells: merge(cells), keys: merge(keys) };
  };

  const resizeStorageBuffer = (buffer, capacity, values) => {
    if (values.byteLength <= capacity * 4) return { buffer, capacity, resized: false };
    buffer.destroy();
    return {
      buffer: device.createBuffer({
        size: Math.max(values.byteLength, 4),
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      capacity: Math.ceil(values.byteLength / 4),
      resized: true,
    };
  };

  const uploadLinkRecords = (records) => {
    const resized = resizeStorageBuffer(linkRecordBuffer, linkRecordCapacity, records.values);
    linkRecordBuffer = resized.buffer;
    linkRecordCapacity = resized.capacity;
    if (records.values.byteLength) device.queue.writeBuffer(linkRecordBuffer, 0, records.values);
    linkRecordIndexByUid = records.indexByUid;
    clusterPreviewIndexCache = new Map();
    bindGroup = createBindGroup();
  };

  const clusterPreviewLinkIndices = (nextPreview, viewport, config) => {
    const { pairs } = clusterPreviewInViewport(scene, nextPreview, viewport);
    const cacheKey = `${config.link.threshold}:${[...pairs].sort().join("|")}`;
    const cached = clusterPreviewIndexCache.get(cacheKey);
    if (cached) return cached;
    // The scene already indexes links by cluster pair. Build the GPU list from
    // those selected pairs, rather than scanning every link and recomputing
    // its pair key whenever the dragged row crosses a snap boundary.
    const indices = [];
    for (const pair of pairs) {
      for (const uid of scene.linksByClusterPair?.get(pair) || []) {
        const link = scene.links.get(uid);
        const query = link && scene.genes.get(link.source.query.uid);
        const target = link && scene.genes.get(link.source.target.uid);
        const index = link && linkRecordIndexByUid.get(link.source.uid);
        if (
          query?.visible &&
          target?.visible &&
          link.allowed &&
          link.source.identity >= config.link.threshold &&
          index !== undefined
        ) {
          indices.push(index);
        }
      }
    }
    const values = new Uint32Array(indices);
    clusterPreviewIndexCache.set(cacheKey, values);
    return values;
  };

  const uploadPreviewLinkIndices = (values) => {
    const resized = resizeStorageBuffer(linkIndexBuffer, linkIndexCapacity, values);
    linkIndexBuffer = resized.buffer;
    linkIndexCapacity = resized.capacity;
    if (values.byteLength) device.queue.writeBuffer(linkIndexBuffer, 0, values);
    previewLinkCount = values.length;
    // Recreating a bind group per pointer frame costs more than the tiny
    // index upload. It is needed only if the backing buffer grew.
    if (resized.resized) bindGroup = createBindGroup();
  };

  const updateClusterOffsets = (nextPreview) => {
    const size = geometry?.slotCount || 1;
    if (size > clusterOffsetCapacity) {
      clusterOffsetBuffer.destroy();
      clusterOffsetBuffer = device.createBuffer({
        size: size * 8,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      clusterOffsetCapacity = size;
      clusterBaseOffsets = new Float32Array(clusterOffsetCapacity * 2);
      bindGroup = createBindGroup();
    }
    const offsets = new Float32Array(clusterOffsetCapacity * 2);
    offsets.set(clusterBaseOffsets);
    if (nextPreview?.type === "cluster-drag") {
      for (const [uid, offset] of nextPreview.clusterOffsets) {
        const slot = geometry?.clusterSlots?.get(uid);
        if (slot !== undefined) offsets[slot * 2 + 1] += offset;
      }
    }
    // Locus slots inherit their cluster's retained and transient translation.
    for (const [uid, slot] of geometry?.locusSlots || []) {
      const locus = scene?.loci.get(uid);
      const clusterSlot = geometry.clusterSlots.get(locus?.cluster.uid);
      offsets[slot * 2] = offsets[clusterSlot * 2];
      offsets[slot * 2 + 1] = offsets[clusterSlot * 2 + 1];
    }
    device.queue.writeBuffer(clusterOffsetBuffer, 0, offsets);
  };

  const updateLocusTransforms = (nextPreview) => {
    const size = geometry?.slotCount || 1;
    if (size > locusTransformCapacity) {
      locusTransformBuffer.destroy();
      locusTransformBuffer = device.createBuffer({
        size: size * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      locusTransformCapacity = size;
      bindGroup = createBindGroup();
    }
    const transforms = new Float32Array(locusTransformCapacity * 4);
    for (let slot = 0; slot < locusTransformCapacity; slot++) transforms[slot * 4 + 2] = 1;
    if (isLocusTransformPreview(nextPreview)) {
      const ids = nextPreview.type === "locus-offsets"
        ? nextPreview.locusOffsets.keys() : [nextPreview.locusUid];
      for (const uid of ids) {
        const slot = geometry.locusSlots.get(uid);
        if (slot === undefined) continue;
        const offset = locusOffsetForPreview(nextPreview, uid);
        transforms[slot * 4] = offset;
        const axis = nextPreview.axes?.get(uid);
        if (axis !== undefined) {
          const locus = scene.loci.get(uid);
          const clusterSlot = geometry.clusterSlots.get(locus.cluster.uid);
          transforms[slot * 4 + 2] = 1 - 2 * nextPreview.progress;
          transforms[slot * 4 + 3] = axis - clusterBaseOffsets[clusterSlot * 2];
        }
      }
    }
    device.queue.writeBuffer(locusTransformBuffer, 0, transforms);
  };

  const bufferForName = (name) => ({
    links: linkBuffer,
    linkEdges: linkEdgeBuffer,
    tracks: trackBuffer,
    genes: geneBuffer,
    geneEdges: geneEdgeBuffer,
  })[name];
  const write = (name, range, values) => {
    const buffer = bufferForName(name);
    if (!buffer || !range || range.length !== values.length) return;
    device.queue.writeBuffer(buffer, range.offset * 4, values.buffer, values.byteOffset, values.byteLength);
  };
  const writeAll = (data) => {
    for (const name of Object.keys(data)) {
      const buffer = bufferForName(name);
      if (buffer && data[name].byteLength) device.queue.writeBuffer(buffer, 0, data[name]);
    }
  };
  const uploadGeometry = (nextGeometry) => {
    const { data } = nextGeometry;
    linkBuffer = bufferFor(device, linkBuffer, data.links);
    linkEdgeBuffer = bufferFor(device, linkEdgeBuffer, data.linkEdges);
    trackBuffer = bufferFor(device, trackBuffer, data.tracks);
    geneBuffer = bufferFor(device, geneBuffer, data.genes);
    geneEdgeBuffer = bufferFor(device, geneEdgeBuffer, data.geneEdges);
    linkCount = data.links.length / 7;
    linkEdgeCount = data.linkEdges.length / 10;
    trackCount = data.tracks.length / 10;
    geneCount = data.genes.length / 7;
    geneEdgeCount = data.geneEdges.length / 10;
  };
  const visibleLinkIndices = () => new Uint32Array(
    [...scene.links.values()]
      .filter((link) => link.visible)
      .map((link) => linkRecordIndexByUid.get(link.source.uid))
      .filter((index) => index !== undefined)
  );
  const resetRetainedClusterGeometry = () => {
    retainedClusterGeometry = false;
    clusterBaseOffsets.fill(0);
    previewLinksActive = false;
    annotationPanels = null;
  };
  const restorePreview = (records) => {
    if (!records || !geometry) return;
    if (records.full) {
      writeAll(geometry.data);
      return;
    }
    for (const uid of records.links) {
      const ranges = geometry.ranges.links.get(uid);
      if (!ranges) continue;
      write("links", ranges.links, geometry.data.links.subarray(ranges.links.offset, ranges.links.offset + ranges.links.length));
      write("linkEdges", ranges.linkEdges, geometry.data.linkEdges.subarray(ranges.linkEdges.offset, ranges.linkEdges.offset + ranges.linkEdges.length));
    }
    for (const uid of records.genes) {
      const ranges = geometry.ranges.genes.get(uid);
      if (!ranges) continue;
      write("genes", ranges.genes, geometry.data.genes.subarray(ranges.genes.offset, ranges.genes.offset + ranges.genes.length));
      write("geneEdges", ranges.geneEdges, geometry.data.geneEdges.subarray(ranges.geneEdges.offset, ranges.geneEdges.offset + ranges.geneEdges.length));
    }
    for (const uid of records.loci) {
      const ranges = geometry.ranges.loci.get(uid);
      if (ranges) write("tracks", ranges.tracks, geometry.data.tracks.subarray(ranges.tracks.offset, ranges.tracks.offset + ranges.tracks.length));
    }
  };
  const applyPreview = (nextPreview, scales, config, viewport) => {
    // Translations and flips compose with retained cluster offsets. Trimming
    // still needs direct geometry in the current scene coordinates.
    if (retainedClusterGeometry && nextPreview?.type === "locus-trim") {
      geometry = buildGeometry(scene, scales, config);
      uploadGeometry(geometry);
      uploadLinkRecords(buildLinkRecords(scene, scales, config, geometry.locusSlots));
      resetRetainedClusterGeometry();
      updateClusterOffsets(null);
    }
    // Cluster-drag links are drawn from a temporary, viewport-limited buffer,
    // so the retained base link buffer never needs restoring or rewriting.
    if (!patchedRecords?.clusterOffsets) restorePreview(patchedRecords);
    updateClusterOffsets(nextPreview);
    updateLocusTransforms(nextPreview);
    if (isLocusTransformPreview(nextPreview)) {
      // Reuse retained polygons and shader-generated ribbons. No per-gene or
      // per-link vertices are generated/uploaded while dragging or flipping.
      if (!previewLinksActive || preview?.type === "cluster-drag" || patchedRecords) {
        uploadPreviewLinkIndices(visibleLinkIndices());
      }
      previewLinksActive = true;
      patchedRecords = null;
      return;
    }
    patchedRecords = recordsForPreview(scene, nextPreview);
    if (!patchedRecords || !geometry) {
      previewLinksActive = retainedClusterGeometry;
      if (previewLinksActive) uploadPreviewLinkIndices(visibleLinkIndices());
      return;
    }
    if (patchedRecords.clusterOffsets) {
      uploadPreviewLinkIndices(clusterPreviewLinkIndices(nextPreview, viewport, config));
      previewLinksActive = true;
      return;
    }
    previewLinksActive = false;
    if (patchedRecords.full) {
      writeAll(buildGeometry(scene, scales, config, nextPreview, geometry.clusterSlots).data);
      return;
    }
    for (const uid of patchedRecords.links) {
      const ranges = geometry.ranges.links.get(uid);
      const link = scene.links.get(uid);
      if (!ranges || !link) continue;
      const vertices = linkVertices(scene, link, scales, config, nextPreview);
      write("links", ranges.links, vertices.links);
      write("linkEdges", ranges.linkEdges, vertices.linkEdges);
    }
    for (const uid of patchedRecords.genes) {
      const ranges = geometry.ranges.genes.get(uid);
      const gene = scene.genes.get(uid);
      if (!ranges || !gene) continue;
      const vertices = geneVertices(
        gene,
        scales,
        nextPreview,
        geometry.locusSlots.get(gene.locus.source.uid),
        config.gene.shape.strokeWidth, config.gene.shape.stroke
      );
      write("genes", ranges.genes, vertices.genes);
      write("geneEdges", ranges.geneEdges, vertices.geneEdges);
    }
    for (const uid of patchedRecords.loci) {
      const ranges = geometry.ranges.loci.get(uid);
      const locus = scene.loci.get(uid);
      if (ranges && locus) {
        write(
          "tracks",
          ranges.tracks,
          trackVertices(locus, config, nextPreview, geometry.locusSlots.get(locus.source.uid))
        );
      }
    }
  };

  // Retain translated geometry; only re-upload loci whose local geometry changed.
  const adoptScene = (nextScene, sourceScene, { scales, config }) => {
    if (!geometry || scene !== sourceScene || !nextScene.changes) return false;
    const loci = [], offsets = [], affectedGenes = new Set();
    for (const uid of nextScene.changes.clusters) {
      const before = sourceScene.clusters.get(uid), after = nextScene.clusters.get(uid);
      if (!before || !after || !geometry.clusterSlots.has(uid)) return false;
      const dx = after.x - before.x, dy = after.y - before.y;
      if (dx || dy) offsets.push([uid, dx, dy]);
    }
    for (const uid of nextScene.changes.loci) {
      const before = sourceScene.loci.get(uid), locus = nextScene.loci.get(uid);
      if (!before || !locus) return false;
      if (before.localX === locus.localX && before.state.start === locus.state.start &&
          before.state.end === locus.state.end && before.state.flipped === locus.state.flipped) continue;
      loci.push(uid);
      if (!geometry.locusSlots.has(uid)) return false;
      for (const gene of locus.genes) {
        affectedGenes.add(gene.source.uid);
        // Trims normally retain hidden ranges for subsequent expansion. If
        // geometry was omitted earlier, let the ordinary render rebuild it
        // rather than silently dropping a newly revealed gene.
        if (gene.visible && !geometry.ranges.genes.has(gene.source.uid)) return false;
      }
    }
    const incidentLinks = [];
    for (const uid of affectedGenes.size ? nextScene.changes.links : []) {
      const link = nextScene.links.get(uid);
      if (link && (affectedGenes.has(link.source.query.uid) || affectedGenes.has(link.source.target.uid))) {
        incidentLinks.push(link);
      }
    }
    for (const link of incidentLinks) {
      if (!link.visible) continue;
      if (!linkRecordIndexByUid.has(link.source.uid)) return false;
      const ranges = geometry.ranges.links.get(link.source.uid);
      if (!retainedClusterGeometry && !ranges?.links.length && !ranges?.linkEdges.length) return false;
    }
    for (const [uid, dx, dy] of offsets) {
      const slot = geometry.clusterSlots.get(uid);
      clusterBaseOffsets[slot * 2] += dx;
      clusterBaseOffsets[slot * 2 + 1] += dy;
    }
    const baseFor = (uid, axis) => {
      const slot = geometry.clusterSlots.get(uid);
      return slot === undefined ? 0 : clusterBaseOffsets[slot * 2 + axis];
    };
    const commit = (name, range, values) => {
      if (!range) return;
      geometry.data[name].set(values, range.offset);
      write(name, range, values);
    };
    for (const uid of loci) {
      const locus = nextScene.loci.get(uid);
      if (!locus) continue;
      const slot = geometry.locusSlots.get(uid);
      const x = baseFor(locus.cluster.uid, 0), y = baseFor(locus.cluster.uid, 1);
      for (const gene of locus.genes) {
        const ranges = geometry.ranges.genes.get(gene.source.uid);
        const target = nextScene.genes.get(gene.source.uid);
        if (!ranges || !target) continue;
        const vertices = geneVertices(target, scales, null, slot, config.gene.shape.strokeWidth, config.gene.shape.stroke);
        commit("genes", ranges.genes, translateVertices(vertices.genes, x, y, 7));
        commit("geneEdges", ranges.geneEdges, translateVertices(vertices.geneEdges, x, y, 10));
      }
      const ranges = geometry.ranges.loci.get(uid);
      commit("tracks", ranges?.tracks, translateVertices(trackVertices(locus, config, null, geometry.locusSlots.get(uid)), x, y, 10));
    }
    // Both regular ribbons and the retained cluster-movement path must see the
    // new endpoints. Only links incident to edited loci need replacing.
    for (const link of incidentLinks) {
      const ranges = geometry.ranges.links.get(link.source.uid);
      if (ranges && !retainedClusterGeometry) {
        const vertices = linkVertices(nextScene, link, scales, config);
        commit("links", ranges.links, vertices.links);
        commit("linkEdges", ranges.linkEdges, vertices.linkEdges);
      }
      const index = linkRecordIndexByUid.get(link.source.uid);
      if (index === undefined) continue;
      const record = linkRecordForGpu(nextScene, link, scales, config, geometry.locusSlots,
        (uid) => baseFor(uid, 0), (uid) => baseFor(uid, 1));
      if (record) device.queue.writeBuffer(linkRecordBuffer, index * 16 * 4, record);
    }
    if (offsets.length) retainedClusterGeometry = true;
    scene = nextScene;
    preview = null;
    patchedRecords = null;
    clusterPreviewIndexCache = new Map();
    updateClusterOffsets(null);
    updateLocusTransforms(null);
    previewLinksActive = retainedClusterGeometry;
    if (previewLinksActive) uploadPreviewLinkIndices(visibleLinkIndices());
    return true;
  };

  return {
    render({ nextScene, preview: nextPreview = null, camera, scales, config, width, height, pixelRatio }) {
      config = figureConfig(config);
      const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
      const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
      const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
      if (resized) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      if (resized || !configured) {
        context.configure({ device, format, alphaMode: "premultiplied" });
        multisampleTexture?.destroy();
        multisampleTexture = device.createTexture({
          size: [pixelWidth, pixelHeight],
          format,
          sampleCount: multisample.count,
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        configured = true;
      }
      if (scene !== nextScene && nextScene.genes === scene?.genes && nextScene.links === scene?.links &&
          nextScene.loci === scene?.loci && nextScene.clusters === scene?.clusters) {
        // Annotation-only edits retain all biological geometry and GPU buffers.
        scene = nextScene;
      }
      if (scene !== nextScene) {
        geometry = buildGeometry(nextScene, scales, config);
        uploadGeometry(geometry);
        uploadLinkRecords(buildLinkRecords(nextScene, scales, config, geometry.locusSlots));
        resetRetainedClusterGeometry();
        scene = nextScene;
        updateClusterOffsets(null);
        updateLocusTransforms(null);
        preview = null;
        patchedRecords = null;
        previewLinksActive = false;
      }
      if (preview !== nextPreview) {
        applyPreview(nextPreview, scales, config, viewportForCamera(camera, width, height));
        preview = nextPreview;
      }
      updateAnnotations(nextPreview);
      device.queue.writeBuffer(
        uniform,
        0,
        new Float32Array([
          camera.x,
          camera.y,
          camera.k,
          annotationOffsetForPreview(scene, nextPreview),
          width,
          height,
          0,
          0,
          config.link.asLine ? 1 : 0,
          config.link.straight ? 1 : 0,
          config.link.strokeWidth,
          0,
        ])
      );
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: multisampleTexture.createView(),
          resolveTarget: context.getCurrentTexture().createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: "clear",
          storeOp: "discard",
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      if (previewLinksActive) {
        if (previewLinkCount) {
          pass.setPipeline(linkPipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(60, previewLinkCount);
        }
      } else if (linkBuffer) {
        pass.setVertexBuffer(0, linkBuffer);
        pass.draw(linkCount);
      }
      if (previewLinksActive) {
        if (previewLinkCount) {
          pass.setPipeline(linkLinePipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(132, previewLinkCount);
        }
      } else if (linkEdgeBuffer) {
        pass.setPipeline(strokePipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, linkEdgeBuffer);
        pass.draw(6, linkEdgeCount);
      }
      pass.setPipeline(strokePipeline);
      pass.setBindGroup(0, bindGroup);
      if (trackBuffer) {
        pass.setVertexBuffer(0, trackBuffer);
        pass.draw(6, trackCount);
      }
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      if (geneBuffer) {
        pass.setVertexBuffer(0, geneBuffer);
        pass.draw(geneCount);
      }
      pass.setPipeline(strokePipeline);
      pass.setBindGroup(0, bindGroup);
      if (geneEdgeBuffer) {
        pass.setVertexBuffer(0, geneEdgeBuffer);
        pass.draw(6, geneEdgeCount);
      }
      if (annotationCount || annotationKeyCount) {
        const ranges = annotationDrawRanges(nextPreview, viewportForCamera(camera, width, height));
        if (ranges.cells.length || ranges.keys.length) {
          rectanglePipeline ||= device.createRenderPipeline(rectanglePipelineDescriptor);
          pass.setPipeline(rectanglePipeline);
          pass.setBindGroup(0, bindGroup);
          if (ranges.cells.length) {
            pass.setVertexBuffer(0, annotationBuffer);
            for (const [first, end] of ranges.cells) pass.draw(6, end - first, 0, first);
          }
          if (ranges.keys.length) {
            pass.setVertexBuffer(0, annotationKeyBuffer);
            for (const [first, end] of ranges.keys) pass.draw(6, end - first, 0, first);
          }
        }
      }
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    adoptScene,
    destroy() {
      multisampleTexture?.destroy();
      linkBuffer?.destroy();
      linkEdgeBuffer?.destroy();
      linkRecordBuffer.destroy();
      linkIndexBuffer.destroy();
      trackBuffer?.destroy();
      geneBuffer?.destroy();
      geneEdgeBuffer?.destroy();
      annotationBuffer?.destroy();
      annotationKeyBuffer?.destroy();
      clusterOffsetBuffer.destroy();
      locusTransformBuffer.destroy();
      uniform.destroy();
      device.destroy();
    },
  };
}

// Owns the lifetime of a WebGPU context, not chart state or interaction
// policy. The chart controller supplies the current scene and the Canvas
// fallback for each paint request.
function createWebGpuBackend({ createRenderer = createWebGpuRenderer } = {}) {
  let renderer = null;
  let canvas = null;
  let initialization = null;
  let unavailable = false;
  let pendingScene = null;
  let latestPaint = null;
  let generation = 0;

  const draw = () => {
    if (!renderer || !latestPaint) return;
    const {
      camera,
      config,
      height,
      pixelRatio,
      preview,
      scales,
      width,
    } = latestPaint;
    renderer.render({
      nextScene: pendingScene,
      preview,
      camera,
      scales,
      config,
      width,
      height,
      pixelRatio,
    });
  };

  const fallback = () => latestPaint?.onUnavailable?.();

  return {
    get pendingScene() {
      return pendingScene;
    },
    get renderer() {
      return renderer;
    },
    hasResources: () => Boolean(renderer || canvas || initialization || unavailable),
    setScene: (scene) => {
      pendingScene = scene;
    },
    paint: (request) => {
      const targetCanvas = request.canvas;
      if (!targetCanvas || !request.scene) return;
      pendingScene = request.scene;
      latestPaint = request;
      if (unavailable) {
        fallback();
        return;
      }
      if (renderer && canvas === targetCanvas) {
        draw();
        return;
      }
      if (canvas && canvas !== targetCanvas) {
        // A redraw can replace the DOM canvas while adapter setup is still in
        // flight. Invalidate that setup before allowing the new canvas to
        // acquire a WebGPU context.
        generation += 1;
        renderer?.destroy();
        renderer = null;
        canvas = null;
        initialization = null;
        unavailable = false;
      }
      if (initialization) return;

      canvas = targetCanvas;
      const currentGeneration = ++generation;
      initialization = createRenderer(targetCanvas)
        .then((nextRenderer) => {
          if (currentGeneration !== generation || canvas !== targetCanvas) {
            nextRenderer?.destroy();
            return;
          }
          renderer = nextRenderer;
          initialization = null;
          if (renderer) {
            targetCanvas.dataset.webgpu = "active";
            draw();
            return;
          }
          unavailable = true;
          targetCanvas.dataset.webgpu = "unavailable";
          fallback();
        })
        .catch((error) => {
          if (currentGeneration !== generation || canvas !== targetCanvas) return;
          initialization = null;
          unavailable = true;
          targetCanvas.dataset.webgpu = "error";
          console.warn("WebGPU renderer unavailable; falling back to Canvas 2D.", error);
          fallback();
        });
    },
    adoptScene: (...args) => renderer?.adoptScene(...args) || false,
    destroy: () => {
      generation += 1;
      renderer?.destroy();
      renderer = null;
      canvas = null;
      initialization = null;
      unavailable = false;
      pendingScene = null;
      latestPaint = null;
    },
  };
}

// Owns the persistent DOM surrounding retained raster renderers. Painting,

function ensureRasterSurface({
  container,
  data,
  renderer,
  showRaster,
  showWebGpu,
  showMinimap,
  minimap,
  zoom,
  zoomExtent,
  onZoom,
  onZoomStart,
  onZoomEnd,
}) {
  let currentZoom = zoom;
  // A canvas cannot switch between 2D and WebGPU contexts in place.
  container
    .selectAll("canvas.clusterMapCanvas")
    .filter(function () {
      return this.dataset.renderer && this.dataset.renderer !== renderer;
    })
    .remove();

  const canvas = container
    .selectAll("canvas.clusterMapCanvas")
    .data(showRaster ? [data] : [])
    .join((enter) => {
      const surface = enter
        .append("canvas")
        .attr("class", "clusterMapCanvas")
        .attr("cursor", "grab")
        .attr("tabindex", 0)
        .attr("aria-label", "Cluster map")
        .style("display", "block")
        .style("width", "100%")
        .style("height", "100%")
        .style("outline", "none");
      currentZoom = bindCameraZoom({
        surface,
        zoomExtent,
        onZoom,
        onStart: function () { onZoomStart(this); },
        onEnd: function () { onZoomEnd(this); },
      });
      return surface;
    })
    .attr("data-renderer", renderer);

  if (showWebGpu) {
    canvas.attr("data-webgpu", function () { return this.dataset.webgpu || "initializing"; });
  } else {
    canvas.attr("data-webgpu", null);
  }
  updateCameraZoom(currentZoom, zoomExtent);

  if ((showWebGpu || showMinimap) && globalThis.getComputedStyle(container.node()).position === "static") {
    container.style("position", "relative");
  }
  const webgpuOverlay = container
    .selectAll("canvas.clusterMapWebGpuOverlay")
    .data(showWebGpu ? [data] : [])
    .join((enter) =>
      enter
        .append("canvas")
        .attr("class", "clusterMapWebGpuOverlay")
        .style("position", "absolute")
        .style("inset", "0")
        .style("display", "block")
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "none")
    );
  const overview = container
    .selectAll("canvas.clusterMapMinimap")
    .data(showMinimap ? [data] : [])
    .join((enter) =>
      enter
        .append("canvas")
        .attr("class", "clusterMapMinimap")
        .attr("aria-label", "Cluster map overview")
        .style("position", "absolute")
        .style("z-index", 2)
        .style("display", "block")
        .style("box-sizing", "border-box")
        .style("background", "white")
        .style("box-shadow", "0 1px 4px rgba(0, 0, 0, 0.25)")
        .style("cursor", "grab")
        .style("touch-action", "none")
    );
  overview
    .style("width", showMinimap ? `${minimap.width}px` : null)
    .style("height", showMinimap ? `${minimap.height}px` : null)
    .style("right", showMinimap ? `${minimap.margin}px` : null)
    // The editor is a bottom overlay. Keep navigation independently reachable
    // by anchoring the overview at the chart's top-right corner instead.
    .style("top", showMinimap ? `${minimap.margin}px` : null)
    .style("bottom", null);

  return { canvas, webgpuOverlay, minimap: overview, zoom: currentZoom };
}

// Raster hit testing returns stable scene IDs, while SVG joins already carry
// source records. Adapt IDs at this boundary so controller actions themselves
// retain one record-based contract across renderers.
function createRasterInteractionBindings({
  interactions,
  getGene,
  getLocus,
}) {
  return {
    interactions: {
      beginClusterDrag: interactions.beginClusterDrag,
      moveClusterDrag: interactions.moveClusterDrag,
      endClusterDrag: interactions.endClusterDrag,
      cancelClusterDrag: interactions.cancelClusterDrag,
      beginLocusDrag: interactions.beginLocusDrag,
      moveLocusDrag: interactions.moveLocusDrag,
      endLocusDrag: interactions.endLocusDrag,
      cancelLocusDrag: interactions.cancelLocusDrag,
      beginLocusTrim: interactions.beginLocusTrim,
      moveLocusTrim: (locusUid, edge, x) =>
        interactions.moveLocusTrim(getLocus(locusUid), edge, x),
      endLocusTrim: (locusUid) => interactions.endLocusTrim(getLocus(locusUid)),
      cancelLocusTrim: interactions.cancelLocusTrim,
    },
    actions: {
      geneClick: (event, geneUid) => interactions.onGeneClick?.(event, getGene(geneUid)),
      rotateTreeNode: (nodeUid) => interactions.rotateTreeNode?.(nodeUid),
      treeMenu: interactions.showTreeMenu,
      legendColour: interactions.legendColour,
      legendText: interactions.legendText,
      scaleBar: interactions.setScaleBarLength,
      flipLocus: (locusUid) => interactions.flipLocus(getLocus(locusUid)),
      toggleLocusSelection: (locusUid, options) =>
        interactions.toggleLocusSelection(getLocus(locusUid), options),
      geneMenu: (event, geneUid) => interactions.showGeneMenu(event, getGene(geneUid)),
      legendMenu: interactions.legendMenu,
    },
  };
}

const finiteNumber = (value) => Number.isFinite(value) ? value : null;
const stateEntries = (value) => Array.isArray(value)
  ? value.filter((entry) => Array.isArray(entry) && entry.length === 2 && entry[0] !== undefined)
  : [];
const recordStateEntries = (value) => stateEntries(value)
  .filter(([, entry]) => entry && typeof entry === "object" && !Array.isArray(entry));

function numericEntries(entries) {
  return [...entries].filter(([, value]) => finiteNumber(value) !== null);
}

function locusSnapshot(state) {
  return {
    start: state.start,
    end: state.end,
    flipped: Boolean(state.flipped),
    trimLeft: state.trimLeft?.uid ?? null,
    trimRight: state.trimRight?.uid ?? null,
  };
}

function geneSnapshot(state) {
  return { start: state.start, end: state.end, strand: state.strand };
}

function createSnapshotBaseline(data) {
  const genes = new Map();
  const loci = new Map();
  const clusterOrder = [];
  for (const cluster of data.clusters) {
    clusterOrder.push(cluster.uid);
    for (const locus of cluster.loci) {
      loci.set(locus.uid, { start: locus.start, end: locus.end });
      const locusBio = locus.bio || locus;
      for (const gene of locus.genes) {
        const geneBio = gene.bio || gene;
        genes.set(`${locus.uid}:${gene.uid}`, {
          start: geneBio.start - locusBio.start,
          end: geneBio.end - locusBio.start,
          strand: geneBio.strand,
        });
      }
    }
  }
  return { genes, loci, clusterOrder };
}

function sameState(left, right) {
  return left && right && left.start === right.start && left.end === right.end && left.strand === right.strand;
}

function changedLocusEntries(state, loci) {
  return [...state.loci]
    .filter(([uid, value]) => {
      const locus = loci.get(uid);
      return locus && (
        value.start !== locus.start ||
        value.end !== locus.end ||
        value.flipped ||
        value.trimLeft ||
        value.trimRight
      );
    })
    .map(([uid, value]) => [uid, locusSnapshot(value)]);
}

function snapshotFromBaseline(state, data, baseline) {
  const defaultOrder = baseline.clusterOrder;
  const genes = [];
  for (const [uid, value] of state.genes) {
    if (!sameState(value, baseline.genes.get(uid))) genes.push([uid, geneSnapshot(value)]);
  }
  return {
    version: 1,
    // Tree child order changes with edits. Keep its leaf order explicit so an
    // undo snapshot can restore it even if it matched source cluster order.
    clusterOrder: !data.tree && state.clusterOrder.length === defaultOrder.length && state.clusterOrder.every((uid, index) => uid === defaultOrder[index])
      ? []
      : [...state.clusterOrder],
    clusterOffsets: numericEntries(state.clusterOffsets).filter(([, value]) => value !== 0),
    locusOffsets: numericEntries(state.locusOffsets).filter(([, value]) => value !== 0),
    loci: changedLocusEntries(state, baseline.loci),
    genes,
    camera: { ...state.camera },
  };
}

/**
 * One baseline per chart, shared by history, state reads, and project exports.
 * reset(data) rebuilds eagerly, including for in-place source edits; reset()
 * releases the cache. Geometry/state-only edits do not invalidate the baseline.
 * Returned snapshots own their values and never retain the baseline Maps.
 */
function createChartStateSerializer() {
  let source = null;
  let baseline = null;
  function reset(data = null) {
    source = data;
    baseline = data ? createSnapshotBaseline(data) : null;
  }
  return {
    reset,
    serialize(state, data) {
      if (source !== data || !baseline) reset(data);
      return snapshotFromBaseline(state, data, baseline);
    },
  };
}

function boundaryGene(value, genes) {
  // Early project exports stored the whole gene record. Accept those files as
  // well as the current compact UID form.
  const uid = value && typeof value === "object" ? value.uid : value;
  return genes.get(uid) || null;
}

/** Restore a durable chart snapshot, ignoring records absent from this data. */
function chartStateFromSnapshot(data, snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("Chart state must be an object.");
  }
  const clusterIds = new Set(data.clusters.map((cluster) => cluster.uid));
  const loci = data.clusters.flatMap((cluster) => cluster.loci);
  const locusIds = new Set(loci.map((locus) => locus.uid));
  const genesByLocus = new Map(loci.map((locus) => [
    locus.uid,
    new Map(locus.genes.map((gene) => [gene.uid, gene])),
  ]));
  const geneKeys = new Set(loci.flatMap((locus) => locus.genes.map((gene) => `${locus.uid}:${gene.uid}`)));
  const restored = createChartState(data);
  const applyOffsets = (entries, allowed, target) => stateEntries(entries).forEach(([uid, value]) => {
    if (allowed.has(uid) && finiteNumber(value) !== null) target.set(uid, value);
  });
  applyOffsets(snapshot.clusterOffsets, clusterIds, restored.clusterOffsets);
  applyOffsets(snapshot.locusOffsets, locusIds, restored.locusOffsets);
  recordStateEntries(snapshot.loci).forEach(([uid, value]) => {
    if (!locusIds.has(uid)) return;
    const target = restored.loci.get(uid);
    ["start", "end"].forEach((key) => {
      if (finiteNumber(value[key]) !== null) target[key] = value[key];
    });
    target.trimLeft = boundaryGene(value.trimLeft, genesByLocus.get(uid));
    target.trimRight = boundaryGene(value.trimRight, genesByLocus.get(uid));
    if (value.flipped !== undefined) target.flipped = Boolean(value.flipped);
  });
  recordStateEntries(snapshot.genes).forEach(([key, value]) => {
    if (!geneKeys.has(key)) return;
    const target = restored.genes.get(key);
    ["start", "end", "strand"].forEach((property) => {
      if (finiteNumber(value[property]) !== null) target[property] = value[property];
    });
  });
  const camera = snapshot.camera || {};
  if (Array.isArray(snapshot.clusterOrder)) {
    const order = snapshot.clusterOrder.filter((uid) => clusterIds.has(uid));
    restored.clusterOrder = [...new Set([...order, ...restored.clusterOrder])];
    setTreeClusterOrder(data.tree, restored.clusterOrder);
  }
  if (finiteNumber(camera.x) !== null && finiteNumber(camera.y) !== null && finiteNumber(camera.k) !== null && camera.k > 0) {
    restored.camera = { x: camera.x, y: camera.y, k: camera.k };
  }
  return restored;
}

/** Return every locus in the inclusive displayed-cluster range. */
function lociForClusterRange(clusterOrder, clusterById, startClusterUid, endClusterUid) {
  const start = clusterOrder.indexOf(startClusterUid);
  const end = clusterOrder.indexOf(endClusterUid);
  if (start < 0 || end < 0) return [];
  return clusterOrder
    .slice(Math.min(start, end), Math.max(start, end) + 1)
    .flatMap((clusterUid) => clusterById.get(clusterUid)?.loci || [])
    .map((locus) => locus.uid);
}

let nextChartInstance = 0;
const projectFormat = "clinker-project";
const projectVersion = 1;
const historyLimit = 100;
const isPlainObject = (value) => Boolean(value) && value.constructor === Object;
const copyConfigPatch = (value) => {
  if (Array.isArray(value)) return value.map(copyConfigPatch);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyConfigPatch(child)]));
  // Configuration callbacks are valid leaves. They are immutable by reference
  // and intentionally remain callable when an edit is undone or redone.
  return value;
};
const previousConfigPatch = (config, patch) => Object.fromEntries(
  Object.entries(patch || {})
    .filter(([key]) => Object.hasOwn(config || {}, key))
    .map(([key, value]) => [key,
      isPlainObject(value) && isPlainObject(config[key])
        ? previousConfigPatch(config[key], value)
        : copyConfigPatch(config[key]),
    ])
);
const serializableConfig = (value) => {
  if (typeof value === "function" || value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(serializableConfig);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value)
    .map(([key, child]) => [key, serializableConfig(child)])
    .filter(([, child]) => child !== undefined));
  return value;
};

function clusterMap() {
  /* A ClusterMap plot. */

  let container = null;
  const figureSurface = createFigureSurface();
  function updateFigureSurface() {
    if (container) figureSurface.update(container, runtime.getScene(), runtime.renderConfig,
      currentData?.tree, getCamera(chartState), scenePreview);
  }
  let annotationOverlay = null;
  let themeMedia = null;
  function systemThemeChanged() {
    if (runtime.config.plot.theme !== "auto" || !container || !currentData) return;
    applyTheme(container.node(), resolveTheme(runtime.config.plot.theme));
    emitChange({ type: "theme.change", theme: resolveTheme(runtime.config.plot.theme).mode });
  }
  let annotationUiContext = null, annotationUiLoad = null;
  let zoom = null;
  let canvasZoom = null;
  let hasInitialView = false;
  let chartState = null;
  let canvasHoverLocusUid = null;
  let canvasScene = null;
  let canvasAnimation = null;
  let treeAnimation = null;
  let webgpuAnimation = null;
  let scenePreview = null;
  let previewPaintFrame = null;
  let cancelCanvasFlip = null;
  let canvasPendingFlip = null;
  let cancelSceneFlip = null;
  let clusterCommitFrame = null;
  let sceneCommit = null;
  let rasterCanvas = null, overlayCanvas = null, minimapCanvas = null;
  let minimapScene = null, minimapMeasurement = null;
  let currentData = null;
  let figureMeasurementContext = null;
  let chartIndex = null;
  let highlightGeneIds = new Set();
  let highlightLinkIds = new Set();
  let selectedLocusIds = new Set();
  let locusSelectionAnchorUid = null;
  let disposeRasterInteraction = () => {};
  let rasterHitSurface = null;
  let retainedOverlay = null;
  let updatingTreeMenu = false;
  function updateFromTreeMenu(action) {
    const previous = updatingTreeMenu;
    updatingTreeMenu = true;
    try { return action(); }
    finally { updatingTreeMenu = previous; }
  }
  const changeListeners = new Set();
  const history = [];
  const future = [];
  const stateSnapshots = createChartStateSerializer();
  let pendingInteractionState = null;
  const runtime = createChartRuntime({ idPrefix: `chart-${nextChartInstance++}-`,
    measureText: (text, { fontSize, fontFamily, fontWeight = 400 }) => {
      if (!container) return null;
      figureMeasurementContext ||= container.node().ownerDocument.createElement("canvas").getContext("2d");
      const context = figureMeasurementContext;
      context.save();
      context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      context.textAlign = "left"; context.textBaseline = "alphabetic";
      const metrics = context.measureText(text);
      context.restore();
      return metrics;
    },
  });
  const canvasBackend = createCanvasBackend();
  const svgBackend = createRetainedSceneBackend({
    render: renderSvg,
    surface: "plot",
  });
  const webgpuBackend = createWebGpuBackend();
  const rasterMinimap = createRasterMinimap();
  const rasterMotion = createRasterMotion({
    schedulePaint: () => scheduleScenePaint(),
    getCamera: () => getCamera(chartState),
    getRenderer: () => runtime.config.plot.renderer,
    getAdaptiveResolution: () => runtime.config.plot.adaptiveResolution,
  });
  runtime.setBeforeGeneAnchorUpdate(({ changes, flippedLoci }) => {
    const sourceScene = runtime.getScene();
    // Anchoring changes cluster origins and, when strands disagree, a small
    // set of loci. The scene patch retains everything else for every backend.
    if (!sourceScene || (!changes.length && !flippedLoci.size)) return;
    sceneCommit = {
      sourceScene,
      changes: { loci: [...flippedLoci], clusters: changes.map(({ clusterUid }) => clusterUid) },
    };
  });
  const anchorGene = (gene, { flipMismatchedLoci = false } = {}) => {
    beginInteractionState();
    const result = runtime.anchorGene(gene, { flipMismatchedLoci });
    redraw();
    commitInteractionState();
    return result;
  };
  const interactionController = createInteractionController({
    clusterRows: () => runtime.scales.y.range(),
    getClusterOrder: () => getClusterOrder(chartState),
    getClusterPosition: (uid) => runtime.getScene().clusters.get(uid).y,
    getTree: () => currentData?.tree || null,
    getLocusOffset: (uid) => getLocusOffset(chartState, uid),
    selectedLocusIds: () => [...selectedLocusIds],
    selectedClusterIds: () => new Set(
      [...selectedLocusIds]
        .map(locusForId)
        .filter(Boolean)
        .map((locus) => locus.clusterUid)
    ),
    setDragging: (dragging) => {
      if (dragging) beginInteractionState();
      setDragging(chartState, dragging);
    },
    previewClusterDrag: (uid, position, order, positions = new Map([[uid, position]])) => {
      if (clusterCommitFrame !== null) {
        cancelAnimationFrame(clusterCommitFrame);
        clusterCommitFrame = null;
      }
      for (const [clusterUid, clusterPosition] of positions) {
        setPreviewClusterPosition(chartState, clusterUid, clusterPosition);
      }
      if (order) setPreviewClusterOrder(chartState, order);
      if (runtime.getScene()) {
        scenePreview = createClusterDragPreview(runtime.getScene(), {
          clusterUid: uid,
          position,
          positions,
          order: getClusterOrder(chartState),
          rows: runtime.scales.y.range(),
        });
        scheduleScenePaint();
        return;
      }
      redraw({ animate: false });
    },
    commitClusterOrder: () => {
      const sourceScene = runtime.getScene();
      const preview = scenePreview?.type === "cluster-drag" ? scenePreview : null;
      const order = [...getClusterOrder(chartState)];
      const rows = runtime.scales.y.range();
      if (sourceScene) sceneCommit = { sourceScene, changes: {} };
      commitPreviewClusterOrder(chartState);
      setTreeClusterOrder(currentData.tree, order);
      if (
        preview &&
        sourceScene &&
        isRasterRenderer(runtime.config.plot.renderer)
      ) {
        // Paint the destination row once before the committed projection runs.
        // This avoids a release-time blank/stale frame while a large chart is
        // rebuilding its authoritative scene and indexes.
        scenePreview = createClusterDragPreview(sourceScene, {
          clusterUid: preview.clusterUid,
          position: rows[order.indexOf(preview.clusterUid)],
          order,
          rows,
        });
        scheduleScenePaint();
        if (clusterCommitFrame !== null) cancelAnimationFrame(clusterCommitFrame);
        clusterCommitFrame = requestAnimationFrame(() => {
          clusterCommitFrame = requestAnimationFrame(() => {
            clusterCommitFrame = null;
            clearScenePreview();
            redraw({ animate: false });
          });
        });
        commitInteractionState();
        return;
      }
      clearScenePreview();
      redraw({ animate: false });
      commitInteractionState();
    },
    previewLocusOffset: (uid, offset) => {
      setPreviewLocusOffset(chartState, uid, offset);
      if (runtime.getScene()) {
        scenePreview = createLocusOffsetPreview(runtime.getScene(), uid, offset, {
          alignLabels: runtime.config.cluster.alignLabels,
        });
        scheduleScenePaint();
        return;
      }
      redraw({ animate: false });
    },
    previewLocusOffsets: (offsets) => {
      for (const [uid, offset] of offsets) setPreviewLocusOffset(chartState, uid, offset);
      if (runtime.getScene()) {
        scenePreview = createLocusOffsetsPreview(runtime.getScene(), offsets, {
          alignLabels: runtime.config.cluster.alignLabels,
        });
        scheduleScenePaint();
        return;
      }
      redraw({ animate: false });
    },
    commitLocusOffset: (ids) => {
      const loci = Array.isArray(ids) ? ids : [ids];
      commitLocusEdit(loci, () => {
        for (const uid of loci) commitPreviewLocusOffset(chartState, uid);
      });
    },
    previewLocusTrim: (locus, edge, position) => {
      const result = previewLocusTrim(chartState, locus, {
        edge,
        position,
        // Pointer positions are in chart-world space. Gene-state boundaries
        // are locus-local, so project them through the locus and cluster
        // translations as well; otherwise trimming drifts after anchoring or
        // dragging a locus horizontally.
        coordinateFor: (coordinate) =>
          runtime.scales.x(coordinate) +
          runtime.scales.locus(locus.uid) +
          runtime.scales.offset(locus.clusterUid),
        scaleGenes: runtime.config.plot.scaleGenes,
      });
      if (runtime.getScene()) {
        // Updating scales is inexpensive and gives the sparse projection the
        // packed x offsets for this temporary locus state. Deliberately avoid
        // rebuilding data, indexes, or the complete scene until release.
        runtime.updateScales(currentData, { geometryOnly: true });
        scenePreview = createLocusTrimPreview(runtime.getScene(), locus.uid, result.state, {
          localXFor: runtime.scales.locus,
          scaleX: runtime.scales.x,
          alignLabels: runtime.config.cluster.alignLabels,
          shape: runtime.config.gene.shape,
          trimIndicatorStyle: runtime.config.locus.trimIndicators,
          clusterLabelText: runtime.locusTextForCluster(locus.clusterUid),
        });
        scheduleScenePaint();
        return result;
      }
      redraw({ animate: false, synchronize: false });
      return result;
    },
    commitLocusTrim: (locus) => {
      commitLocusEdit([locus.uid], () => {
        finalizeLocusTrim(chartState, locus);
        commitPreviewLocusState(chartState, locus);
      });
    },
    cancelInteraction: () => { pendingInteractionState = null; },
    flipLocus: (locus) => {
      // Do not mutate the retained source underneath an in-flight flip.
      if (cancelSceneFlip !== null) return;
      beginInteractionState();
      flipLocus(chartState, locus);
      if (isCanvasRenderer(runtime.config.plot.renderer) && runtime.getScene()) {
        stopCanvasAnimation();
        cancelCanvasFlip?.();
        const previewProgress = 0.12;
        const sourceScene = canvasScene || runtime.getScene();
        const pending = { locus, sourceScene, targetScene: null,
          clusterLabelText: runtime.locusTextForCluster(locus.clusterUid) };
        canvasPendingFlip = pending;
        scenePreview = createLocusFlipPreview(sourceScene, locus.uid, {
          progress: previewProgress,
          clusterLabelText: pending.clusterLabelText,
        });
        scheduleScenePaint();
        // Show the retained preview before preparing cached flip layers.
        cancelCanvasFlip = afterPaint(() => startCanvasFlip(pending, previewProgress));
        return;
      }
      if (runtime.getScene()) {
        const useGpu = isWebGpuRenderer(runtime.config.plot.renderer);
        const sourceScene = runtime.getScene();
        const duration = runtime.config.plot.transitionDuration;
        const finish = () => {
          runtime.synchronizeLocusLayoutState(locus);
          const targetScene = runtime.patchScene(sourceScene, { loci: [locus.uid] }, currentData);
          if (useGpu) {
            webgpuBackend.adoptScene(targetScene, sourceScene, {
              scales: runtime.scales, config: runtime.renderConfig,
            });
            webgpuBackend.setScene(targetScene);
          } else svgBackend.setScene(targetScene);
          scenePreview = null;
          cancelSceneFlip = null;
          scheduleScenePaint();
          commitInteractionState();
        };
        if (!duration) {
          finish();
          return;
        }
        cancelSceneFlip = animate(duration, (progress) => {
          scenePreview = createLocusFlipPreview(sourceScene, locus.uid, {
            progress,
            clusterLabelText: runtime.locusTextForCluster(locus.clusterUid),
          });
          if (useGpu) webgpuBackend.setScene(sourceScene);
          else svgBackend.setScene(sourceScene);
          scheduleScenePaint();
        }, finish);
        return;
      }
      redraw();
      commitInteractionState();
    },
  });

  function commitLocusEdit(loci, updateState) {
    const sourceScene = runtime.getScene();
    if (sourceScene) sceneCommit = { sourceScene, changes: { loci } };
    updateState();
    clearScenePreview();
    redraw({ animate: false });
    commitInteractionState();
  }

  function clearScenePreview() {
    if (previewPaintFrame !== null) cancelAnimationFrame(previewPaintFrame);
    cancelCanvasFlip?.();
    cancelSceneFlip?.();
    if (clusterCommitFrame !== null) cancelAnimationFrame(clusterCommitFrame);
    scenePreview = null;
    canvasBackend.clearFlip();
    previewPaintFrame = null;
    cancelCanvasFlip = null;
    canvasPendingFlip = null;
    cancelSceneFlip = null;
    clusterCommitFrame = null;
  }

  function flushCanvasFlip() {
    const pending = canvasPendingFlip;
    if (!pending) return;
    cancelCanvasFlip?.();
    cancelCanvasFlip = null;
    if (!pending.targetScene) {
      runtime.synchronizeLocusLayoutState(pending.locus);
      pending.targetScene = runtime.patchScene(pending.sourceScene, { loci: [pending.locus.uid] }, currentData);
      commitInteractionState();
    }
    canvasScene = pending.targetScene;
    canvasBackend.setScene(canvasScene);
    scenePreview = null;
    canvasPendingFlip = null;
    canvasBackend.clearFlip();
  }

  function startCanvasFlip(pending, initialProgress) {
    if (canvasPendingFlip !== pending) return;
    cancelCanvasFlip = null;
    runtime.synchronizeLocusLayoutState(pending.locus);
    pending.targetScene = runtime.patchScene(pending.sourceScene, { loci: [pending.locus.uid] }, currentData);
    commitInteractionState();
    canvasBackend.prepareFlip(pending.locus.uid, pending.sourceScene);
    // Restore and repaint the affected canvas region before the browser can
    // present a frame. The base image stays offscreen; the visible plot stays
    // a single canvas throughout the animation.
    paintScene();
    const finish = () => {
      cancelCanvasFlip = null;
      scenePreview = null;
      canvasPendingFlip = null;
      canvasScene = pending.targetScene;
      canvasBackend.setScene(canvasScene);
      paintScene();
      canvasBackend.clearFlip();
      scheduleScenePaint();
      scheduleMinimapBase(canvasScene);
    };
    const duration = runtime.config.plot.transitionDuration;
    if (!duration) { finish(); return; }
    cancelCanvasFlip = animate(duration, (progress) => {
      if (canvasPendingFlip !== pending) return;
      scenePreview = createLocusFlipPreview(pending.sourceScene, pending.locus.uid, {
        progress: initialProgress + (1 - initialProgress) * progress,
        clusterLabelText: pending.clusterLabelText,
      });
      // Paint the dirty region in this frame rather than one frame later.
      if (previewPaintFrame !== null) cancelAnimationFrame(previewPaintFrame);
      previewPaintFrame = null;
      paintScene();
    }, finish);
  }

  function scheduleScenePaint() {
    if (previewPaintFrame !== null || !container || !runtime.getScene()) return;
    previewPaintFrame = requestAnimationFrame(() => {
      previewPaintFrame = null;
      paintScene();
    });
  }

  function zoomExtent() {
    const minimum = Math.max(0, Number(runtime.config.plot.minZoom) || 0);
    const configuredMaximum = Number(runtime.config.plot.maxZoom);
    const maximum = Math.max(minimum, Number.isFinite(configuredMaximum) ? configuredMaximum : 8);
    return [minimum, maximum];
  }

  function constrainZoom(scale) {
    const [minimum, maximum] = zoomExtent();
    return Math.max(minimum, Math.min(maximum, scale));
  }

  function stopWebGpuAnimation() {
    webgpuAnimation?.cancel();
    webgpuAnimation = null;
  }

  function my(selection, options) {
    selection.each(function (data) {
      container = select(this).attr("width", "100%").attr("height", "100%");
      loadData(data);
      redraw(options);
    });
  }

  function loadData(data) {
    sceneCommit = null;
    stateSnapshots.reset();
    const prepared = normalizeChartData(data, runtime.config.tree);
    cancelTreePresentationPreview();
    currentData = prepared;
    chartIndex = createChartIndex(currentData);
    refreshGroups();
    selectedLocusIds = new Set(
      [...selectedLocusIds].map(locusForId).filter(Boolean).map((locus) => locus.uid)
    );
    chartState = createChartState(currentData, chartState);
    runtime.setChartIndex(chartIndex);
    runtime.setChartState(chartState);
    stateSnapshots.reset(currentData);
  }

  function groupsAreAutomatic(data = currentData) {
    return data?.config?.updateGroups !== false;
  }

  function refreshGroups(derive = groupsAreAutomatic()) {
    if (derive) {
      // Deleted genes retain their link records; exclude dangling endpoints.
      const links = currentData.links.filter((link) =>
        chartIndex.geneById.has(link.query.uid) && chartIndex.geneById.has(link.target.uid)
      );
      currentData.groups = createLinkGroups(links, currentData.groups);
    } else currentData.groups ??= [];
    chartIndex.groupById = new Map(currentData.groups.map((group) => [group.uid, group]));
  }

  function emitChange(change) {
    for (const listener of changeListeners) listener({ ...change, data: currentData });
  }

  function historyStatus() {
    return { canUndo: history.length > 0, canRedo: future.length > 0 };
  }

  function emitHistoryChange() {
    emitChange({ type: "history.change", ...historyStatus() });
  }

  function clearHistory(emit = true) {
    history.length = 0;
    future.length = 0;
    pendingInteractionState = null;
    if (emit) emitHistoryChange();
  }

  function remember(change) {
    history.push(change);
    if (history.length > historyLimit) history.splice(0, history.length - historyLimit);
    future.length = 0;
    emitHistoryChange();
  }

  // Pointer interactions update transient preview state continuously, but are
  // one logical edit when released. Keep the compact, exportable state before
  // the gesture and compare it after the committed layout has synchronized.
  function beginInteractionState() {
    if (!pendingInteractionState && chartState && currentData) {
      pendingInteractionState = stateSnapshots.serialize(chartState, currentData);
    }
  }

  function commitInteractionState() {
    const before = pendingInteractionState;
    pendingInteractionState = null;
    if (!before || !chartState || !currentData) return;
    const after = stateSnapshots.serialize(chartState, currentData);
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    emitChange({ type: "state.change", state: after });
    remember({ kind: "state", undo: before, redo: after });
  }

  function refreshAfterPatch(effects, { refreshAutomatic = false } = {}) {
    if (effects.reindex === "data") chartIndex = createChartIndex(currentData);
    if (effects.reindex || refreshAutomatic) {
      refreshGroups(groupsAreAutomatic() && (effects.reindex === "data" || refreshAutomatic));
      runtime.setChartIndex(chartIndex);
    }
    if (effects.rebuildState) {
      chartState = createChartState(currentData, chartState);
      runtime.setChartState(chartState);
    }
    stateSnapshots.reset(currentData);
  }

  function applyPatch(operations, { record = true, automaticGroups } = {}) {
    const sourceScene = runtime.getScene();
    const annotationsOnly = Array.isArray(operations) && operations.every(isAnnotationOperation);
    sceneCommit = null;
    // Source edits may mutate currentData in place. Identity alone cannot
    // invalidate the cached biological defaults, including on undo/redo.
    if (!annotationsOnly) stateSnapshots.reset();
    const groupsAutomaticBefore = groupsAreAutomatic();
    const result = applyChartOperations(currentData, chartIndex, operations, runtime.config.tree);
    const restoringAutomatic = automaticGroups !== undefined && automaticGroups !== groupsAreAutomatic();
    if (restoringAutomatic) {
      currentData.config = { ...(currentData.config || {}), updateGroups: automaticGroups };
    }
    const groupsAutomaticAfter = groupsAreAutomatic();
    if (!annotationsOnly || restoringAutomatic) refreshAfterPatch(result.effects, {
      refreshAutomatic: groupsAutomaticAfter && (restoringAutomatic || !groupsAutomaticBefore),
    });
    if (sourceScene && !restoringAutomatic && annotationsOnly) {
      sceneCommit = { sourceScene, changes: { annotationsOnly: true } };
    }
    redraw({ animate: false });
    emitChange({ type: "data.apply", operations: result.operations });
    if (record) {
      remember({
        kind: "patch",
        undo: result.inverse,
        redo: result.operations,
        groupsAutomaticBefore,
        groupsAutomaticAfter,
      });
    }
    return result;
  }

  let treePresentationPreview = null;
  function cancelTreePresentationPreview() {
    if (!treePresentationPreview) return false;
    if (currentData?.tree === treePresentationPreview.tree) applyTreeOperation(currentData.tree, treePresentationPreview.undo);
    treePresentationPreview = null;
    return true;
  }

  function setState(snapshot, { record = true } = {}) {
    sceneCommit = null;
    pendingInteractionState = null;
    const before = chartState ? stateSnapshots.serialize(chartState, currentData) : null;
    chartState = chartStateFromSnapshot(currentData, snapshot);
    runtime.setChartState(chartState);
    hasInitialView = true;
    redraw({ animate: false });
    const after = stateSnapshots.serialize(chartState, currentData);
    emitChange({ type: "state.replace", state: after });
    if (record) remember({ kind: "state", undo: before, redo: after });
  }

  function highlightedGeneIds() {
    if (!selectedLocusIds.size) return highlightGeneIds;
    const ids = new Set(highlightGeneIds);
    for (const locusUid of selectedLocusIds) {
      for (const gene of chartIndex?.locusById.get(locusUid)?.genes || []) ids.add(gene.uid);
    }
    return ids;
  }

  function locusForId(uid) {
    return chartIndex?.locusById.get(uid) || [...(chartIndex?.locusById || [])]
      .find(([key]) => String(key) === String(uid))?.[1];
  }

  const chooseLegendColour = (group) => {
    const picker = container.select("input.colourPicker");
    picker.on("change", () => {
      my.patch([{
        type: "groups.update",
        ids: [group.uid],
        changes: { colour: picker.node().value },
      }]);
    });
    picker.node().click();
  };
  const setScaleBarLength = (providedValue) => {
    const value = Number(
      providedValue ?? prompt("Enter new length (bp):", runtime.config.scaleBar.basePair)
    );
    if (Number.isFinite(value) && value > 0) my.config({ scaleBar: { basePair: value } });
  };
  const renameRecord = (event, type, record) => {
    if (event.defaultPrevented) return;
    const field = type === "clusters" ? "name" : "label";
    const value = prompt("Enter new value:", record[field] || record.uid);
    if (value) my.patch([{ type: `${type}.update`, ids: [record.uid], changes: { [field]: value } }]);
  };
  // Both renderers delegate mutations to the same controller. Raster input
  // adapts stable IDs back to source records at its boundary; SVG already
  // receives those records through its D3 joins.
  const rendererInteractions = {
    ...interactionController,
    renameCluster: (event, cluster) => renameRecord(event, "clusters", cluster),
    isDragging: () => isDragging(chartState),
    rotateTreeNode: (uid) => {
      if (!container) return;
      const node = currentData.tree?.nodes.find((entry) => entry.uid === uid);
      if (!node?.children) return;
      beginInteractionState();
      treeAnimation = {
        previousTree: {
          ...currentData.tree,
          nodes: currentData.tree.nodes.map((entry) => ({
            ...entry,
            children: entry.children ? [...entry.children] : undefined,
          })),
        },
        previousScene: runtime.getScene(),
        progress: 0,
      };
      sceneCommit = { sourceScene: runtime.getScene(), changes: {} };
      node.children.reverse();
      chartState = createChartState(currentData, chartState);
      runtime.setChartState(chartState);
      redraw();
      commitInteractionState();
    },
    toggleLocusSelection: (locus, { clusterRange = null } = {}) => {
      const ids = new Set(selectedLocusIds);
      const anchor = locusForId(locusSelectionAnchorUid);
      if (clusterRange && anchor) {
        const range = lociForClusterRange(
          getClusterOrder(chartState),
          chartIndex?.clusterById || new Map(),
          anchor.clusterUid,
          locus.clusterUid
        );
        if (range.length) {
          range.forEach((uid) => {
            if (clusterRange === "remove") ids.delete(uid);
            else ids.add(uid);
          });
          my.locusSelection(ids);
          if (ids.size) locusSelectionAnchorUid = locus.uid;
          return;
        }
      }
      if (ids.has(locus.uid)) ids.delete(locus.uid);
      else ids.add(locus.uid);
      my.locusSelection(ids);
      if (ids.size) locusSelectionAnchorUid = locus.uid;
    },
    onGeneClick: (event, gene) => {
      // Shift-click belongs to the containing locus and must not also invoke
      // the established single-gene anchor interaction.
      if (event.shiftKey) return;
      (runtime.config.gene.shape.onClick || ((_, record) => anchorGene(record)))(event, gene);
    },
    showTreeMenu: (...args) => retainedOverlay?.showTreeMenu(...args),
    showGeneMenu: (...args) => retainedOverlay?.showGeneMenu(...args),
    showGroupMenu: (...args) => retainedOverlay?.showGroupMenu(...args),
    setScaleBarLength,
    chooseLegendColour,
    legendColour: (event, group) => {
      if (runtime.config.legend.onClickCircle) {
        runtime.config.legend.onClickCircle(event, group);
      } else {
        chooseLegendColour(group);
      }
    },
    legendText: (event, group) =>
      runtime.config.legend.onClickText ? runtime.config.legend.onClickText(event, group) : renameRecord(event, "groups", group),
    legendMenu: (event, group) => {
      const handler = runtime.config.legend.onAltClickText || retainedOverlay.showGroupMenu;
      handler(event, group);
    },
  };

  const targetForEvent = (canvasNode, event) =>
    hitTestCanvas({
      // A canvas can only have one rendering context. WebGPU owns the
      // visible surface, so use its transparent 2D text/chrome overlay
      // for the metric-dependent portions of hit testing instead.
      canvas: rasterHitSurface,
      scene: runtime.getScene(),
      camera: getCamera(chartState),
      config: runtime.renderConfig,
      event,
      tree: currentData.tree,
      treeDragging: isDragging(chartState),
    });
  const locusForTarget = (target) =>
    target?.locusUid || runtime.lookup.geneData(target?.geneUid)?.locusUid || null;
  const rasterBindings = createRasterInteractionBindings({
    interactions: rendererInteractions,
    getGene: runtime.lookup.geneData,
    getLocus: runtime.lookup.locusData,
  });
  const rasterInteraction = createRasterInteraction({
    targetForEvent,
    worldPoint: (surface, event) =>
      canvasWorldPoint(surface, event, getCamera(chartState)),
    locusForTarget,
    setHoverLocus: (locusUid) => {
      if (canvasHoverLocusUid === locusUid) return false;
      canvasHoverLocusUid = locusUid;
      scheduleScenePaint();
      return true;
    },
    warmLocus: (uid) => { if (isCanvasRenderer(runtime.config.plot.renderer)) canvasBackend.warmLocus(uid); },
    beginMotion: rasterMotion.begin,
    endMotion: rasterMotion.end,
    setCursor: (surface, cursor) => select(surface).style("cursor", cursor),
    ...rasterBindings,
  });

  function sceneFrame(scene) {
    return {
      scene, camera: getCamera(chartState), config: runtime.renderConfig,
      scales: runtime.scales, pixelRatio: rasterMotion.pixelRatio(), tree: currentData.tree,
      preview: scenePreview, hoverLocusUid: canvasHoverLocusUid,
      suppressLocusHover: scenePreview?.type === "locus-flip" || Boolean(canvasAnimation?.suppressLocusHover),
      previousTree: treeAnimation?.previousTree, previousTreeScene: treeAnimation?.previousScene,
      treeTargetScene: treeAnimation?.targetScene, treeProgress: treeAnimation?.progress ?? 1,
      highlightGeneIds: highlightedGeneIds(), highlightLinkIds, highlightLocusIds: selectedLocusIds,
    };
  }

  function paintScene() {
    if (!container || !runtime.getScene()) return;
    if (isCanvasRenderer(runtime.config.plot.renderer)) return paintCanvas();
    if (isWebGpuRenderer(runtime.config.plot.renderer)) return paintWebGpu();
    return paintSvg();
  }

  function paintSvg({ annotationsOnly = false, previousScene = null, animate = false } = {}) {
    const svg = container?.select("svg.clusterMap");
    if (!svg || svg.empty()) return;
    updateFigureSurface();
    return svgBackend.paint({ ...sceneFrame(svgBackend.pendingScene || runtime.getScene()),
      plot: svg.select("g.clusterMapG"), data: currentData, annotationsOnly, previousScene, animate,
      annotationViewport: hasInitialView ? worldViewport(getCamera(chartState), svg.node().getBoundingClientRect()) : null,
      transition: animate ? transition().duration(runtime.config.plot.transitionDuration) : null,
      ids: runtime.ids, lookup: { gene: runtime.lookup.geneData }, interactions: rendererInteractions });
  }

  function focusCamera({ genes = [], links = [] } = {}) {
    const scene = runtime.getScene();
    if (!container || !scene) return false;
    let bounds = null;
    const include = (candidate) => {
      if (!candidate) return;
      if (!bounds) {
        bounds = { ...candidate };
        return;
      }
      bounds.minX = Math.min(bounds.minX, candidate.minX);
      bounds.maxX = Math.max(bounds.maxX, candidate.maxX);
      bounds.minY = Math.min(bounds.minY, candidate.minY);
      bounds.maxY = Math.max(bounds.maxY, candidate.maxY);
    };
    for (const uid of genes) include(scene.genes.get(uid)?.bounds);
    for (const uid of links) {
      const rendered = scene.links.get(uid);
      if (rendered?.bounds) {
        include(rendered.bounds);
        continue;
      }
      // The data editor intentionally includes links that are hidden by a
      // threshold or best-match setting. They have no scene ribbon, but
      // their endpoints remain useful, focusable context.
      const link = chartIndex?.linkById.get(uid);
      include(scene.genes.get(link?.query.uid)?.bounds);
      include(scene.genes.get(link?.target.uid)?.bounds);
    }
    const useRaster = isRasterRenderer(runtime.config.plot.renderer);
    const node = useRaster ? rasterCanvas : container.select("svg.clusterMap").node();
    if (!bounds || !node) return false;
    const viewport = node.getBoundingClientRect();
    const camera = fitCameraForBounds({
      bounds,
      viewport,
      padding: 56,
      constrainScale: constrainZoom,
    });
    if (!camera) return false;
    const transform = identity$2.translate(camera.x, camera.y).scale(camera.k);
    if (useRaster && canvasZoom) select(node).call(canvasZoom.transform, transform);
    else if (zoom) select(node).call(zoom.transform, transform);
    else setCamera(chartState, camera);
    return true;
  }

  function paintCanvas(canvas = rasterCanvas, scene = canvasAnimation?.scene || canvasPendingFlip?.sourceScene || canvasBackend.pendingScene || runtime.getScene()) {
    if (!canvas || !scene) return null;
    updateFigureSurface();
    const result = canvasBackend.paint({ ...sceneFrame(scene), canvas,
      previousScene: canvasAnimation?.previousScene, progress: canvasAnimation?.progress });
    paintMinimap();
    return result;
  }

  function paintWebGpu(scene = webgpuBackend.pendingScene || runtime.getScene()) {
    if (!rasterCanvas || !scene) return;
    updateFigureSurface();
    const frame = sceneFrame(scene);
    if (overlayCanvas) renderCanvas({ ...frame, canvas: overlayCanvas,
      layers: ["tree", "trimIndicators", "geneLabels", "linkLabels", "clusterLabels", "annotationLabels", "chrome"] });
    const { width, height } = rasterCanvas.getBoundingClientRect();
    webgpuBackend.paint({ ...frame, canvas: rasterCanvas, width, height, onUnavailable: paintWebGpuFallback });
    paintMinimap();
  }

  function paintWebGpuFallback() {
    paintCanvas(overlayCanvas, webgpuBackend.pendingScene);
  }

  function paintMinimap() {
    if (!minimapCanvas) return;
    rasterMinimap.paint({ minimap: minimapCanvas, surface: rasterCanvas,
      scene: minimapScene || runtime.getScene(), options: runtime.config.plot.minimap,
      camera: getCamera(chartState), pixelRatio: globalThis.devicePixelRatio || 1 });
  }

  function renderMinimapBase({ canvas, scene, projection }) {
    const options = runtime.config.plot.minimap;
    renderCanvas({ canvas, scene, tree: currentData.tree, treeTrackAnchor: false,
      camera: { x: projection.x, y: projection.y, k: projection.scale },
      config: runtime.renderConfig, scales: runtime.scales, dimensions: projection, fullScene: true,
      layers: CANVAS_LAYERS.filter((layer) => layer !== "geneLabels" && layer !== "chrome" &&
        (options.showLinks || layer !== "links" && layer !== "linkLabels")),
      pixelRatio: globalThis.devicePixelRatio || 1 });
  }

  function scheduleMinimapBase(scene) {
    if (!minimapCanvas || !runtime.config.plot.minimap?.show) return;
    if (currentData.tree && runtime.config.tree.show) {
      minimapMeasurement ||= minimapCanvas.ownerDocument.createElement("canvas").getContext("2d");
      scene = { ...scene, figureBounds: canvasFigureBounds(minimapMeasurement, scene, runtime.config, currentData.tree) };
    }
    minimapScene = scene;
    rasterMinimap.scheduleBase({ scene, minimap: minimapCanvas, options: runtime.config.plot.minimap,
      renderBase: renderMinimapBase, onPaint: paintMinimap });
  }

  function stopCanvasAnimation() {
    canvasAnimation?.cancel();
    canvasAnimation = null;
  }

  function animateCanvas(scene, animate$1) {
    stopCanvasAnimation();
    if (!animate$1 || !canvasScene || !runtime.config.plot.transitionDuration) {
      treeAnimation = null;
      canvasScene = scene;
      paintCanvas();
      return;
    }
    const previousScene = canvasScene;
    if (treeAnimation) treeAnimation.targetScene = scene;
    canvasAnimation = { previousScene, scene, progress: 0, cancel: null };
    canvasAnimation.cancel = animate(runtime.config.plot.transitionDuration, (progress) => {
      if (treeAnimation) treeAnimation.progress = progress;
      canvasAnimation.progress = progress;
      paintCanvas();
    }, () => {
      canvasAnimation = null;
      treeAnimation = null;
      canvasScene = scene;
      paintCanvas();
    });
  }

  function animateWebGpu(previousScene, scene, animate$1) {
    stopWebGpuAnimation();
    const duration = runtime.config.plot.transitionDuration;
    if (!animate$1 || !previousScene || !duration) {
      treeAnimation = null;
      webgpuBackend.setScene(scene);
      paintWebGpu(scene);
      return;
    }
    if (treeAnimation) treeAnimation.targetScene = scene;
    webgpuAnimation = { cancel: animate(duration, (progress) => {
      const displayScene = interpolateCanvasScene(previousScene, scene, progress);
      if (treeAnimation) treeAnimation.progress = progress;
      webgpuBackend.setScene(displayScene);
      paintWebGpu(displayScene);
    }, () => {
      webgpuAnimation = null;
      treeAnimation = null;
      webgpuBackend.setScene(scene);
      paintWebGpu(scene);
    }) };
  }

  const minimapInteractions = {
    getSurface: () => rasterCanvas,
    getScene: () => minimapScene || runtime.getScene(),
    getCamera: () => getCamera(chartState),
    getOptions: () => runtime.config.plot.minimap,
    moveCamera: (camera) => {
      const mainCanvas = rasterCanvas;
      if (!camera || !mainCanvas) return;
      // Go through D3 rather than mutating its private __zoom state. This
      // keeps the next wheel/pan gesture continuous with minimap navigation.
      select(mainCanvas).call(
        canvasZoom.transform,
        identity$2.translate(camera.x, camera.y).scale(camera.k)
      );
      paintMinimap();
    },
    beginMotion: rasterMotion.begin,
    endMotion: rasterMotion.end,
    setCursor: (surface, cursor) => select(surface).style("cursor", cursor),
  };

  function redraw({ animate = true, synchronize = true } = {}) {
    if (!currentData || !container) return;
    applyTheme(container.node(), resolveTheme(runtime.config.plot.theme));
    if (globalThis.getComputedStyle(container.node()).position === "static") container.style("position", "relative");
    container.style("isolation", "isolate");
    if (!themeMedia && globalThis.matchMedia) {
      themeMedia = globalThis.matchMedia("(prefers-color-scheme: dark)");
      themeMedia.addEventListener("change", systemThemeChanged);
    }
    const committedScene = sceneCommit;
    sceneCommit = null;
    if (!updatingTreeMenu || !retainedOverlay?.isTreeMenuOpen(currentData.tree)) {
      retainedOverlay?.hide(true);
    }
    const data = currentData;

    const useCanvas = isCanvasRenderer(runtime.config.plot.renderer);
    const useWebGpu = isWebGpuRenderer(runtime.config.plot.renderer);
    const useRaster = isRasterRenderer(runtime.config.plot.renderer);
    if (!useWebGpu) stopWebGpuAnimation();
    if (!useWebGpu && webgpuBackend.hasResources()) {
      // A renderer owns the WebGPU context for its canvas. Dispose it before
      // the chart changes backend, and invalidate any async setup that might
      // otherwise resolve after that canvas has been removed.
      webgpuBackend.destroy();
      sceneCommit = null;
    }
    if (!useRaster) { disposeRasterInteraction(); disposeRasterInteraction = () => {}; }
    if (!useCanvas) { stopCanvasAnimation(); canvasBackend.destroy(); }
    if (useRaster) svgBackend.destroy();
    const minimapOptions = runtime.config.plot.minimap || {};
    // The overview is a separate 2D canvas, so it works for both raster
    // backends. WebGPU owns only the main plot surface.
    const showMinimap = useRaster && minimapOptions.show;
    if (!useCanvas) clearScenePreview();
    if (!showMinimap) { rasterMinimap.clear(); minimapScene = null; }

    const svgSurface = ensureSvgSurface({
      container,
      data,
      ids: runtime.ids,
      fontFamily: runtime.config.plot.fontFamily,
      zoom,
      zoomExtent,
      onZoom: (event, viewport) => {
        setCamera(chartState, event.transform);
        applyCamera(viewport);
        const svgNode = viewport.node()?.ownerSVGElement;
        // Raster mode has no SVG plot group. Camera synchronization still
        // dispatches its zoom callback, including while restoring a project.
        if (!isRasterRenderer(runtime.config.plot.renderer) && svgNode) updateSvgAnnotationViewport(viewport.select("g.clusterMapG"), runtime.getScene(), scenePreview,
          worldViewport(getCamera(chartState), svgNode.getBoundingClientRect()));
        annotationOverlay?.refresh();
      },
      onZoomStart: (surface) => surface.attr("cursor", "grabbing"),
      onZoomEnd: (surface) => surface.attr("cursor", "grab"),
    });
    const { svg, plot } = svgSurface;
    zoom = svgSurface.zoom;
    const rasterSurface = ensureRasterSurface({
      container,
      data,
      renderer: runtime.config.plot.renderer,
      showRaster: useRaster,
      showWebGpu: useWebGpu,
      showMinimap,
      minimap: minimapOptions,
      zoom: canvasZoom,
      zoomExtent,
      onZoom: (event) => {
        setCamera(chartState, event.transform);
        annotationOverlay?.refresh();
        scheduleScenePaint();
      },
      onZoomStart: (surface) => {
        rasterMotion.begin();
        select(surface).style("cursor", "grabbing");
      },
      onZoomEnd: (surface) => {
        select(surface).style("cursor", "grab");
        rasterMotion.end();
      },
    });
    const { canvas, webgpuOverlay, minimap } = rasterSurface;
    rasterCanvas = canvas.node(); overlayCanvas = webgpuOverlay.node(); minimapCanvas = minimap.node();
    canvasZoom = rasterSurface.zoom;
    svg.style("display", useRaster ? "none" : null);
    if (retainedOverlay?.node !== svgSurface.tooltip.node()) {
      retainedOverlay?.dispose();
      retainedOverlay = createHtmlOverlay({
        tooltip: svgSurface.tooltip,
        scales: runtime.scales,
        eventNamespace: `.${runtime.ids.root}-tooltip`,
        actions: {
          redraw,
          treeControls: () => ({ tree: currentData.tree, clusters: currentData.clusters, config: runtime.renderConfig.tree,
            patch: (ops) => updateFromTreeMenu(() => my.patch(ops)),
            rotate: (uid) => updateFromTreeMenu(() => rendererInteractions.rotateTreeNode(uid)) }),
          updateGene: (gene, changes) => my.patch([
            { type: "genes.update", ids: [gene.uid], changes },
          ]),
          updateGroup: (group, changes) => my.patch([
            { type: "groups.update", ids: [group.uid], changes },
          ]),
          mergeGroups: (target, sourceIds) => my.patch([{
            type: "groups.merge",
            targetId: target.uid,
            sourceIds,
          }]),
          anchorGene: (gene) => anchorGene(gene, { flipMismatchedLoci: true }),
          get revealGene() { return runtime.config.gene.shape.onReveal; },
          get revealGroup() { return runtime.config.legend.onReveal; },
          getGroups: () => currentData.groups,
        },
      });
      container
        .select("div.tooltip")
        .on("mouseenter", retainedOverlay.enter)
        .on("mouseleave", retainedOverlay.leave);
    }
    rasterHitSurface = useWebGpu ? webgpuOverlay.node() : canvas.node();
    if (useRaster) {
      canvasZoom.filter(function (event) { return rasterInteraction.zoomFilter(this, event); });
      disposeRasterInteraction = rasterInteraction.bind(canvas);

      if (showMinimap) rasterMinimap.bind(minimap, minimapInteractions);
    }
    // The currently displayed renderer can change without changing the chart
    // camera. Keep D3's per-surface gesture state aligned before a newly
    // created SVG or canvas receives its first interaction.
    const camera = getCamera(chartState);
    syncCameraZoom({ surface: svg, zoom, camera });
    syncCameraZoom({ surface: canvas, zoom: canvasZoom, camera });
    applyCamera(svg.select("g.clusterMapViewport"));

    const annotationsOnly = Boolean(committedScene?.changes.annotationsOnly);
    if (!annotationsOnly) {
      runtime.updateScales(data, { geometryOnly: Boolean(committedScene) });
      if (synchronize) runtime.synchronizeLocusLayoutStates(data, committedScene ? committedScene.changes.loci || [] : null);
      if (!committedScene) runtime.updateGroups(data.groups);
    }

    const scene = annotationsOnly ? runtime.patchAnnotations(committedScene.sourceScene, data) : committedScene
      ? runtime.patchScene(committedScene.sourceScene, committedScene.changes, data)
      : runtime.buildScene(data);

    if (useCanvas) {
      if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
      canvasBackend.setScene(scene);
      scheduleMinimapBase(scene);
      animateCanvas(scene, hasInitialView && animate);
    } else if (useWebGpu) {
      if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
      if (committedScene && !annotationsOnly) {
        webgpuBackend.adoptScene(scene, committedScene.sourceScene, {
          scales: runtime.scales, config: runtime.renderConfig,
        });
      }
      scheduleMinimapBase(scene);
      const previousScene = webgpuBackend.pendingScene;
      animateWebGpu(previousScene, scene, hasInitialView && animate);
    } else {
      const previousScene = svgBackend.pendingScene;
      svgBackend.setScene(scene);
      paintSvg({ annotationsOnly, previousScene, animate: hasInitialView && animate });

      if (!hasInitialView) fitInitialView(svg, plot);
    }
    updateFigureSurface();
    if (runtime.config.annotations.enabled && currentData.clusters?.length) {
      annotationUiContext = {
        surfaces: [useRaster ? canvas.node() : svg.node()],
        getScene: () => runtime.getScene(), getPreview: () => scenePreview,
        getCamera: () => getCamera(chartState),
        isBusy: () => isDragging(chartState) || Boolean(canvasAnimation || webgpuAnimation),
        fontFamily: runtime.config.plot.fontFamily,
      };
      if (annotationOverlay) annotationOverlay.update(annotationUiContext);
      else if (!annotationUiLoad) {
        annotationUiLoad = import('./annotationOverlay.mjs').then(({ createAnnotationOverlay }) => {
          if (!annotationUiContext) return;
          annotationOverlay = createAnnotationOverlay({ container: container.node(), annotationApi: {
            ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, validateAnnotationPanels, resolveAnnotationScale,
            annotationPanelsForFrame, annotationPanelBounds, hitTestAnnotationCell },
            editData: (panelUid) => !container.node().dispatchEvent(new CustomEvent("clustermap:edit-annotation", {
              bubbles: true, cancelable: true, detail: { chart: my, panelUid },
            })),
            getData: () => currentData,
            patch: (operations) => my.patch(operations) });
          annotationOverlay.update(annotationUiContext);
        }).catch((error) => console.error("Could not load optional annotation controls", error))
          .finally(() => { annotationUiLoad = null; });
      }
    } else {
      annotationUiContext = null;
      annotationOverlay?.dispose(); annotationOverlay = null;
    }
  }

  function fitInitialView(svg, plot) {
    const svgNode = svg.node();
    const plotNode = plot.node();
    if (!zoom || !svgNode || !plotNode) return;

    const { width, height } = svgNode.getBoundingClientRect();
    const bounds = plotNode.getBBox();
    if (!width || !height || !bounds.width || !bounds.height) return;

    const camera = fitCameraForBounds({
      bounds: {
        minX: bounds.x,
        maxX: bounds.x + bounds.width,
        minY: bounds.y,
        maxY: bounds.y + bounds.height,
      },
      viewport: { width, height },
      constrainScale: constrainZoom,
    });
    if (!camera) return;

    svg.call(zoom.transform, identity$2.translate(camera.x, camera.y).scale(camera.k));
    hasInitialView = true;
  }

  function fitInitialCanvasView(canvas, scene) {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height || !scene.bounds) return;

    // Requesting a 2D context would permanently prevent a WebGPU context on
    // the visible canvas. Text measurement has no visual side effect, so use
    // a detached 2D canvas for the WebGPU renderer.
    const measurementCanvas = isWebGpuRenderer(runtime.config.plot.renderer)
      ? document.createElement("canvas")
      : canvas;
    const bounds = canvasFigureBounds(measurementCanvas.getContext("2d"), scene, runtime.config, currentData.tree);
    if (!bounds) return;

    const camera = fitCameraForBounds({
      bounds,
      viewport: { width, height },
      // A fit below this scale defeats raster culling and produces an
      // impractically dense interaction surface. The helper then top-aligns
      // the cropped figure, showing the first clusters and their labels.
      minimumReadableScale: 1,
      constrainScale: constrainZoom,
    });
    if (!camera) return;
    if (canvasZoom) {
      select(canvas).call(
        canvasZoom.transform,
        identity$2.translate(camera.x, camera.y).scale(camera.k)
      );
    } else {
      setCamera(chartState, camera);
    }
    hasInitialView = true;
  }

  function applyCamera(selection) {
    const { x, y, k } = getCamera(chartState);
    selection.attr("transform", `translate(${x}, ${y}) scale(${k})`);
    updateFigureSurface();
  }

  my.config = function (_) {
    if (!arguments.length) return runtime.config;
    cancelTreePresentationPreview();
    const before = currentData ? previousConfigPatch(runtime.config, _) : null;
    sceneCommit = null;
    runtime.configure(_, currentData?.tree);
    // Configuration is a live part of the public chart API. Updating it after
    // mounting should have the same immediate effect as updating data, without
    // requiring consumers to re-bind the chart's normalized data themselves.
    if (container && currentData) redraw({ animate: false });
    emitChange({ type: "config.change", config: runtime.config });
    if (before) remember({ kind: "config", undo: before, redo: copyConfigPatch(_) });
    return my;
  };
  my.data = function (data) {
    if (!arguments.length) return currentData;
    if (!container) throw new Error("Cannot replace chart data before the chart is mounted.");
    cancelTreePresentationPreview();
    container.datum(data).call(my);
    emitChange({ type: "data.replace" });
    clearHistory();
    return my;
  };
  /** A serializable layout and camera snapshot for project persistence. */
  my.state = function (snapshot) {
    if (!arguments.length) return chartState ? stateSnapshots.serialize(chartState, currentData) : null;
    if (!container || !currentData) {
      throw new Error("Cannot replace chart state before the chart has rendered.");
    }
    setState(snapshot);
    return my;
  };
  /** A portable data, appearance, and layout snapshot for project persistence. */
  my.project = function (snapshot) {
    if (!arguments.length) {
      const data = structuredClone(currentData);
      if (treePresentationPreview && data?.tree) applyTreeOperation(data.tree, treePresentationPreview.undo);
      return {
        format: projectFormat,
        version: projectVersion,
        data,
        // Projects are portable JSON, not executable application state.
        // Callback hooks are intentionally omitted and can be reattached by
        // the consumer after loading.
        config: serializableConfig(runtime.config),
        state: chartState ? stateSnapshots.serialize(chartState, currentData) : null,
      };
    }
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new TypeError("A project snapshot must be an object.");
    }
    if (snapshot.format !== projectFormat || snapshot.version !== projectVersion) {
      throw new TypeError("Unsupported ClusterMap project snapshot.");
    }
    if (!snapshot.data || !snapshot.config) {
      throw new TypeError("A project snapshot requires data and config.");
    }
    const prepared = normalizeChartData(snapshot.data);
    runtime.validateConfiguration(snapshot.config, prepared.tree);
    if (snapshot.state) chartStateFromSnapshot(prepared, snapshot.state);
    // Validate the incoming pair before changing either live data or settings.
    runtime.configure(snapshot.config, prepared.tree);
    my.data(prepared);
    if (container && currentData) redraw({ animate: false });
    emitChange({ type: "config.change", config: runtime.config });
    if (snapshot.state) setState(snapshot.state, { record: false });
    clearHistory();
    return my;
  };
  // Do not name this `apply`: D3 invokes callable charts through
  // Function.prototype.apply when mounting them.
  my.patch = (operations) => {
    if (!container || !currentData || !chartIndex) {
      throw new Error("Cannot patch chart data before the chart has rendered.");
    }
    cancelTreePresentationPreview();
    applyPatch(operations);
    return my;
  };
  my.rotateTreeNode = (uid) => { cancelTreePresentationPreview(); rendererInteractions.rotateTreeNode(uid); return my; };
  /** Transient tree styles; patch commits once, null cancels the preview. */
  my.previewTreePresentation = (operations) => {
    const tree = currentData?.tree;
    if (!operations && !treePresentationPreview) return my;
    if (!tree) throw new Error("Tree presentation preview requires a loaded tree.");
    if (operations && (!Array.isArray(operations) || operations.some((op) => !isTreeOperation(op)))) {
      throw new TypeError("Only tree presentation operations can be previewed.");
    }
    cancelTreePresentationPreview();
    if (operations) {
      const undo = inverseTreeOperation(tree);
      try { applyChartOperations(currentData, chartIndex, operations, runtime.config.tree); }
      catch (error) { redraw({ animate: false }); throw error; }
      treePresentationPreview = { tree, undo };
    }
    redraw({ animate: false });
    return my;
  };
  my.canUndo = () => history.length > 0;
  my.canRedo = () => future.length > 0;
  my.clearHistory = () => {
    clearHistory();
    return my;
  };
  function replayHistory(source, target, direction) {
    const cancelled = cancelTreePresentationPreview();
    const change = source.pop();
    if (!change) { if (cancelled) redraw({ animate: false }); return my; }
    const value = change[direction];
    if (change.kind === "patch") {
      applyPatch(value, { record: false, automaticGroups: direction === "undo" ? change.groupsAutomaticBefore : change.groupsAutomaticAfter });
    } else if (change.kind === "config") {
      runtime.configure(value, currentData?.tree);
      redraw({ animate: false });
      emitChange({ type: "config.change", config: runtime.config });
    } else if (change.kind === "state" && value) {
      setState(value, { record: false });
    }
    target.push(change);
    emitHistoryChange();
    return my;
  }
  my.undo = () => replayHistory(history, future, "undo");
  my.redo = () => replayHistory(future, history, "redo");
  my.highlight = function (ids) {
    if (!arguments.length) return [...highlightGeneIds];
    const isScopedHighlight = ids && typeof ids === "object" && !Array.isArray(ids) && typeof ids[Symbol.iterator] !== "function";
    const nextGenes = new Set(isScopedHighlight ? ids.genes || [] : ids || []);
    const nextLinks = new Set(isScopedHighlight ? ids.links || [] : []);
    if (
      nextGenes.size === highlightGeneIds.size &&
      [...nextGenes].every((uid) => highlightGeneIds.has(uid)) &&
      nextLinks.size === highlightLinkIds.size &&
      [...nextLinks].every((uid) => highlightLinkIds.has(uid))
    ) return my;
    highlightGeneIds = nextGenes;
    highlightLinkIds = nextLinks;
    if (!container || !currentData) return my;
    if (isRasterRenderer(runtime.config.plot.renderer)) scheduleScenePaint();
    else redraw({ animate: false });
    return my;
  };
  /** Selected locus IDs used for batch plot operations. */
  my.locusSelection = function (ids) {
    if (!arguments.length) return [...selectedLocusIds];
    const next = chartIndex
      ? new Set([...(ids || [])].map(locusForId).filter(Boolean).map((locus) => locus.uid))
      : new Set(ids || []);
    if (
      next.size === selectedLocusIds.size &&
      [...next].every((uid) => selectedLocusIds.has(uid))
    ) return my;
    selectedLocusIds = next;
    if (!next.size) locusSelectionAnchorUid = null;
    if (container && currentData) {
      if (isRasterRenderer(runtime.config.plot.renderer)) scheduleScenePaint();
      else redraw({ animate: false });
    }
    emitChange({ type: "loci.select", locusIds: [...selectedLocusIds] });
    return my;
  };
  /** Flip the supplied loci, or the current locus selection, as one operation. */
  my.flipLoci = function (ids = selectedLocusIds) {
    if (!container || !currentData || !chartIndex || !chartState) {
      throw new Error("Cannot flip loci before the chart has rendered.");
    }
    const loci = [...new Set(ids || [])]
      .map(locusForId)
      .filter(Boolean);
    if (!loci.length) return my;
    const before = stateSnapshots.serialize(chartState, currentData);
    flushCanvasFlip();
    clearScenePreview();
    for (const locus of loci) flipLocus(chartState, locus);
    redraw({ animate: true });
    emitChange({ type: "loci.flip", locusIds: loci.map((locus) => locus.uid) });
    remember({ kind: "state", undo: before, redo: stateSnapshots.serialize(chartState, currentData) });
    return my;
  };
  /** Trim selected loci to their displayed outermost genes as one edit. */
  my.trimLoci = function (ids = selectedLocusIds) {
    if (!container || !currentData || !chartIndex || !chartState) {
      throw new Error("Cannot trim loci before the chart has rendered.");
    }
    const loci = [...new Set(ids || [])]
      .map(locusForId)
      .filter(Boolean);
    if (!loci.length) return my;
    const before = stateSnapshots.serialize(chartState, currentData);
    flushCanvasFlip();
    clearScenePreview();
    let changed = false;
    for (const locus of loci) changed = trimLocusToGeneBounds(chartState, locus) || changed;
    if (!changed) return my;
    redraw({ animate: false });
    const locusIds = loci.map((locus) => locus.uid);
    emitChange({ type: "loci.trim", locusIds });
    remember({ kind: "state", undo: before, redo: stateSnapshots.serialize(chartState, currentData) });
    return my;
  };
  /** Restore selected loci to their full bounds as one edit. */
  my.restoreLoci = function (ids = selectedLocusIds) {
    if (!container || !currentData || !chartIndex || !chartState) {
      throw new Error("Cannot restore loci before the chart has rendered.");
    }
    const loci = [...new Set(ids || [])]
      .map(locusForId)
      .filter(Boolean);
    if (!loci.length) return my;
    const before = stateSnapshots.serialize(chartState, currentData);
    flushCanvasFlip();
    clearScenePreview();
    let changed = false;
    for (const locus of loci) changed = restoreLocusBounds(chartState, locus) || changed;
    if (!changed) return my;
    redraw({ animate: false });
    const locusIds = loci.map((locus) => locus.uid);
    emitChange({ type: "loci.restore", locusIds });
    remember({ kind: "state", undo: before, redo: stateSnapshots.serialize(chartState, currentData) });
    return my;
  };
  /** Frame selected genes and/or links without changing their selection. */
  my.focus = function (ids) {
    const isScoped = ids && typeof ids === "object" && !Array.isArray(ids) && typeof ids[Symbol.iterator] !== "function";
    focusCamera({
      genes: isScoped ? ids.genes || [] : ids || [],
      links: isScoped ? ids.links || [] : [],
    });
    return my;
  };
  my.on = (type, listener) => {
    if (type !== "change") throw new TypeError(`Unsupported chart event: ${type}`);
    if (typeof listener !== "function") throw new TypeError("Chart event listeners must be functions.");
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  };
  /** Latest computed layout, excluding transient animation and drag geometry. */
  my.figureBounds = () => figureSurface.bounds(container?.node(), runtime.getScene(), runtime.renderConfig, currentData?.tree);
  my.exportSvg = ({ padding = 20 } = {}) => {
    flushCanvasFlip();
    return exportChartSvg({
      data: currentData,
      scene: runtime.getScene(),
      config: runtime.renderConfig,
      scales: runtime.scales,
      ids: runtime.ids,
      lookup: { gene: runtime.lookup.geneData },
      padding,
    });
  };
  my.destroy = () => {
    figureSurface.clear();
    themeMedia?.removeEventListener("change", systemThemeChanged); themeMedia = null;
    annotationUiContext = null;
    annotationOverlay?.dispose(); annotationOverlay = null;
    stateSnapshots.reset();
    cancelTreePresentationPreview();
    disposeRasterInteraction();
    rasterHitSurface = null;
    disposeRasterInteraction = () => {};
    retainedOverlay?.dispose();
    retainedOverlay = null;
    clearScenePreview();
    stopCanvasAnimation();
    stopWebGpuAnimation();
    rasterMotion.dispose();
    rasterMinimap.clear();
    webgpuBackend.destroy();
    canvasBackend.destroy();
    svgBackend.destroy();
    container
      ?.selectAll([
        "svg.clusterMap",
        "div.clusterMapFigureSurface",
        "div.clusterMapFigureDimensions",
        "input.colourPicker",
        "div.tooltip",
        "canvas.clusterMapCanvas",
        "canvas.clusterMapWebGpuOverlay",
        "canvas.clusterMapMinimap",
      ].join(", "))
      .interrupt()
      .remove();
    container = null;
    figureMeasurementContext = null;
    zoom = null;
    canvasZoom = null;
    hasInitialView = false;
    canvasHoverLocusUid = null;
    canvasScene = null;
    rasterCanvas = overlayCanvas = minimapCanvas = minimapScene = minimapMeasurement = null;
    sceneCommit = null;
    chartIndex = null;
    highlightGeneIds.clear();
    highlightLinkIds.clear();
    selectedLocusIds.clear();
    changeListeners.clear();
    return my;
  };

  return my;
}

export { clusterMap as ClusterMap };
