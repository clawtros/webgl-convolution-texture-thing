(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/adam/projects/backgrounds/node_modules/barracks/apply-hook.js":[function(require,module,exports){
module.exports = applyHook;

// apply arguments onto an array of functions, useful for hooks
// (arr, any?, any?, any?, any?, any?) -> null
function applyHook(arr, arg1, arg2, arg3, arg4, arg5) {
  arr.forEach(function (fn) {
    fn(arg1, arg2, arg3, arg4, arg5);
  });
}
},{}],"/Users/adam/projects/backgrounds/node_modules/barracks/index.js":[function(require,module,exports){
var mutate = require('xtend/mutable');
var assert = require('assert');
var xtend = require('xtend');

var applyHook = require('./apply-hook');

module.exports = dispatcher;

// initialize a new barracks instance
// obj -> obj
function dispatcher(hooks) {
  hooks = hooks || {};
  assert.equal(typeof hooks, 'object', 'barracks: hooks should be undefined or an object');

  var onStateChangeHooks = [];
  var onActionHooks = [];
  var onErrorHooks = [];

  useHooks(hooks);

  var reducersCalled = false;
  var effectsCalled = false;
  var stateCalled = false;
  var subsCalled = false;

  var subscriptions = start._subscriptions = {};
  var reducers = start._reducers = {};
  var effects = start._effects = {};
  var models = start._models = [];
  var _state = {};

  start.model = setModel;
  start.state = getState;
  start.start = start;
  start.use = useHooks;
  return start;

  // push an object of hooks onto an array
  // obj -> null
  function useHooks(hooks) {
    assert.equal(typeof hooks, 'object', 'barracks.use: hooks should be an object');
    assert.ok(!hooks.onError || typeof hooks.onError === 'function', 'barracks.use: onError should be undefined or a function');
    assert.ok(!hooks.onAction || typeof hooks.onAction === 'function', 'barracks.use: onAction should be undefined or a function');
    assert.ok(!hooks.onStateChange || typeof hooks.onStateChange === 'function', 'barracks.use: onStateChange should be undefined or a function');

    if (hooks.onError) onErrorHooks.push(wrapOnError(hooks.onError));
    if (hooks.onAction) onActionHooks.push(hooks.onAction);
    if (hooks.onStateChange) onStateChangeHooks.push(hooks.onStateChange);
  }

  // push a model to be initiated
  // obj -> null
  function setModel(model) {
    assert.equal(typeof model, 'object', 'barracks.store.model: model should be an object');
    models.push(model);
  }

  // get the current state from the store
  // obj? -> obj
  function getState(opts) {
    opts = opts || {};
    assert.equal(typeof opts, 'object', 'barracks.store.state: opts should be an object');
    if (opts.state) {
      var _ret = function () {
        var initialState = {};
        var nsState = {};
        models.forEach(function (model) {
          var ns = model.namespace;
          var modelState = model.state || {};
          if (ns) {
            nsState[ns] = {};
            apply(ns, modelState, nsState);
            nsState[ns] = xtend(nsState[ns], opts.state[ns]);
          } else {
            apply(model.namespace, modelState, initialState);
          }
        });
        return {
          v: xtend(_state, xtend(opts.state, nsState))
        };
      }();

      if (typeof _ret === "object") return _ret.v;
    } else if (opts.freeze === false) {
      return xtend(_state);
    } else {
      return Object.freeze(xtend(_state));
    }
  }

  // initialize the store hooks, get the send() function
  // obj? -> fn
  function start(opts) {
    opts = opts || {};
    assert.equal(typeof opts, 'object', 'barracks.store.start: opts should be undefined or an object');

    // register values from the models
    models.forEach(function (model) {
      var ns = model.namespace;
      if (!stateCalled && model.state && opts.state !== false) {
        apply(ns, model.state, _state);
      }
      if (!reducersCalled && model.reducers && opts.reducers !== false) {
        apply(ns, model.reducers, reducers);
      }
      if (!effectsCalled && model.effects && opts.effects !== false) {
        apply(ns, model.effects, effects);
      }
      if (!subsCalled && model.subscriptions && opts.subscriptions !== false) {
        apply(ns, model.subscriptions, subscriptions, createSend, function (err) {
          applyHook(onErrorHooks, err);
        });
      }
    });

    if (!opts.noState) stateCalled = true;
    if (!opts.noReducers) reducersCalled = true;
    if (!opts.noEffects) effectsCalled = true;
    if (!opts.noSubscriptions) subsCalled = true;

    if (!onErrorHooks.length) onErrorHooks.push(wrapOnError(defaultOnError));

    return createSend;

    // call an action from a view
    // (str, bool?) -> (str, any?, fn?) -> null
    function createSend(selfName, callOnError) {
      assert.equal(typeof selfName, 'string', 'barracks.store.start.createSend: selfName should be a string');
      assert.ok(!callOnError || typeof callOnError === 'boolean', 'barracks.store.start.send: callOnError should be undefined or a boolean');

      return function send(name, data, cb) {
        if (!cb && !callOnError) {
          cb = data;
          data = null;
        }
        data = typeof data === 'undefined' ? null : data;

        assert.equal(typeof name, 'string', 'barracks.store.start.send: name should be a string');
        assert.ok(!cb || typeof cb === 'function', 'barracks.store.start.send: cb should be a function');

        var done = callOnError ? onErrorCallback : cb;
        _send(name, data, selfName, done);

        function onErrorCallback(err) {
          err = err || null;
          if (err) {
            applyHook(onErrorHooks, err, _state, function createSend(selfName) {
              return function send(name, data) {
                assert.equal(typeof name, 'string', 'barracks.store.start.send: name should be a string');
                data = typeof data === 'undefined' ? null : data;
                _send(name, data, selfName, done);
              };
            });
          }
        }
      };
    }

    // call an action
    // (str, str, any, fn) -> null
    function _send(name, data, caller, cb) {
      assert.equal(typeof name, 'string', 'barracks._send: name should be a string');
      assert.equal(typeof caller, 'string', 'barracks._send: caller should be a string');
      assert.equal(typeof cb, 'function', 'barracks._send: cb should be a function');

      setTimeout(function () {
        var reducersCalled = false;
        var effectsCalled = false;
        var newState = xtend(_state);

        if (onActionHooks.length) {
          applyHook(onActionHooks, data, _state, name, caller, createSend);
        }

        // validate if a namespace exists. Namespaces are delimited by ':'.
        var actionName = name;
        if (/:/.test(name)) {
          var arr = name.split(':');
          var ns = arr.shift();
          actionName = arr.join(':');
        }

        var _reducers = ns ? reducers[ns] : reducers;
        if (_reducers && _reducers[actionName]) {
          if (ns) {
            var reducedState = _reducers[actionName](data, _state[ns]);
            newState[ns] = xtend(_state[ns], reducedState);
          } else {
            mutate(newState, reducers[actionName](data, _state));
          }
          reducersCalled = true;
          if (onStateChangeHooks.length) {
            applyHook(onStateChangeHooks, data, newState, _state, actionName, createSend);
          }
          _state = newState;
          cb();
        }

        var _effects = ns ? effects[ns] : effects;
        if (!reducersCalled && _effects && _effects[actionName]) {
          var send = createSend('effect: ' + name);
          if (ns) _effects[actionName](data, _state[ns], send, cb);else _effects[actionName](data, _state, send, cb);
          effectsCalled = true;
        }

        if (!reducersCalled && !effectsCalled) {
          throw new Error('Could not find action ' + actionName);
        }
      }, 0);
    }
  }
}

// compose an object conditionally
// optionally contains a namespace
// which is used to nest properties.
// (str, obj, obj, fn?) -> null
function apply(ns, source, target, createSend, done) {
  if (ns && !target[ns]) target[ns] = {};
  Object.keys(source).forEach(function (key) {
    if (ns) {
      target[ns][key] = source[key];
    } else {
      target[key] = source[key];
    }
    if (createSend && done) {
      var send = createSend('subscription: ' + (ns ? ns + ':' + key : key));
      source[key](send, done);
    }
  });
}

// handle errors all the way at the top of the trace
// err? -> null
function defaultOnError(err) {
  throw err;
}

function wrapOnError(onError) {
  return function onErrorWrap(err) {
    if (err) onError(err);
  };
}
},{"./apply-hook":"/Users/adam/projects/backgrounds/node_modules/barracks/apply-hook.js","assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","xtend":"/Users/adam/projects/backgrounds/node_modules/xtend/immutable.js","xtend/mutable":"/Users/adam/projects/backgrounds/node_modules/xtend/mutable.js"}],"/Users/adam/projects/backgrounds/node_modules/bel/index.js":[function(require,module,exports){
var document = require('global/document');
var hyperx = require('hyperx');
var onload = require('on-load');

var SVGNS = 'http://www.w3.org/2000/svg';
var BOOL_PROPS = {
  autofocus: 1,
  checked: 1,
  defaultchecked: 1,
  disabled: 1,
  formnovalidate: 1,
  indeterminate: 1,
  readonly: 1,
  required: 1,
  selected: 1,
  willvalidate: 1
};
var SVG_TAGS = ['svg', 'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor', 'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile', 'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font', 'font-face', 'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri', 'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image', 'line', 'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph', 'mpath', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect', 'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref', 'tspan', 'use', 'view', 'vkern'];

function belCreateElement(tag, props, children) {
  var el;

  // If an svg tag, it needs a namespace
  if (SVG_TAGS.indexOf(tag) !== -1) {
    props.namespace = SVGNS;
  }

  // If we are using a namespace
  var ns = false;
  if (props.namespace) {
    ns = props.namespace;
    delete props.namespace;
  }

  // Create the element
  if (ns) {
    el = document.createElementNS(ns, tag);
  } else {
    el = document.createElement(tag);
  }

  // If adding onload events
  if (props.onload || props.onunload) {
    var load = props.onload || function () {};
    var unload = props.onunload || function () {};
    onload(el, function bel_onload() {
      load(el);
    }, function bel_onunload() {
      unload(el);
    },
    // We have to use non-standard `caller` to find who invokes `belCreateElement`
    belCreateElement.caller.caller.caller);
    delete props.onload;
    delete props.onunload;
  }

  // Create the properties
  for (var p in props) {
    if (props.hasOwnProperty(p)) {
      var key = p.toLowerCase();
      var val = props[p];
      // Normalize className
      if (key === 'classname') {
        key = 'class';
        p = 'class';
      }
      // The for attribute gets transformed to htmlFor, but we just set as for
      if (p === 'htmlFor') {
        p = 'for';
      }
      // If a property is boolean, set itself to the key
      if (BOOL_PROPS[key]) {
        if (val === 'true') val = key;else if (val === 'false') continue;
      }
      // If a property prefers being set directly vs setAttribute
      if (key.slice(0, 2) === 'on') {
        el[p] = val;
      } else {
        if (ns) {
          el.setAttributeNS(null, p, val);
        } else {
          el.setAttribute(p, val);
        }
      }
    }
  }

  function appendChild(childs) {
    if (!Array.isArray(childs)) return;
    for (var i = 0; i < childs.length; i++) {
      var node = childs[i];
      if (Array.isArray(node)) {
        appendChild(node);
        continue;
      }

      if (typeof node === 'number' || typeof node === 'boolean' || node instanceof Date || node instanceof RegExp) {
        node = node.toString();
      }

      if (typeof node === 'string') {
        if (el.lastChild && el.lastChild.nodeName === '#text') {
          el.lastChild.nodeValue += node;
          continue;
        }
        node = document.createTextNode(node);
      }

      if (node && node.nodeType) {
        el.appendChild(node);
      }
    }
  }
  appendChild(children);

  return el;
}

module.exports = hyperx(belCreateElement);
module.exports.createElement = belCreateElement;
},{"global/document":"/Users/adam/projects/backgrounds/node_modules/global/document.js","hyperx":"/Users/adam/projects/backgrounds/node_modules/hyperx/index.js","on-load":"/Users/adam/projects/backgrounds/node_modules/on-load/index.js"}],"/Users/adam/projects/backgrounds/node_modules/choo/html.js":[function(require,module,exports){
module.exports = require('yo-yo');
},{"yo-yo":"/Users/adam/projects/backgrounds/node_modules/yo-yo/index.js"}],"/Users/adam/projects/backgrounds/node_modules/choo/index.js":[function(require,module,exports){
var history = require('sheet-router/history');
var sheetRouter = require('sheet-router');
var document = require('global/document');
var onReady = require('document-ready');
var href = require('sheet-router/href');
var hash = require('sheet-router/hash');
var hashMatch = require('hash-match');
var barracks = require('barracks');
var nanoraf = require('nanoraf');
var assert = require('assert');
var xtend = require('xtend');
var yo = require('yo-yo');

module.exports = choo;

// framework for creating sturdy web applications
// null -> fn
function choo(opts) {
  opts = opts || {};

  var _store = start._store = barracks();
  var _router = start._router = null;
  var _defaultRoute = null;
  var _rootNode = null;
  var _routes = null;
  var _frame = null;

  _store.use({ onStateChange: render });
  _store.use(opts);

  start.toString = toString;
  start.router = router;
  start.model = model;
  start.start = start;
  start.use = use;

  return start;

  // render the application to a string
  // (str, obj) -> str
  function toString(route, serverState) {
    serverState = serverState || {};
    assert.equal(typeof route, 'string', 'choo.app.toString: route must be a string');
    assert.equal(typeof serverState, 'object', 'choo.app.toString: serverState must be an object');
    _store.start({ subscriptions: false, reducers: false, effects: false });

    var state = _store.state({ state: serverState });
    var router = createRouter(_defaultRoute, _routes, createSend);
    var tree = router(route, state);
    return tree.outerHTML || tree.toString();

    function createSend() {
      return function send() {
        assert.ok(false, 'choo: send() cannot be called from Node');
      };
    }
  }

  // start the application
  // (str?, obj?) -> DOMNode
  function start(selector, startOpts) {
    if (!startOpts && typeof selector !== 'string') {
      startOpts = selector;
      selector = null;
    }
    startOpts = startOpts || {};

    _store.model(appInit(startOpts));
    var createSend = _store.start(startOpts);
    _router = start._router = createRouter(_defaultRoute, _routes, createSend);
    var state = _store.state({ state: {} });

    if (!selector) {
      var tree = _router(state.location.pathname, state);
      _rootNode = tree;
      return tree;
    } else {
      onReady(function onReady() {
        var oldTree = document.querySelector(selector);
        assert.ok(oldTree, 'could not query selector: ' + selector);
        var newTree = _router(state.location.pathname, state);
        _rootNode = yo.update(oldTree, newTree);
      });
    }
  }

  // update the DOM after every state mutation
  // (obj, obj, obj, str, fn) -> null
  function render(data, state, prev, name, createSend) {
    if (!_frame) {
      _frame = nanoraf(function (state, prev) {
        var newTree = _router(state.location.pathname, state, prev);
        _rootNode = yo.update(_rootNode, newTree);
      });
    }
    _frame(state, prev);
  }

  // register all routes on the router
  // (str?, [fn|[fn]]) -> obj
  function router(defaultRoute, routes) {
    _defaultRoute = defaultRoute;
    _routes = routes;
  }

  // create a new model
  // (str?, obj) -> null
  function model(model) {
    _store.model(model);
  }

  // register a plugin
  // (obj) -> null
  function use(hooks) {
    assert.equal(typeof hooks, 'object', 'choo.use: hooks should be an object');
    _store.use(hooks);
  }

  // create a new router with a custom `createRoute()` function
  // (str?, obj, fn?) -> null
  function createRouter(defaultRoute, routes, createSend) {
    var prev = {};
    return sheetRouter(defaultRoute, routes, createRoute);

    function createRoute(routeFn) {
      return function (route, inline, child) {
        if (typeof inline === 'function') {
          inline = wrap(inline, route);
        }
        return routeFn(route, inline, child);
      };

      function wrap(child, route) {
        var send = createSend('view: ' + route, true);
        return function chooWrap(params, state) {
          var nwPrev = prev;
          var nwState = prev = xtend(state, { params: params });
          if (opts.freeze !== false) Object.freeze(nwState);
          return child(nwState, nwPrev, send);
        };
      }
    }
  }
}

// initial application state model
// obj -> obj
function appInit(opts) {
  var loc = document.location;
  var state = { pathname: opts.hash ? hashMatch(loc.hash) : loc.href };
  var reducers = {
    setLocation: function setLocation(data, state) {
      return { pathname: data.location.replace(/#.*/, '') };
    }
  };
  // if hash routing explicitly enabled, subscribe to it
  var subs = {};
  if (opts.hash === true) {
    pushLocationSub(function (navigate) {
      hash(function (fragment) {
        navigate(hashMatch(fragment));
      });
    }, 'handleHash', subs);
  } else {
    if (opts.history !== false) pushLocationSub(history, 'handleHistory', subs);
    if (opts.href !== false) pushLocationSub(href, 'handleHref', subs);
  }

  return {
    namespace: 'location',
    subscriptions: subs,
    reducers: reducers,
    state: state
  };

  // create a new subscription that modifies
  // 'app:location' and push it to be loaded
  // (fn, obj) -> null
  function pushLocationSub(cb, key, model) {
    model[key] = function (send, done) {
      cb(function navigate(pathname) {
        send('location:setLocation', { location: pathname }, done);
      });
    };
  }
}
},{"assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","barracks":"/Users/adam/projects/backgrounds/node_modules/barracks/index.js","document-ready":"/Users/adam/projects/backgrounds/node_modules/document-ready/index.js","global/document":"/Users/adam/projects/backgrounds/node_modules/global/document.js","hash-match":"/Users/adam/projects/backgrounds/node_modules/hash-match/index.js","nanoraf":"/Users/adam/projects/backgrounds/node_modules/nanoraf/index.js","sheet-router":"/Users/adam/projects/backgrounds/node_modules/sheet-router/index.js","sheet-router/hash":"/Users/adam/projects/backgrounds/node_modules/sheet-router/hash.js","sheet-router/history":"/Users/adam/projects/backgrounds/node_modules/sheet-router/history.js","sheet-router/href":"/Users/adam/projects/backgrounds/node_modules/sheet-router/href.js","xtend":"/Users/adam/projects/backgrounds/node_modules/xtend/immutable.js","yo-yo":"/Users/adam/projects/backgrounds/node_modules/yo-yo/index.js"}],"/Users/adam/projects/backgrounds/node_modules/document-ready/index.js":[function(require,module,exports){
'use strict';

var document = require('global/document');

module.exports = document.addEventListener ? ready : noop;

function ready(callback) {
  if (document.readyState === 'complete') {
    return setTimeout(callback, 0);
  }

  document.addEventListener('DOMContentLoaded', function onLoad() {
    callback();
  });
}

function noop() {}
},{"global/document":"/Users/adam/projects/backgrounds/node_modules/global/document.js"}],"/Users/adam/projects/backgrounds/node_modules/global/document.js":[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : {};
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js"}],"/Users/adam/projects/backgrounds/node_modules/global/window.js":[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else if (typeof self !== "undefined") {
    module.exports = self;
} else {
    module.exports = {};
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/Users/adam/projects/backgrounds/node_modules/hash-match/index.js":[function(require,module,exports){
module.exports = function hashMatch(hash, prefix) {
  var pre = prefix || '/';
  if (hash.length === 0) return pre;
  hash = hash.replace('#', '');
  hash = hash.replace(/\/$/, '');
  if (hash.indexOf('/') != 0) hash = '/' + hash;
  if (pre == '/') return hash;else return hash.replace(pre, '');
};
},{}],"/Users/adam/projects/backgrounds/node_modules/hyperscript-attribute-to-property/index.js":[function(require,module,exports){
module.exports = attributeToProperty;

var transform = {
  'class': 'className',
  'for': 'htmlFor',
  'http-equiv': 'httpEquiv'
};

function attributeToProperty(h) {
  return function (tagName, attrs, children) {
    for (var attr in attrs) {
      if (attr in transform) {
        attrs[transform[attr]] = attrs[attr];
        delete attrs[attr];
      }
    }
    return h(tagName, attrs, children);
  };
}
},{}],"/Users/adam/projects/backgrounds/node_modules/hyperx/index.js":[function(require,module,exports){
var attrToProp = require('hyperscript-attribute-to-property');

var VAR = 0,
    TEXT = 1,
    OPEN = 2,
    CLOSE = 3,
    ATTR = 4;
var ATTR_KEY = 5,
    ATTR_KEY_W = 6;
var ATTR_VALUE_W = 7,
    ATTR_VALUE = 8;
var ATTR_VALUE_SQ = 9,
    ATTR_VALUE_DQ = 10;
var ATTR_EQ = 11,
    ATTR_BREAK = 12;

module.exports = function (h, opts) {
  h = attrToProp(h);
  if (!opts) opts = {};
  var concat = opts.concat || function (a, b) {
    return String(a) + String(b);
  };

  return function (strings) {
    var state = TEXT,
        reg = '';
    var arglen = arguments.length;
    var parts = [];

    for (var i = 0; i < strings.length; i++) {
      if (i < arglen - 1) {
        var arg = arguments[i + 1];
        var p = parse(strings[i]);
        var xstate = state;
        if (xstate === ATTR_VALUE_DQ) xstate = ATTR_VALUE;
        if (xstate === ATTR_VALUE_SQ) xstate = ATTR_VALUE;
        if (xstate === ATTR_VALUE_W) xstate = ATTR_VALUE;
        if (xstate === ATTR) xstate = ATTR_KEY;
        p.push([VAR, xstate, arg]);
        parts.push.apply(parts, p);
      } else parts.push.apply(parts, parse(strings[i]));
    }

    var tree = [null, {}, []];
    var stack = [[tree, -1]];
    for (var i = 0; i < parts.length; i++) {
      var cur = stack[stack.length - 1][0];
      var p = parts[i],
          s = p[0];
      if (s === OPEN && /^\//.test(p[1])) {
        var ix = stack[stack.length - 1][1];
        if (stack.length > 1) {
          stack.pop();
          stack[stack.length - 1][0][2][ix] = h(cur[0], cur[1], cur[2].length ? cur[2] : undefined);
        }
      } else if (s === OPEN) {
        var c = [p[1], {}, []];
        cur[2].push(c);
        stack.push([c, cur[2].length - 1]);
      } else if (s === ATTR_KEY || s === VAR && p[1] === ATTR_KEY) {
        var key = '';
        var copyKey;
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_KEY) {
            key = concat(key, parts[i][1]);
          } else if (parts[i][0] === VAR && parts[i][1] === ATTR_KEY) {
            if (typeof parts[i][2] === 'object' && !key) {
              for (copyKey in parts[i][2]) {
                if (parts[i][2].hasOwnProperty(copyKey) && !cur[1][copyKey]) {
                  cur[1][copyKey] = parts[i][2][copyKey];
                }
              }
            } else {
              key = concat(key, parts[i][2]);
            }
          } else break;
        }
        if (parts[i][0] === ATTR_EQ) i++;
        var j = i;
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_VALUE || parts[i][0] === ATTR_KEY) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][1]);else cur[1][key] = concat(cur[1][key], parts[i][1]);
          } else if (parts[i][0] === VAR && (parts[i][1] === ATTR_VALUE || parts[i][1] === ATTR_KEY)) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][2]);else cur[1][key] = concat(cur[1][key], parts[i][2]);
          } else {
            if (key.length && !cur[1][key] && i === j && (parts[i][0] === CLOSE || parts[i][0] === ATTR_BREAK)) {
              // https://html.spec.whatwg.org/multipage/infrastructure.html#boolean-attributes
              // empty string is falsy, not well behaved value in browser
              cur[1][key] = key.toLowerCase();
            }
            break;
          }
        }
      } else if (s === ATTR_KEY) {
        cur[1][p[1]] = true;
      } else if (s === VAR && p[1] === ATTR_KEY) {
        cur[1][p[2]] = true;
      } else if (s === CLOSE) {
        if (selfClosing(cur[0]) && stack.length) {
          var ix = stack[stack.length - 1][1];
          stack.pop();
          stack[stack.length - 1][0][2][ix] = h(cur[0], cur[1], cur[2].length ? cur[2] : undefined);
        }
      } else if (s === VAR && p[1] === TEXT) {
        if (p[2] === undefined || p[2] === null) p[2] = '';else if (!p[2]) p[2] = concat('', p[2]);
        if (Array.isArray(p[2][0])) {
          cur[2].push.apply(cur[2], p[2]);
        } else {
          cur[2].push(p[2]);
        }
      } else if (s === TEXT) {
        cur[2].push(p[1]);
      } else if (s === ATTR_EQ || s === ATTR_BREAK) {
        // no-op
      } else {
        throw new Error('unhandled: ' + s);
      }
    }

    if (tree[2].length > 1 && /^\s*$/.test(tree[2][0])) {
      tree[2].shift();
    }

    if (tree[2].length > 2 || tree[2].length === 2 && /\S/.test(tree[2][1])) {
      throw new Error('multiple root elements must be wrapped in an enclosing tag');
    }
    if (Array.isArray(tree[2][0]) && typeof tree[2][0][0] === 'string' && Array.isArray(tree[2][0][2])) {
      tree[2][0] = h(tree[2][0][0], tree[2][0][1], tree[2][0][2]);
    }
    return tree[2][0];

    function parse(str) {
      var res = [];
      if (state === ATTR_VALUE_W) state = ATTR;
      for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i);
        if (state === TEXT && c === '<') {
          if (reg.length) res.push([TEXT, reg]);
          reg = '';
          state = OPEN;
        } else if (c === '>' && !quot(state)) {
          if (state === OPEN) {
            res.push([OPEN, reg]);
          } else if (state === ATTR_KEY) {
            res.push([ATTR_KEY, reg]);
          } else if (state === ATTR_VALUE && reg.length) {
            res.push([ATTR_VALUE, reg]);
          }
          res.push([CLOSE]);
          reg = '';
          state = TEXT;
        } else if (state === TEXT) {
          reg += c;
        } else if (state === OPEN && /\s/.test(c)) {
          res.push([OPEN, reg]);
          reg = '';
          state = ATTR;
        } else if (state === OPEN) {
          reg += c;
        } else if (state === ATTR && /[\w-]/.test(c)) {
          state = ATTR_KEY;
          reg = c;
        } else if (state === ATTR && /\s/.test(c)) {
          if (reg.length) res.push([ATTR_KEY, reg]);
          res.push([ATTR_BREAK]);
        } else if (state === ATTR_KEY && /\s/.test(c)) {
          res.push([ATTR_KEY, reg]);
          reg = '';
          state = ATTR_KEY_W;
        } else if (state === ATTR_KEY && c === '=') {
          res.push([ATTR_KEY, reg], [ATTR_EQ]);
          reg = '';
          state = ATTR_VALUE_W;
        } else if (state === ATTR_KEY) {
          reg += c;
        } else if ((state === ATTR_KEY_W || state === ATTR) && c === '=') {
          res.push([ATTR_EQ]);
          state = ATTR_VALUE_W;
        } else if ((state === ATTR_KEY_W || state === ATTR) && !/\s/.test(c)) {
          res.push([ATTR_BREAK]);
          if (/[\w-]/.test(c)) {
            reg += c;
            state = ATTR_KEY;
          } else state = ATTR;
        } else if (state === ATTR_VALUE_W && c === '"') {
          state = ATTR_VALUE_DQ;
        } else if (state === ATTR_VALUE_W && c === "'") {
          state = ATTR_VALUE_SQ;
        } else if (state === ATTR_VALUE_DQ && c === '"') {
          res.push([ATTR_VALUE, reg], [ATTR_BREAK]);
          reg = '';
          state = ATTR;
        } else if (state === ATTR_VALUE_SQ && c === "'") {
          res.push([ATTR_VALUE, reg], [ATTR_BREAK]);
          reg = '';
          state = ATTR;
        } else if (state === ATTR_VALUE_W && !/\s/.test(c)) {
          state = ATTR_VALUE;
          i--;
        } else if (state === ATTR_VALUE && /\s/.test(c)) {
          res.push([ATTR_VALUE, reg], [ATTR_BREAK]);
          reg = '';
          state = ATTR;
        } else if (state === ATTR_VALUE || state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ) {
          reg += c;
        }
      }
      if (state === TEXT && reg.length) {
        res.push([TEXT, reg]);
        reg = '';
      } else if (state === ATTR_VALUE && reg.length) {
        res.push([ATTR_VALUE, reg]);
        reg = '';
      } else if (state === ATTR_VALUE_DQ && reg.length) {
        res.push([ATTR_VALUE, reg]);
        reg = '';
      } else if (state === ATTR_VALUE_SQ && reg.length) {
        res.push([ATTR_VALUE, reg]);
        reg = '';
      } else if (state === ATTR_KEY) {
        res.push([ATTR_KEY, reg]);
        reg = '';
      }
      return res;
    }
  };

  function strfn(x) {
    if (typeof x === 'function') return x;else if (typeof x === 'string') return x;else if (x && typeof x === 'object') return x;else return concat('', x);
  }
};

function quot(state) {
  return state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ;
}

var hasOwn = Object.prototype.hasOwnProperty;
function has(obj, key) {
  return hasOwn.call(obj, key);
}

var closeRE = RegExp('^(' + ['area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed', 'frame', 'hr', 'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr',
// SVG TAGS
'animate', 'animateTransform', 'circle', 'cursor', 'desc', 'ellipse', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'font-face-format', 'font-face-name', 'font-face-uri', 'glyph', 'glyphRef', 'hkern', 'image', 'line', 'missing-glyph', 'mpath', 'path', 'polygon', 'polyline', 'rect', 'set', 'stop', 'tref', 'use', 'view', 'vkern'].join('|') + ')(?:[\.#][a-zA-Z0-9\u007F-\uFFFF_:-]+)*$');
function selfClosing(tag) {
  return closeRE.test(tag);
}
},{"hyperscript-attribute-to-property":"/Users/adam/projects/backgrounds/node_modules/hyperscript-attribute-to-property/index.js"}],"/Users/adam/projects/backgrounds/node_modules/morphdom/lib/index.js":[function(require,module,exports){
// Create a range object for efficently rendering strings to elements.
var range;

var testEl = typeof document !== 'undefined' ? document.body || document.createElement('div') : {};

var XHTML = 'http://www.w3.org/1999/xhtml';
var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;

// Fixes <https://github.com/patrick-steele-idem/morphdom/issues/32>
// (IE7+ support) <=IE7 does not support el.hasAttribute(name)
var hasAttributeNS;

if (testEl.hasAttributeNS) {
    hasAttributeNS = function (el, namespaceURI, name) {
        return el.hasAttributeNS(namespaceURI, name);
    };
} else if (testEl.hasAttribute) {
    hasAttributeNS = function (el, namespaceURI, name) {
        return el.hasAttribute(name);
    };
} else {
    hasAttributeNS = function (el, namespaceURI, name) {
        return !!el.getAttributeNode(name);
    };
}

function empty(o) {
    for (var k in o) {
        if (o.hasOwnProperty(k)) {
            return false;
        }
    }
    return true;
}

function toElement(str) {
    if (!range && document.createRange) {
        range = document.createRange();
        range.selectNode(document.body);
    }

    var fragment;
    if (range && range.createContextualFragment) {
        fragment = range.createContextualFragment(str);
    } else {
        fragment = document.createElement('body');
        fragment.innerHTML = str;
    }
    return fragment.childNodes[0];
}

var specialElHandlers = {
    /**
     * Needed for IE. Apparently IE doesn't think that "selected" is an
     * attribute when reading over the attributes using selectEl.attributes
     */
    OPTION: function (fromEl, toEl) {
        fromEl.selected = toEl.selected;
        if (fromEl.selected) {
            fromEl.setAttribute('selected', '');
        } else {
            fromEl.removeAttribute('selected', '');
        }
    },
    /**
     * The "value" attribute is special for the <input> element since it sets
     * the initial value. Changing the "value" attribute without changing the
     * "value" property will have no effect since it is only used to the set the
     * initial value.  Similar for the "checked" attribute, and "disabled".
     */
    INPUT: function (fromEl, toEl) {
        fromEl.checked = toEl.checked;
        if (fromEl.checked) {
            fromEl.setAttribute('checked', '');
        } else {
            fromEl.removeAttribute('checked');
        }

        if (fromEl.value !== toEl.value) {
            fromEl.value = toEl.value;
        }

        if (!hasAttributeNS(toEl, null, 'value')) {
            fromEl.removeAttribute('value');
        }

        fromEl.disabled = toEl.disabled;
        if (fromEl.disabled) {
            fromEl.setAttribute('disabled', '');
        } else {
            fromEl.removeAttribute('disabled');
        }
    },

    TEXTAREA: function (fromEl, toEl) {
        var newValue = toEl.value;
        if (fromEl.value !== newValue) {
            fromEl.value = newValue;
        }

        if (fromEl.firstChild) {
            fromEl.firstChild.nodeValue = newValue;
        }
    }
};

function noop() {}

/**
 * Returns true if two node's names and namespace URIs are the same.
 *
 * @param {Element} a
 * @param {Element} b
 * @return {boolean}
 */
var compareNodeNames = function (a, b) {
    return a.nodeName === b.nodeName && a.namespaceURI === b.namespaceURI;
};

/**
 * Create an element, optionally with a known namespace URI.
 *
 * @param {string} name the element name, e.g. 'div' or 'svg'
 * @param {string} [namespaceURI] the element's namespace URI, i.e. the value of
 * its `xmlns` attribute or its inferred namespace.
 *
 * @return {Element}
 */
function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === XHTML ? document.createElement(name) : document.createElementNS(namespaceURI, name);
}

/**
 * Loop over all of the attributes on the target node and make sure the original
 * DOM node has the same attributes. If an attribute found on the original node
 * is not on the new node then remove it from the original node.
 *
 * @param  {Element} fromNode
 * @param  {Element} toNode
 */
function morphAttrs(fromNode, toNode) {
    var attrs = toNode.attributes;
    var i;
    var attr;
    var attrName;
    var attrNamespaceURI;
    var attrValue;
    var fromValue;

    for (i = attrs.length - 1; i >= 0; i--) {
        attr = attrs[i];
        attrName = attr.name;
        attrValue = attr.value;
        attrNamespaceURI = attr.namespaceURI;

        if (attrNamespaceURI) {
            attrName = attr.localName || attrName;
            fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);
        } else {
            fromValue = fromNode.getAttribute(attrName);
        }

        if (fromValue !== attrValue) {
            if (attrNamespaceURI) {
                fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
            } else {
                fromNode.setAttribute(attrName, attrValue);
            }
        }
    }

    // Remove any extra attributes found on the original DOM element that
    // weren't found on the target element.
    attrs = fromNode.attributes;

    for (i = attrs.length - 1; i >= 0; i--) {
        attr = attrs[i];
        if (attr.specified !== false) {
            attrName = attr.name;
            attrNamespaceURI = attr.namespaceURI;

            if (!hasAttributeNS(toNode, attrNamespaceURI, attrNamespaceURI ? attrName = attr.localName || attrName : attrName)) {
                if (attrNamespaceURI) {
                    fromNode.removeAttributeNS(attrNamespaceURI, attr.localName);
                } else {
                    fromNode.removeAttribute(attrName);
                }
            }
        }
    }
}

/**
 * Copies the children of one DOM element to another DOM element
 */
function moveChildren(fromEl, toEl) {
    var curChild = fromEl.firstChild;
    while (curChild) {
        var nextChild = curChild.nextSibling;
        toEl.appendChild(curChild);
        curChild = nextChild;
    }
    return toEl;
}

function defaultGetNodeKey(node) {
    return node.id;
}

function morphdom(fromNode, toNode, options) {
    if (!options) {
        options = {};
    }

    if (typeof toNode === 'string') {
        if (fromNode.nodeName === '#document' || fromNode.nodeName === 'HTML') {
            var toNodeHtml = toNode;
            toNode = document.createElement('html');
            toNode.innerHTML = toNodeHtml;
        } else {
            toNode = toElement(toNode);
        }
    }

    // XXX optimization: if the nodes are equal, don't morph them
    /*
    if (fromNode.isEqualNode(toNode)) {
      return fromNode;
    }
    */

    var savedEls = {}; // Used to save off DOM elements with IDs
    var unmatchedEls = {};
    var getNodeKey = options.getNodeKey || defaultGetNodeKey;
    var onBeforeNodeAdded = options.onBeforeNodeAdded || noop;
    var onNodeAdded = options.onNodeAdded || noop;
    var onBeforeElUpdated = options.onBeforeElUpdated || options.onBeforeMorphEl || noop;
    var onElUpdated = options.onElUpdated || noop;
    var onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop;
    var onNodeDiscarded = options.onNodeDiscarded || noop;
    var onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || options.onBeforeMorphElChildren || noop;
    var childrenOnly = options.childrenOnly === true;
    var movedEls = [];

    function removeNodeHelper(node, nestedInSavedEl) {
        var id = getNodeKey(node);
        // If the node has an ID then save it off since we will want
        // to reuse it in case the target DOM tree has a DOM element
        // with the same ID
        if (id) {
            savedEls[id] = node;
        } else if (!nestedInSavedEl) {
            // If we are not nested in a saved element then we know that this node has been
            // completely discarded and will not exist in the final DOM.
            onNodeDiscarded(node);
        }

        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {
                removeNodeHelper(curChild, nestedInSavedEl || id);
                curChild = curChild.nextSibling;
            }
        }
    }

    function walkDiscardedChildNodes(node) {
        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {

                if (!getNodeKey(curChild)) {
                    // We only want to handle nodes that don't have an ID to avoid double
                    // walking the same saved element.

                    onNodeDiscarded(curChild);

                    // Walk recursively
                    walkDiscardedChildNodes(curChild);
                }

                curChild = curChild.nextSibling;
            }
        }
    }

    function removeNode(node, parentNode, alreadyVisited) {
        if (onBeforeNodeDiscarded(node) === false) {
            return;
        }

        parentNode.removeChild(node);
        if (alreadyVisited) {
            if (!getNodeKey(node)) {
                onNodeDiscarded(node);
                walkDiscardedChildNodes(node);
            }
        } else {
            removeNodeHelper(node);
        }
    }

    function morphEl(fromEl, toEl, alreadyVisited, childrenOnly) {
        var toElKey = getNodeKey(toEl);
        if (toElKey) {
            // If an element with an ID is being morphed then it is will be in the final
            // DOM so clear it out of the saved elements collection
            delete savedEls[toElKey];
        }

        if (!childrenOnly) {
            if (onBeforeElUpdated(fromEl, toEl) === false) {
                return;
            }

            morphAttrs(fromEl, toEl);
            onElUpdated(fromEl);

            if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
                return;
            }
        }

        if (fromEl.nodeName !== 'TEXTAREA') {
            var curToNodeChild = toEl.firstChild;
            var curFromNodeChild = fromEl.firstChild;
            var curToNodeId;

            var fromNextSibling;
            var toNextSibling;
            var savedEl;
            var unmatchedEl;

            outer: while (curToNodeChild) {
                toNextSibling = curToNodeChild.nextSibling;
                curToNodeId = getNodeKey(curToNodeChild);

                while (curFromNodeChild) {
                    var curFromNodeId = getNodeKey(curFromNodeChild);
                    fromNextSibling = curFromNodeChild.nextSibling;

                    if (!alreadyVisited) {
                        if (curFromNodeId && (unmatchedEl = unmatchedEls[curFromNodeId])) {
                            unmatchedEl.parentNode.replaceChild(curFromNodeChild, unmatchedEl);
                            morphEl(curFromNodeChild, unmatchedEl, alreadyVisited);
                            curFromNodeChild = fromNextSibling;
                            continue;
                        }
                    }

                    var curFromNodeType = curFromNodeChild.nodeType;

                    if (curFromNodeType === curToNodeChild.nodeType) {
                        var isCompatible = false;

                        // Both nodes being compared are Element nodes
                        if (curFromNodeType === ELEMENT_NODE) {
                            if (compareNodeNames(curFromNodeChild, curToNodeChild)) {
                                // We have compatible DOM elements
                                if (curFromNodeId || curToNodeId) {
                                    // If either DOM element has an ID then we
                                    // handle those differently since we want to
                                    // match up by ID
                                    if (curToNodeId === curFromNodeId) {
                                        isCompatible = true;
                                    }
                                } else {
                                    isCompatible = true;
                                }
                            }

                            if (isCompatible) {
                                // We found compatible DOM elements so transform
                                // the current "from" node to match the current
                                // target DOM node.
                                morphEl(curFromNodeChild, curToNodeChild, alreadyVisited);
                            }
                            // Both nodes being compared are Text or Comment nodes
                        } else if (curFromNodeType === TEXT_NODE || curFromNodeType == COMMENT_NODE) {
                            isCompatible = true;
                            // Simply update nodeValue on the original node to
                            // change the text value
                            curFromNodeChild.nodeValue = curToNodeChild.nodeValue;
                        }

                        if (isCompatible) {
                            curToNodeChild = toNextSibling;
                            curFromNodeChild = fromNextSibling;
                            continue outer;
                        }
                    }

                    // No compatible match so remove the old node from the DOM
                    // and continue trying to find a match in the original DOM
                    removeNode(curFromNodeChild, fromEl, alreadyVisited);
                    curFromNodeChild = fromNextSibling;
                }

                if (curToNodeId) {
                    if (savedEl = savedEls[curToNodeId]) {
                        if (compareNodeNames(savedEl, curToNodeChild)) {
                            morphEl(savedEl, curToNodeChild, true);
                            // We want to append the saved element instead
                            curToNodeChild = savedEl;
                        } else {
                            delete savedEls[curToNodeId];
                            onNodeDiscarded(savedEl);
                        }
                    } else {
                        // The current DOM element in the target tree has an ID
                        // but we did not find a match in any of the
                        // corresponding siblings. We just put the target
                        // element in the old DOM tree but if we later find an
                        // element in the old DOM tree that has a matching ID
                        // then we will replace the target element with the
                        // corresponding old element and morph the old element
                        unmatchedEls[curToNodeId] = curToNodeChild;
                    }
                }

                // If we got this far then we did not find a candidate match for
                // our "to node" and we exhausted all of the children "from"
                // nodes. Therefore, we will just append the current "to node"
                // to the end
                if (onBeforeNodeAdded(curToNodeChild) !== false) {
                    fromEl.appendChild(curToNodeChild);
                    onNodeAdded(curToNodeChild);
                }

                if (curToNodeChild.nodeType === ELEMENT_NODE && (curToNodeId || curToNodeChild.firstChild)) {
                    // The element that was just added to the original DOM may
                    // have some nested elements with a key/ID that needs to be
                    // matched up with other elements. We'll add the element to
                    // a list so that we can later process the nested elements
                    // if there are any unmatched keyed elements that were
                    // discarded
                    movedEls.push(curToNodeChild);
                }

                curToNodeChild = toNextSibling;
                curFromNodeChild = fromNextSibling;
            }

            // We have processed all of the "to nodes". If curFromNodeChild is
            // non-null then we still have some from nodes left over that need
            // to be removed
            while (curFromNodeChild) {
                fromNextSibling = curFromNodeChild.nextSibling;
                removeNode(curFromNodeChild, fromEl, alreadyVisited);
                curFromNodeChild = fromNextSibling;
            }
        }

        var specialElHandler = specialElHandlers[fromEl.nodeName];
        if (specialElHandler) {
            specialElHandler(fromEl, toEl);
        }
    } // END: morphEl(...)

    var morphedNode = fromNode;
    var morphedNodeType = morphedNode.nodeType;
    var toNodeType = toNode.nodeType;

    if (!childrenOnly) {
        // Handle the case where we are given two DOM nodes that are not
        // compatible (e.g. <div> --> <span> or <div> --> TEXT)
        if (morphedNodeType === ELEMENT_NODE) {
            if (toNodeType === ELEMENT_NODE) {
                if (!compareNodeNames(fromNode, toNode)) {
                    onNodeDiscarded(fromNode);
                    morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI));
                }
            } else {
                // Going from an element node to a text node
                morphedNode = toNode;
            }
        } else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) {
            // Text or comment node
            if (toNodeType === morphedNodeType) {
                morphedNode.nodeValue = toNode.nodeValue;
                return morphedNode;
            } else {
                // Text node to something else
                morphedNode = toNode;
            }
        }
    }

    if (morphedNode === toNode) {
        // The "to node" was not compatible with the "from node" so we had to
        // toss out the "from node" and use the "to node"
        onNodeDiscarded(fromNode);
    } else {
        morphEl(morphedNode, toNode, false, childrenOnly);

        /**
         * What we will do here is walk the tree for the DOM element that was
         * moved from the target DOM tree to the original DOM tree and we will
         * look for keyed elements that could be matched to keyed elements that
         * were earlier discarded.  If we find a match then we will move the
         * saved element into the final DOM tree.
         */
        var handleMovedEl = function (el) {
            var curChild = el.firstChild;
            while (curChild) {
                var nextSibling = curChild.nextSibling;

                var key = getNodeKey(curChild);
                if (key) {
                    var savedEl = savedEls[key];
                    if (savedEl && compareNodeNames(curChild, savedEl)) {
                        curChild.parentNode.replaceChild(savedEl, curChild);
                        // true: already visited the saved el tree
                        morphEl(savedEl, curChild, true);
                        curChild = nextSibling;
                        if (empty(savedEls)) {
                            return false;
                        }
                        continue;
                    }
                }

                if (curChild.nodeType === ELEMENT_NODE) {
                    handleMovedEl(curChild);
                }

                curChild = nextSibling;
            }
        };

        // The loop below is used to possibly match up any discarded
        // elements in the original DOM tree with elemenets from the
        // target tree that were moved over without visiting their
        // children
        if (!empty(savedEls)) {
            handleMovedElsLoop: while (movedEls.length) {
                var movedElsTemp = movedEls;
                movedEls = [];
                for (var i = 0; i < movedElsTemp.length; i++) {
                    if (handleMovedEl(movedElsTemp[i]) === false) {
                        // There are no more unmatched elements so completely end
                        // the loop
                        break handleMovedElsLoop;
                    }
                }
            }
        }

        // Fire the "onNodeDiscarded" event for any saved elements
        // that never found a new home in the morphed DOM
        for (var savedElId in savedEls) {
            if (savedEls.hasOwnProperty(savedElId)) {
                var savedEl = savedEls[savedElId];
                onNodeDiscarded(savedEl);
                walkDiscardedChildNodes(savedEl);
            }
        }
    }

    if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
        // If we had to swap out the from node with a new node because the old
        // node was not compatible with the target node then we need to
        // replace the old DOM node in the original DOM tree. This is only
        // possible if the original DOM node was part of a DOM tree which
        // we know is the case if it has a parent node.
        fromNode.parentNode.replaceChild(morphedNode, fromNode);
    }

    return morphedNode;
}

module.exports = morphdom;
},{}],"/Users/adam/projects/backgrounds/node_modules/nanoraf/index.js":[function(require,module,exports){
var window = require('global/window');
var assert = require('assert');

module.exports = nanoraf;

// Only call RAF when needed
// (fn, fn?) -> fn
function nanoraf(render, raf) {
  assert.equal(typeof render, 'function', 'nanoraf: render should be a function');
  assert.ok(typeof raf === 'function' || typeof raf === 'undefined', 'nanoraf: raf should be a function or undefined');

  if (!raf) {
    raf = window.requestAnimationFrame;
  }

  var inRenderingTransaction = false;
  var redrawScheduled = false;
  var currentState = null;

  // pass new state to be rendered
  // (obj, obj?) -> null
  return function frame(state, prev) {
    assert.equal(typeof state, 'object', 'nanoraf: state should be an object');
    assert.equal(typeof prev, 'object', 'nanoraf: prev should be an object');
    assert.equal(inRenderingTransaction, false, 'nanoraf: infinite loop detected');

    // request a redraw for next frame
    if (currentState === null && !redrawScheduled) {
      redrawScheduled = true;

      raf(function redraw() {
        redrawScheduled = false;
        if (!currentState) return;

        inRenderingTransaction = true;
        render(currentState, prev);
        inRenderingTransaction = false;

        currentState = null;
      });
    }

    // update data for redraw
    currentState = state;
  };
}
},{"assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","global/window":"/Users/adam/projects/backgrounds/node_modules/global/window.js"}],"/Users/adam/projects/backgrounds/node_modules/on-load/index.js":[function(require,module,exports){
/* global MutationObserver */
var document = require('global/document');
var window = require('global/window');
var watch = Object.create(null);
var KEY_ID = 'onloadid' + (new Date() % 9e6).toString(36);
var KEY_ATTR = 'data-' + KEY_ID;
var INDEX = 0;

if (window && window.MutationObserver) {
  var observer = new MutationObserver(function (mutations) {
    if (Object.keys(watch).length < 1) return;
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === KEY_ATTR) {
        eachAttr(mutations[i], turnon, turnoff);
        continue;
      }
      eachMutation(mutations[i].removedNodes, turnoff);
      eachMutation(mutations[i].addedNodes, turnon);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [KEY_ATTR]
  });
}

module.exports = function onload(el, on, off, caller) {
  on = on || function () {};
  off = off || function () {};
  el.setAttribute(KEY_ATTR, 'o' + INDEX);
  watch['o' + INDEX] = [on, off, 0, caller || onload.caller];
  INDEX += 1;
  return el;
};

function turnon(index, el) {
  if (watch[index][0] && watch[index][2] === 0) {
    watch[index][0](el);
    watch[index][2] = 1;
  }
}

function turnoff(index, el) {
  if (watch[index][1] && watch[index][2] === 1) {
    watch[index][1](el);
    watch[index][2] = 0;
  }
}

function eachAttr(mutation, on, off) {
  var newValue = mutation.target.getAttribute(KEY_ATTR);
  if (sameOrigin(mutation.oldValue, newValue)) {
    watch[newValue] = watch[mutation.oldValue];
    return;
  }
  if (watch[mutation.oldValue]) {
    off(mutation.oldValue, mutation.target);
  }
  if (watch[newValue]) {
    on(newValue, mutation.target);
  }
}

function sameOrigin(oldValue, newValue) {
  if (!oldValue || !newValue) return false;
  return watch[oldValue][3] === watch[newValue][3];
}

function eachMutation(nodes, fn) {
  var keys = Object.keys(watch);
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] && nodes[i].getAttribute && nodes[i].getAttribute(KEY_ATTR)) {
      var onloadid = nodes[i].getAttribute(KEY_ATTR);
      keys.forEach(function (k) {
        if (onloadid === k) {
          fn(k, nodes[i]);
        }
      });
    }
    if (nodes[i].childNodes.length > 0) {
      eachMutation(nodes[i].childNodes, fn);
    }
  }
}
},{"global/document":"/Users/adam/projects/backgrounds/node_modules/global/document.js","global/window":"/Users/adam/projects/backgrounds/node_modules/global/window.js"}],"/Users/adam/projects/backgrounds/node_modules/pathname-match/index.js":[function(require,module,exports){
var assert = require('assert');

module.exports = match;

// get url path section from a url
// strip querystrings / hashes
// strip protocol
// strip hostname and port (both ip and route)
// str -> str
function match(route) {
  assert.equal(typeof route, 'string');

  return route.trim().replace(/[\?|#].*$/, '').replace(/^(?:https?\:)\/\//, '').replace(/^(?:[\w+(?:-\w+)+.])+(?:[\:0-9]{4,5})?/, '').replace(/\/$/, '');
}
},{"assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js"}],"/Users/adam/projects/backgrounds/node_modules/sheet-router/hash.js":[function(require,module,exports){
var window = require('global/window');
var assert = require('assert');

module.exports = hash;

// listen to window hashchange events
// and update router accordingly
// fn(cb) -> null
function hash(cb) {
  assert.equal(typeof cb, 'function', 'cb must be a function');
  window.onhashchange = function (e) {
    cb(window.location.hash);
  };
}
},{"assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","global/window":"/Users/adam/projects/backgrounds/node_modules/global/window.js"}],"/Users/adam/projects/backgrounds/node_modules/sheet-router/history.js":[function(require,module,exports){
var document = require('global/document');
var window = require('global/window');
var assert = require('assert');

module.exports = history;

// listen to html5 pushstate events
// and update router accordingly
// fn(str) -> null
function history(cb) {
  assert.equal(typeof cb, 'function', 'cb must be a function');
  window.onpopstate = function () {
    cb(document.location.href);
  };
}
},{"assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","global/document":"/Users/adam/projects/backgrounds/node_modules/global/document.js","global/window":"/Users/adam/projects/backgrounds/node_modules/global/window.js"}],"/Users/adam/projects/backgrounds/node_modules/sheet-router/href.js":[function(require,module,exports){
var window = require('global/window');
var assert = require('assert');

module.exports = href;

// handle a click if is anchor tag with an href
// and url lives on the same domain. Replaces
// trailing '#' so empty links work as expected.
// fn(str) -> null
function href(cb) {
  assert.equal(typeof cb, 'function', 'cb must be a function');

  window.onclick = function (e) {
    var node = function traverse(node) {
      if (!node) return;
      if (node.localName !== 'a') return traverse(node.parentNode);
      if (node.href === undefined) return traverse(node.parentNode);
      if (window.location.host !== node.host) return traverse(node.parentNode);
      return node;
    }(e.target);

    if (!node) return;

    e.preventDefault();
    var href = node.href.replace(/#$/, '');
    cb(href);
    window.history.pushState({}, null, href);
  };
}
},{"assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","global/window":"/Users/adam/projects/backgrounds/node_modules/global/window.js"}],"/Users/adam/projects/backgrounds/node_modules/sheet-router/index.js":[function(require,module,exports){
var pathname = require('pathname-match');
var wayfarer = require('wayfarer');
var assert = require('assert');

module.exports = sheetRouter;

// Fast, modular client router
// fn(str, any[..], fn?) -> fn(str, any[..])
function sheetRouter(dft, createTree, createRoute) {
  createRoute = createRoute ? createRoute(_createRoute) : _createRoute;

  if (!createTree) {
    createTree = dft;
    dft = '';
  }

  assert.equal(typeof dft, 'string', 'sheet-router: dft must be a string');
  assert.equal(typeof createTree, 'function', 'sheet-router: createTree must be a function');
  assert.equal(typeof createRoute, 'function', 'sheet-router: createRoute must be a function');

  var router = wayfarer(dft);
  var tree = createTree(createRoute)

  // register tree in router
  ;(function walk(tree, route) {
    if (Array.isArray(tree[0])) {
      // walk over all routes at the root of the tree
      tree.forEach(function (node) {
        walk(node, route);
      });
    } else if (tree[1]) {
      // handle inline functions as args
      var innerRoute = tree[0] ? route.concat(tree[0]).join('/') : route.length ? route.join('/') : tree[0];
      router.on(innerRoute, tree[1]);
      walk(tree[2], route.concat(tree[0]));
    } else if (Array.isArray(tree[2])) {
      // traverse and append route
      walk(tree[2], route.concat(tree[0]));
    } else {
      // register path in router
      var nwRoute = tree[0] ? route.concat(tree[0]).join('/') : route.length ? route.join('/') : tree[0];
      router.on(nwRoute, tree[2]);
    }
  })(tree, []);

  // match a route on the router
  return function match(route) {
    assert.equal(typeof route, 'string', 'route must be a string');
    var args = [].slice.call(arguments);
    args[0] = pathname(args[0]);
    return router.apply(null, args);
  };
}

// register regular route
function _createRoute(route, inline, child) {
  if (!child) {
    child = inline;
    inline = null;
  }
  assert.equal(typeof route, 'string', 'route must be a string');
  assert.ok(child, 'child exists');
  route = route.replace(/^\//, '');
  return [route, inline, child];
}
},{"assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","pathname-match":"/Users/adam/projects/backgrounds/node_modules/pathname-match/index.js","wayfarer":"/Users/adam/projects/backgrounds/node_modules/wayfarer/index.js"}],"/Users/adam/projects/backgrounds/node_modules/wayfarer/index.js":[function(require,module,exports){
var assert = require('assert');
var trie = require('./trie');

module.exports = Wayfarer;

// create a router
// str -> obj
function Wayfarer(dft) {
  if (!(this instanceof Wayfarer)) return new Wayfarer(dft);

  var _default = (dft || '').replace(/^\//, '');
  var _trie = trie();

  emit._trie = _trie;
  emit.emit = emit;
  emit.on = on;
  emit._wayfarer = true;

  return emit;

  // define a route
  // (str, fn) -> obj
  function on(route, cb) {
    assert.equal(typeof route, 'string');
    assert.equal(typeof cb, 'function');

    route = route || '/';

    if (cb && cb._wayfarer && cb._trie) {
      _trie.mount(route, cb._trie.trie);
    } else {
      var node = _trie.create(route);
      node.cb = cb;
    }

    return emit;
  }

  // match and call a route
  // (str, obj?) -> null
  function emit(route) {
    assert.notEqual(route, undefined, "'route' must be defined");
    var args = Array.prototype.slice.apply(arguments);

    var node = _trie.match(route);
    if (node && node.cb) {
      args[0] = node.params;
      return node.cb.apply(null, args);
    }

    var dft = _trie.match(_default);
    if (dft && dft.cb) {
      args[0] = dft.params;
      return dft.cb.apply(null, args);
    }

    throw new Error("route '" + route + "' did not match");
  }
}
},{"./trie":"/Users/adam/projects/backgrounds/node_modules/wayfarer/trie.js","assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js"}],"/Users/adam/projects/backgrounds/node_modules/wayfarer/trie.js":[function(require,module,exports){
var mutate = require('xtend/mutable');
var assert = require('assert');
var xtend = require('xtend');

module.exports = Trie;

// create a new trie
// null -> obj
function Trie() {
  if (!(this instanceof Trie)) return new Trie();
  this.trie = { nodes: {} };
}

// create a node on the trie at route
// and return a node
// str -> null
Trie.prototype.create = function (route) {
  assert.equal(typeof route, 'string', 'route should be a string');
  // strip leading '/' and split routes
  var routes = route.replace(/^\//, '').split('/');
  return function createNode(index, trie, routes) {
    var route = routes[index];

    if (route === undefined) return trie;

    var node = null;
    if (/^:/.test(route)) {
      // if node is a name match, set name and append to ':' node
      if (!trie.nodes['$$']) {
        node = { nodes: {} };
        trie.nodes['$$'] = node;
      } else {
        node = trie.nodes['$$'];
      }
      trie.name = route.replace(/^:/, '');
    } else if (!trie.nodes[route]) {
      node = { nodes: {} };
      trie.nodes[route] = node;
    } else {
      node = trie.nodes[route];
    }

    // we must recurse deeper
    return createNode(index + 1, node, routes);
  }(0, this.trie, routes);
};

// match a route on the trie
// and return the node
// str -> obj
Trie.prototype.match = function (route) {
  assert.equal(typeof route, 'string', 'route should be a string');

  var routes = route.replace(/^\//, '').split('/');
  var params = {};

  var node = function search(index, trie) {
    // either there's no match, or we're done searching
    if (trie === undefined) return undefined;
    var route = routes[index];
    if (route === undefined) return trie;

    if (trie.nodes[route]) {
      // match regular routes first
      return search(index + 1, trie.nodes[route]);
    } else if (trie.name) {
      // match named routes
      params[trie.name] = route;
      return search(index + 1, trie.nodes['$$']);
    } else {
      // no matches found
      return search(index + 1);
    }
  }(0, this.trie);

  if (!node) return undefined;
  node = xtend(node);
  node.params = params;
  return node;
};

// mount a trie onto a node at route
// (str, obj) -> null
Trie.prototype.mount = function (route, trie) {
  assert.equal(typeof route, 'string', 'route should be a string');
  assert.equal(typeof trie, 'object', 'trie should be a object');

  var split = route.replace(/^\//, '').split('/');
  var node = null;
  var key = null;

  if (split.length === 1) {
    key = split[0];
    node = this.create(key);
  } else {
    var headArr = split.splice(0, split.length - 1);
    var head = headArr.join('/');
    key = split[0];
    node = this.create(head);
  }

  mutate(node.nodes, trie.nodes);
  if (trie.name) node.name = trie.name;

  // delegate properties from '/' to the new node
  // '/' cannot be reached once mounted
  if (node.nodes['']) {
    Object.keys(node.nodes['']).forEach(function (key) {
      if (key === 'nodes') return;
      node[key] = node.nodes[''][key];
    });
    mutate(node.nodes, node.nodes[''].nodes);
    delete node.nodes[''].nodes;
  }
};
},{"assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","xtend":"/Users/adam/projects/backgrounds/node_modules/xtend/immutable.js","xtend/mutable":"/Users/adam/projects/backgrounds/node_modules/xtend/mutable.js"}],"/Users/adam/projects/backgrounds/node_modules/xtend/immutable.js":[function(require,module,exports){
module.exports = extend;

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {};

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key];
            }
        }
    }

    return target;
}
},{}],"/Users/adam/projects/backgrounds/node_modules/xtend/mutable.js":[function(require,module,exports){
module.exports = extend;

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key];
            }
        }
    }

    return target;
}
},{}],"/Users/adam/projects/backgrounds/node_modules/yo-yo/index.js":[function(require,module,exports){
var bel = require('bel'); // turns template tag into DOM elements
var morphdom = require('morphdom'); // efficiently diffs + morphs two DOM elements
var defaultEvents = require('./update-events.js'); // default events to be copied when dom elements update

module.exports = bel;

// TODO move this + defaultEvents to a new module once we receive more feedback
module.exports.update = function (fromNode, toNode, opts) {
  if (!opts) opts = {};
  if (opts.events !== false) {
    if (!opts.onBeforeMorphEl) opts.onBeforeMorphEl = copier;
  }

  return morphdom(fromNode, toNode, opts);

  // morphdom only copies attributes. we decided we also wanted to copy events
  // that can be set via attributes
  function copier(f, t) {
    // copy events:
    var events = opts.events || defaultEvents;
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (t[ev]) {
        // if new element has a whitelisted attribute
        f[ev] = t[ev]; // update existing element
      } else if (f[ev]) {
        // if existing element has it and new one doesnt
        f[ev] = undefined; // remove it from existing element
      }
    }
    // copy values for form elements
    if (f.nodeName === 'INPUT' && f.type !== 'file' || f.nodeName === 'TEXTAREA' || f.nodeName === 'SELECT') {
      if (t.getAttribute('value') === null) t.value = f.value;
    }
  }
};
},{"./update-events.js":"/Users/adam/projects/backgrounds/node_modules/yo-yo/update-events.js","bel":"/Users/adam/projects/backgrounds/node_modules/bel/index.js","morphdom":"/Users/adam/projects/backgrounds/node_modules/morphdom/lib/index.js"}],"/Users/adam/projects/backgrounds/node_modules/yo-yo/update-events.js":[function(require,module,exports){
module.exports = [
// attribute events (can be set with attributes)
'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onmousemove', 'onmouseout', 'ondragstart', 'ondrag', 'ondragenter', 'ondragleave', 'ondragover', 'ondrop', 'ondragend', 'onkeydown', 'onkeypress', 'onkeyup', 'onunload', 'onabort', 'onerror', 'onresize', 'onscroll', 'onselect', 'onchange', 'onsubmit', 'onreset', 'onfocus', 'onblur', 'oninput',
// other common events
'oncontextmenu', 'onfocusin', 'onfocusout'];
},{}],"/Users/adam/projects/backgrounds/src/app.js":[function(require,module,exports){
var TextureGenerator = require("./generator");
var GeneratorModel = require("./models/texture_generator");

var choo = require("choo");
var app = choo();

app.router("/", function (route) {
  return [route("/", require('./views/main'), [route('/about', require('./views/about'))])];
});

window.startApp = function () {
  var textureGenerator = TextureGenerator({
    canvasId: "c",
    resolution: 256
  });

  app.model(GeneratorModel(textureGenerator, require('./presets'), require('./kernels')));

  var tree = app.start({ history: false, hash: true });
  document.body.appendChild(tree);
};
},{"./generator":"/Users/adam/projects/backgrounds/src/generator.js","./kernels":"/Users/adam/projects/backgrounds/src/kernels.js","./models/texture_generator":"/Users/adam/projects/backgrounds/src/models/texture_generator.js","./presets":"/Users/adam/projects/backgrounds/src/presets.js","./views/about":"/Users/adam/projects/backgrounds/src/views/about.js","./views/main":"/Users/adam/projects/backgrounds/src/views/main.js","choo":"/Users/adam/projects/backgrounds/node_modules/choo/index.js"}],"/Users/adam/projects/backgrounds/src/generator.js":[function(require,module,exports){
var GLUtils = {
  // GL -> ProgramType -> DOM ID -> Shader
  compileShader: function (gl, programType, domId) {
    var shaderScript = document.getElementById(domId),
        shaderSource = shaderScript.text,
        shader = gl.createShader(programType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
      throw "could not compile shader:" + gl.getShaderInfoLog(shader);
    }
    return shader;
  },
  // GL -> Shader -> Shader -> Program
  makeProgram: function (gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    return program;
  },
  // GL -> Program -> Void
  linkProgram: function (gl, program) {
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
      throw "program failed to link:" + gl.getProgramInfoLog(program);
    }
    gl.useProgram(program);
  }
};

function createAndSetupTexture(gl) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  return texture;
}

function randomCanvas(size) {
  var canvas = document.createElement("canvas"),
      ctx = canvas.getContext('2d');

  canvas.width = size;
  canvas.height = size;

  var imgdata = ctx.createImageData(canvas.width, canvas.height),
      data = imgdata.data;

  for (var i = 0; i < data.length; i += 4) {
    var h = Math.random() * 255;
    data[i] = Math.random() * 255;
    data[i + 1] = Math.random() * 255;
    data[i + 2] = Math.random() * 255;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgdata, 0, 0);
  return canvas;
}

function TextureGenerator(options) {
  function setFramebuffer(fbo, width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.uniform1f(resolutionLocation, canvas.width);
    gl.viewport(0, 0, width, height);
  }

  function drawWithKernel(filter) {
    setFramebuffer(framebuffers[currentFbo], canvas.width, canvas.height);
    gl.uniform1fv(kernelLocation, filter);
    gl.uniform1f(yFlipLocation, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindTexture(gl.TEXTURE_2D, textures[currentFbo]);
    currentFbo = (currentFbo + 1) % 2;
  }

  var options = options || {},
      canvas = document.getElementById(options.canvasId || 'c'),
      isRunning = true,
      resolution = options.resolution || 512;

  canvas.width = resolution;
  canvas.height = resolution;

  var gl = canvas.getContext('experimental-webgl'),
      buffer = gl.createBuffer(),
      convolveShader = GLUtils.compileShader(gl, gl.FRAGMENT_SHADER, '2d-fragment-shader'),
      vertexShader = GLUtils.compileShader(gl, gl.VERTEX_SHADER, '2d-vertex-shader'),
      program = GLUtils.makeProgram(gl, vertexShader, convolveShader),
      positionLocation,
      resolutionLocation,
      currentFbo = 0,
      originalImageTexture = createAndSetupTexture(gl),
      textures = [],
      framebuffers = [];

  function reset() {
    var noiseCanvas = randomCanvas(resolution),
        image = document.createElement("img");

    image.width = resolution;
    image.height = resolution;
    image.src = noiseCanvas.toDataURL();
    image.style.display = "none";

    document.body.appendChild(image);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  for (var ii = 0; ii < 2; ++ii) {
    var texture = createAndSetupTexture(gl),
        fbo = gl.createFramebuffer();

    textures.push(texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, resolution, resolution, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    framebuffers.push(fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, originalImageTexture);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), gl.STATIC_DRAW);

  GLUtils.linkProgram(gl, program);
  positionLocation = gl.getAttribLocation(program, "a_position");
  resolutionLocation = gl.getUniformLocation(program, "canvasPixels");
  kernelLocation = gl.getUniformLocation(program, "kernel");
  yFlipLocation = gl.getUniformLocation(program, "yFlip");

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(gl.getUniformLocation(program, "uSampler"), 0);
  gl.uniform1f(resolutionLocation, parseFloat(resolution));

  reset();
  return {
    isRunning: isRunning,
    reset: reset,

    hide: function () {
      canvas.style.visibility = "hidden";
    },

    show: function () {
      canvas.style.visibility = "visible";
    },

    drawWithKernel: drawWithKernel,
    render: function () {
      setFramebuffer(null, canvas.width, canvas.height);
      gl.uniform1f(yFlipLocation, -1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    canvas: canvas
  };
}

module.exports = TextureGenerator;
},{}],"/Users/adam/projects/backgrounds/src/kernels.js":[function(require,module,exports){
module.exports = {
  normal: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  edge2: [1, 0, -1, 0, 0, 0, -1, 0, 1],
  edge1: [0, 1, 0, 1, -4, 1, 0, 1, 0],
  edge: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
  sharpen: [0, -1, 0, -1, 4, -1, 0, -1, 0],
  gaussian: [1, 2, 1, 2, 4, 2, 1, 2, 1].map(function (e) {
    return e / 16.;
  }),
  smooth: [1 / 9., 1 / 9., 1 / 9., 1 / 9., 1 / 9., 1 / 9., 1 / 9., 1 / 9., 1 / 9.],
  emboss: [-2, -1, 0, -1, 1, 1, 0, 1, 2],
  gradientV: [1, 1, 1, 0, 0, 0, -1, -1, -1],
  gradientH: [1, 0, -1, 1, 0, -1, 1, 0, -1]

};
},{}],"/Users/adam/projects/backgrounds/src/models/texture_generator.js":[function(require,module,exports){
module.exports = function (textureGenerator, presets, kernels) {
  return {
    state: {
      isTiled: true,
      currentPreset: "coral",
      kernelsToApply: presets["coral"],
      presets: presets,
      kernels: kernels,
      isRunning: true
    },
    subscriptions: [function (send, done) {
      var animate = function () {
        requestAnimationFrame(animate);
        send("update", undefined, done);
        send("render", undefined, done);
      };
      animate();
      done();
    }],
    effects: {
      update: function (data, state, send, done) {
        if (state.isRunning) {
          for (var kernelToApply of state.kernelsToApply) {
            var { _, kernel } = kernelToApply;
            textureGenerator.drawWithKernel(kernel);
          }
        }
        if (state.isTiled && state.isRunning) {
          textureGenerator.hide();
        } else {
          textureGenerator.show();
        }
        done();
      },
      reset: function (data, state, send, done) {
        textureGenerator.reset();
        done();
      },
      render: function (data, state, send, done) {
        textureGenerator.render();
        if (state.isTiled) {
          var body = document.getElementsByTagName("body")[0];
          body.setAttribute("style", "background-image: url(" + textureGenerator.canvas.toDataURL() + ")");
        }
        done();
      }
    },
    reducers: {
      setTiled: function (data) {
        return {
          isTiled: data
        };
      },
      setRunning: function (data) {
        return {
          isRunning: data
        };
      },
      removeKernel: function (index, state) {
        return {
          kernelsToApply: state.kernelsToApply.slice(0, index).concat(state.kernelsToApply.slice(index + 1))
        };
      },
      addKernel: function (kernel, state) {
        return {
          kernelsToApply: state.kernelsToApply.concat([kernel])
        };
      },
      setPreset: function (preset) {
        return {
          currentPreset: preset,
          kernelsToApply: presets[preset]
        };
      }
    }
  };
};
},{}],"/Users/adam/projects/backgrounds/src/presets.js":[function(require,module,exports){
var kernels = require("./kernels");
var getKernel = function (kernelName) {
  return {
    name: kernelName,
    kernel: kernels[kernelName]
  };
};

module.exports = {
  empty: [],
  coral: ["edge1", "smooth"].map(getKernel),
  game_of_lifey_bugs: ["smooth", "sharpen"].map(getKernel),
  scritchy: ["emboss", "smooth", "gaussian", "edge"].map(getKernel),
  brownian: ["gaussian", "smooth", "edge", "gaussian"].map(getKernel),

  space_invaders: ["normal", "smooth", "gradientV", "smooth", "smooth", "smooth", "smooth"].map(getKernel),

  worm_matrix: ["gradientH", "gaussian", "gaussian", "gaussian", "gaussian", "gaussian", "edge", "smooth"].map(getKernel),

  terraces: ["gaussian", "edge1", "edge2", "sharpen"].map(getKernel)
};
},{"./kernels":"/Users/adam/projects/backgrounds/src/kernels.js"}],"/Users/adam/projects/backgrounds/src/views/about.js":[function(require,module,exports){
var _templateObject = _taggedTemplateLiteral(["\n<div class=\"about\">\n  <a role=\"top-nav\" href=\"#\">Back</a>\n  <h1>About</h1>\n  <p>\n    This here thing takes a bunch of convolution kernels and continually applies them to a bitmap, mapping rgb values to hsv and back again.  It makes some pretty patterns sometimes!\n  </p>\n  <p>\n    You can click on one of the available kernels to add it to the stack of kernels that get applied each frame.\n  </p>\n  <p>\n    \"Reset to noise\" will effectively \"start over\" if your display goes black.  \"pause / snapshot\" shows you the current canvas state stops iterating and shows you the current state of the canvas so you can right click and save it as an image.\n  </p>\n  <p>\n     Since these textures are generated on a toroidal surface, they should work as tileable images for like backgrounds or something?\n  </p>\n<h1>Usage</h1>\n <p>Click on things; see what happens.</p>\n</div>"], ["\n<div class=\"about\">\n  <a role=\"top-nav\" href=\"#\">Back</a>\n  <h1>About</h1>\n  <p>\n    This here thing takes a bunch of convolution kernels and continually applies them to a bitmap, mapping rgb values to hsv and back again.  It makes some pretty patterns sometimes!\n  </p>\n  <p>\n    You can click on one of the available kernels to add it to the stack of kernels that get applied each frame.\n  </p>\n  <p>\n    \"Reset to noise\" will effectively \"start over\" if your display goes black.  \"pause / snapshot\" shows you the current canvas state stops iterating and shows you the current state of the canvas so you can right click and save it as an image.\n  </p>\n  <p>\n     Since these textures are generated on a toroidal surface, they should work as tileable images for like backgrounds or something?\n  </p>\n<h1>Usage</h1>\n <p>Click on things; see what happens.</p>\n</div>"]);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var html = require("choo/html");

module.exports = function (state, prev, send) {
  return html(_templateObject);
};
},{"choo/html":"/Users/adam/projects/backgrounds/node_modules/choo/html.js"}],"/Users/adam/projects/backgrounds/src/views/main.js":[function(require,module,exports){
var _templateObject = _taggedTemplateLiteral(['\n<div class="kernel" onclick=', '>\n  <pre class="kernel-matrix">', '</pre>\n  <strong>', '</strong>\n</div>\n'], ['\n<div class="kernel" onclick=', '>\n  <pre class="kernel-matrix">', '</pre>\n  <strong>', '</strong>\n</div>\n']),
    _templateObject2 = _taggedTemplateLiteral(['\n   <div role="menu">\n     <a role="top-nav" href="#/about/">About</a>\n     <h3>Presets</h3>\n     <select onchange=', '>\n       ', '\n     </select>\n     <h3>Available Kernels</h3>\n     <ul>\n       ', '\n     </ul>\n     <h3>Applied Kernels</h3>\n     <ul class="applied-kernels">\n       ', '\n     </ul>\n     <button onclick=', '>reset to noise</button>\n     <button onclick=', '>', '</button>\n   </div>\n'], ['\n   <div role="menu">\n     <a role="top-nav" href="#/about/">About</a>\n     <h3>Presets</h3>\n     <select onchange=', '>\n       ', '\n     </select>\n     <h3>Available Kernels</h3>\n     <ul>\n       ', '\n     </ul>\n     <h3>Applied Kernels</h3>\n     <ul class="applied-kernels">\n       ', '\n     </ul>\n     <button onclick=', '>reset to noise</button>\n     <button onclick=', '>', '</button>\n   </div>\n']),
    _templateObject3 = _taggedTemplateLiteral(['<option selected=', ' value=', '>', '</option>'], ['<option selected=', ' value=', '>', '</option>']),
    _templateObject4 = _taggedTemplateLiteral(['\n       <li onclick=', '>', '</li>\n       '], ['\n       <li onclick=', '>', '</li>\n       ']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var html = require("choo/html");

var kernelElement = function (name, kernel, onclick) {
  return html(_templateObject, onclick, kernel.map(function (e, i) {
    return e.toFixed(2) + ((i + 1) % 3 == 0 ? '\n' : ' ');
  }), name);
};

module.exports = function (state, prev, send) {
  var onKernelClick = function (kernelName) {
    return function () {
      return send("addKernel", { "name": kernelName, "kernel": state.kernels[kernelName] });
    };
  };
  return html(_templateObject2, function (e) {
    return send("setPreset", e.target.value);
  }, Object.keys(state.presets).map(function (preset) {
    return html(_templateObject3, preset === state.currentPreset, preset, preset);
  }), Object.keys(state.kernels).map(function (kernelName) {
    return kernelElement(kernelName, state.kernels[kernelName], onKernelClick(kernelName));
  }), state.kernelsToApply.map(function (kernel, index) {
    return html(_templateObject4, function () {
      return send("removeKernel", index);
    }, kernel.name);
  }), function (_) {
    return send("reset");
  }, function (_) {
    return send("setRunning", !state.isRunning);
  }, state.isRunning ? "pause / snapshot" : "continue");
};
},{"choo/html":"/Users/adam/projects/backgrounds/node_modules/choo/html.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js":[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && !isFinite(value)) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' + self.operator + ' ' + truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

    // 7.2. If the expected value is a Date object, the actual value is
    // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

    // 7.3 If the expected value is a RegExp object, the actual value is
    // equivalent if it is also a RegExp object with the same source and
    // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source && actual.global === expected.global && actual.multiline === expected.multiline && actual.lastIndex === expected.lastIndex && actual.ignoreCase === expected.ignoreCase;

    // 7.4. Other pairs that do not both pass typeof value == 'object',
    // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

    // 7.5 For all other Object pairs, including Array objects, equivalence is
    // determined by having the same number of owned properties (as verified
    // with Object.prototype.hasOwnProperty.call), the same set of keys
    // (although not necessarily the same order), equivalent values for every
    // corresponding key, and an identical 'prototype' property. Note: this
    // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b)) return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b)) {
    return a === b;
  }
  var aIsArgs = isArguments(a),
      bIsArgs = isArguments(b);
  if (aIsArgs && !bIsArgs || !aIsArgs && bIsArgs) return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  var ka = objectKeys(a),
      kb = objectKeys(b),
      key,
      i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length) return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i]) return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') + (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if (shouldThrow && actual && expected && !expectedException(actual, expected) || !shouldThrow && actual) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function (block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function (block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function (err) {
  if (err) {
    throw err;
  }
};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};
},{"util/":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js":[function(require,module,exports){

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js":[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  };
}
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js":[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while (len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () {
    return '/';
};
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function () {
    return 0;
};
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/support/isBufferBrowser.js":[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object' && typeof arg.copy === 'function' && typeof arg.fill === 'function' && typeof arg.readUInt8 === 'function';
};
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js":[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function (f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function (x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s':
        return String(args[i++]);
      case '%d':
        return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};

// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function (fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function () {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};

var debugs = {};
var debugEnviron;
exports.debuglog = function (set) {
  if (isUndefined(debugEnviron)) debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function () {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function () {};
    }
  }
  return debugs[set];
};

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;

// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold': [1, 22],
  'italic': [3, 23],
  'underline': [4, 24],
  'inverse': [7, 27],
  'white': [37, 39],
  'grey': [90, 39],
  'black': [30, 39],
  'blue': [34, 39],
  'cyan': [36, 39],
  'green': [32, 39],
  'magenta': [35, 39],
  'red': [31, 39],
  'yellow': [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};

function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str + '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}

function stylizeNoColor(str, styleType) {
  return str;
}

function arrayToHash(array) {
  var hash = {};

  array.forEach(function (val, idx) {
    hash[val] = true;
  });

  return hash;
}

function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect && value && isFunction(value.inspect) &&
  // Filter out the util module, it's inspect function is special
  value.inspect !== exports.inspect &&
  // Also filter out any prototype objects using the circular check.
  !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value) && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '',
      array = false,
      braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function (key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}

function formatPrimitive(ctx, value) {
  if (isUndefined(value)) return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '').replace(/'/g, "\\'").replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value)) return ctx.stylize('' + value, 'number');
  if (isBoolean(value)) return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value)) return ctx.stylize('null', 'null');
}

function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}

function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function (key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
    }
  });
  return output;
}

function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function (line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function (line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}

function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function (prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] + (base === '' ? '' : base + '\n ') + ' ' + output.join(',\n  ') + ' ' + braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) && (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'symbol' || // ES6 symbol
  typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function () {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};

/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function (origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/support/isBufferBrowser.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","inherits":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js"}]},{},["/Users/adam/projects/backgrounds/src/app.js"]);
