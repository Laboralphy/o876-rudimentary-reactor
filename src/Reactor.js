const DependencyRegistry = require('./DependencyRegistry')
/**
 * This class is an implementation of Vue.js reactivity system
 * as it is described at : https://v3.vuejs.org/guide/reactivity.html
 * @author Raphaël Marandet
 * @date 2021-07-29
 *
 * read README.md for "how to use"
 */

/**
 * these are the Array methods that are to be tracked in order to
 * maintain reactivity
 */
const ARRAY_TRACKED_METHODS = filterArrayFunction([
  'at',
  'concat',
  'entries',
  'every',
  'filter',
  'find',
  'findIndex',
  'flat',
  'flatMap',
  'forEach',
  'includes',
  'indexOf',
  'join',
  'keys',
  'lastIndexOf',
  'map',
  'reduce',
  'reduceRight',
  'slice',
  'some',
  'toLocaleString',
  'toString',
  'values'
])

/**
 * these Array methods triggers cache invalidation on dependent getters
 */
const ARRAY_TRIGGERED_METHODS = filterArrayFunction([
  'copyWithin',
  'fill',
  'push',
  'pop',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift'
])

const Events = require('events')

const REACTOR_NAMESPACE = '**O876_REACTOR_NS**'
const IS_PROXY = REACTOR_NAMESPACE + 'IS_PROXY'
const SYMBOL_PROXY = Symbol(IS_PROXY)

const MUTATION_PARAM_ORDER_PAYLOAD_CONTEXT = 1
const MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD = 2

/**
 * Given an array of strings, return another array where all each matches an array prototype method
 * @param a {string[]}
 * @returns {string[]}
 */
function filterArrayFunction (a) {
  return a.filter(m => m in Array.prototype)
}

/**
 * Instances of classe Reactor provide two properties :
 * - state : a proxified version of the state
 * - getters : a set of reactive getters
 *
 * see ReactorTest unit tests to see how to use
 */
class Reactor {
  /**
   *
   * @param state {object} state
   * @param getters {object} all getters
   * @param mutations {object} all mutations
   * @param externals {object} an objet containing non-reactive properties
   * @param mutationParamOrder {number} MUTATION_PARAM_ORDER_*
   * @param proxyId {number} poxy id starting sequence
   * @returns {boolean|any}
   */
  constructor ({
    state,
    getters,
    mutations = {},
    externals = {},
    config: {
      mutationParamOrder = MUTATION_PARAM_ORDER_PAYLOAD_CONTEXT,
      proxyId = 1
    } = {}
  }) {
    this._proxyId = proxyId
    this._runningEffects = []
    this._getters = {}
    this._getterData = {}
    this._getterProxies = {}
    this._mutations = {}
    this._externals = externals
    this._events = new Events()
    this._mutationParamOrder = mutationParamOrder
    const track = this.track.bind(this)
    const trigger = this.trigger.bind(this)
    const proxify = target => this.proxify(target)
    const getType = (...args) => this.getType(...args)
    this._handler = {
      get (target, property, receiver) {
        if (property === SYMBOL_PROXY) {
          return target[SYMBOL_PROXY] || true
        }
        track(target, property)
        return Reflect.get(target, property, receiver)
      },
      set (target, property, value, receiver) {
        if (value === target[property]) {
          return
        }
        if (!(property in target)) {
          trigger(target)
        }
        trigger(target, property)
        const sType = getType(value)
        const tp = target[property]
        switch (sType) {
          case 'array': {
            if (getType(tp) === 'array') {
              tp.splice(0, tp.length, ...value)
              return
            } else {
              value = proxify(value)
            }
            break
          }
          case 'object': {
            value = proxify(value)
            break
          }
          default: {
            break
          }
        }
        return Reflect.set(target, property, value, receiver)
      },
      has (target, property) {
        track(target, property)
        return Reflect.has(target, property)
      },
      deleteProperty (target, property) {
        trigger(target, property)
        return Reflect.deleteProperty(target, property)
      }
    }
    this._state = this.proxify(state)
    this.iterate(getters, (g, name) => {
      this.defineGetter(name, g)
    })
    this.iterate(mutations, (m, name) => {
      this.defineMutation(name, m)
    })
  }

  static get CONSTS () {
    return {
      MUTATION_PARAM_ORDER_PAYLOAD_CONTEXT,
      MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD,
      ARRAY_TRIGGERED_METHODS,
      ARRAY_TRACKED_METHODS
    }
  }

  static get SYMBOL_PROXY () {
    return SYMBOL_PROXY
  }

  static get getUnsupportedArrayMethods () {
    return []
  }

  get mutationParamOrder () {
    return this._mutationParamOrder
  }

  /**
   * @param value {number}
   */
  set mutationParamOrder (value) {
    this._mutationParamOrder = value
  }

  createProxy (oTarget) {
    if (this.isReactive(oTarget)) {
      return oTarget
    }
    return new Proxy(oTarget, this._handler)
  }

  isReactive (oTarget) {
    return oTarget === null || oTarget === undefined || !!oTarget[SYMBOL_PROXY]
  }

  get events () {
    return this._events
  }

  get state () {
    return this._state
  }

  get getters () {
    return this._getterProxies
  }

  get mutations () {
    return this._mutations
  }

  get externals () {
    const x = this._externals
    return typeof x === 'function'
      ? x()
      : x
  }

  /**
   * Creates an effect that push itself onto a stack
   * in order to keep track of what's currently running.
   * @param fn {function} code to run (should encapsulate a getter)
   */
  createEffect (fn) {
    const effect = () => {
      this._runningEffects.push(effect)
      try {
        fn()
      } catch (e) {
        throw e
      } finally {
        this._runningEffects.pop()
      }
    }
    effect._depreg = fn._depreg
    effect()
  }

  /**
   * Object iteration with a callback
   * @param oObject {object} object to be iterated
   * @param f {function} function called back for each object property
   */
  iterate (oObject, f) {
    if (!oObject) {
      return
    }
    for (const [x, ox] of Object.entries(oObject)) {
      f(ox, x, oObject)
    }
  }

  /**
   * a property has been accessed for reading : register this target/property
   * to all currently running getters.
   * @param target {object} an object whose property is being accessed
   * @param property {string} name of the property that is accessed
   */
  track (target, property) {
    if (this.getType(target[property]) === 'function') {
      return
    }
    // all runningEffects receive target/prop
    this._runningEffects.forEach(re => {
      const d = re._depreg
      d.add(target, property)
    })
  }

  /**
   * a property is being changed : all dependant getters
   * are to be invalidated
   * @param target {object} an object whose property is being modified
   * @param property {string} name of the property that is modified
   */
  trigger (target, property = undefined) {
    // if no property specified, is getter dependent to target
    // invalidate cache for all getters having target/property
    const gd = this._getterData
    this.iterate(this._getters, (g, name) => {
      const gns = gd[name]
      const depreg = gns._depreg
      let bInvalidate = false
      if (property === undefined) {
        if (depreg.has(target)) {
          bInvalidate = true
        }
      } else if (depreg.has(target, property)) {
        bInvalidate = true
      }
      if (bInvalidate) {
        this.trigger(gns, '_cache')
        gns._invalidCache = true
      }
    })
  }

  getType (x) {
    const sType = typeof x
    switch (sType.toLowerCase()) {
      case 'object':
        if (x === null) {
          return 'null'
        } else if (Array.isArray(x)) {
          return 'array'
        } else {
          return 'object'
        }

      default:
        return sType
    }
  }

  /**
   * Turn an array into à reactive array
   * @param aTarget {[]}
   * @return {[]} clone of aTarget
   */
  proxifyArray (aTarget) {
    const aClone = aTarget.map(e => this.proxify(e))
    Reactor.CONSTS.ARRAY_TRACKED_METHODS.forEach(m => {
      Object.defineProperty(aClone, m, {
        value: (...args) => {
          this.track(aClone, '')
          return Array.prototype[m].call(aClone, ...args)
        }
      })
    })
    Reactor.CONSTS.ARRAY_TRIGGERED_METHODS.forEach(m => {
      Object.defineProperty(aClone, m, {
        value: (...args) => {
          this.trigger(aClone, '')
          return Array.prototype[m].call(aClone, ...(args.map(i => this.proxify(i))))
        }
      })
    })

    // adding a custom wrapper property
    Object.defineProperty(aClone, '$length', {
      get: () => {
        this.track(aClone, '')
        return aClone.length
      },
      set: value => {
        this.trigger(aClone, '')
        aClone.length = value
      }
    })
    return aClone
  }

  /**
   * Turn an object into à reactive object
   * @param oTarget
   * @returns {Proxy}
   */
  proxifyObject (oTarget) {
    if (Object.isFrozen(oTarget) || Object.isSealed(oTarget) || this.isReactive(oTarget)) {
      return oTarget
    }
    oTarget[SYMBOL_PROXY] = ++this._proxyId
    Object.defineProperty(oTarget, SYMBOL_PROXY, {
      value: ++this._proxyId,
      writable: false,
      configurable: false,
      enumerable: false
    })
    const oClone = {}
    this.iterate(oTarget, (value, key) => {
      if (key !== SYMBOL_PROXY) {
        oClone[key] = this.proxify(value)
      }
    })
    return this.createProxy(oClone)
  }

  /**
   * Installs a proxy on an object to make it reactive
   * @param target {object|[]}
   * @param name {string}
   */
  proxify (target, name = undefined) {
    switch (this.getType(target)) {
      case 'object':
        return this.proxifyObject(target)

      case 'array':
        return this.proxifyArray(target, name)

      default:
        return target
    }
  }

  /**
   * defines a new getter
   * @param name {string} name of the getter
   * @param getter {string} getter function
   */
  defineGetter (name, getter) {
    const sGetterType = this.getType(getter)
    if (sGetterType !== 'function') {
      throw new TypeError(`Getter "${name}" must be a function ; "${sGetterType}" was given.`)
    }
    this._getters[name] = getter
    this._getterData[name] = {
      _cache: undefined,
      _invalidCache: true,
      _name: name,
      _depreg: new DependencyRegistry()
    }
    Object.defineProperty(
      this._getterProxies,
      name,
      {
        enumerable: true,
        get: () => this.runGetter(name)
      }
    )
  }

  defineMutation (name, mutation) {
    switch (this._mutationParamOrder) {
      case MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD: {
        this._mutations[name] = payload => {
          const result = mutation({
            state: this.state,
            getters: this.getters,
            externals: this.externals
          }, payload)
          this._events.emit('mutation', {
            name,
            payload
          })
          return result
        }
        break
      }

      case MUTATION_PARAM_ORDER_PAYLOAD_CONTEXT: {
        this._mutations[name] = payload => {
          const result = mutation(payload, {
            state: this.state,
            getters: this.getters,
            externals: this.externals
          })
          this._events.emit('mutation', {
            name,
            payload
          })
          return result
        }
        break
      }
    }
  }

  /**
   * runs a getter
   * @param name {string} getter name
   * @return {*} result of the getter
   */
  runGetter (name) {
    const getter = this._getters[name]
    const gns = this._getterData[name]
    this.track(gns, '_cache')
    if (!gns._invalidCache) {
      return gns._cache
    }
    const pEffect = () => {
      gns._cache = getter(this._state, this.getters, this.externals)
      gns._invalidCache = false
    }
    gns._depreg.reset()
    pEffect._depreg = gns._depreg
    this.createEffect(pEffect)
    return gns._cache
  }
}

module.exports = Reactor
