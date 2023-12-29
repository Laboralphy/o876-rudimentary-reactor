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
   * @returns {boolean|any}
   */
  constructor ({ state, getters, mutations = {}, externals = {} }) {
    this._proxyId = 1
    this._runningEffects = []
    this._getters = {}
    this._getterData = {}
    this._getterProxies = {}
    this._mutations = {}
    this._externals = externals
    this._events = new Events()
    const track = this.track.bind(this)
    const trigger = this.trigger.bind(this)
    const proxify = target => {
      return this.createProxy(target)
    }
    this._handler = {
      get (target, property, receiver) {
        if (property === SYMBOL_PROXY) {
          return true
        }
        track(target, property)
        return Reflect.get(target, property, receiver)
      },
      set (target, property, value, receiver) {
        if (value === target[property]) {
          return
        }
        trigger(target, property)
        if (typeof value === 'object') {
          value = proxify(value)
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

  static get getUnsupportedArrayMethods () {
    return []
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
    return this._externals
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
   * returns true if a target/property is registred as a dependency
   * of the specified getter
   * @param depreg {Object<string, object[]>} list of dependencies
   * @param target {object} an object
   * @param property {string} property name
   * @return {boolean}
   */
  findDependency (depreg, target, property) {
    return depreg[property]?.indexOf(target) >= 0
  }

  /**
   * a property has been accessed : register this target/property
   * to all currently running getters.
   * @param target {object} an object whose property is being accessed
   * @param property {string} name of the property that is accessed
   */
  track (target, property) {
    // all runningEffects receive target/prop
    this._runningEffects.forEach(re => {
      const d = re._depreg
      if (!this.findDependency(d, target, property)) {
        if (!(property in d)) {
          d[property] = []
        }
        d[property].push(target)
      }
    })
  }

  /**
   * a property is being changed : all dependant getters
   * are to be invalidated
   * @param target {object} an object whose property is being modified
   * @param property {string} name of the property that is modified
   */
  trigger (target, property) {
    // invalidate cache for all getters having target/property
    const gd = this._getterData
    this.iterate(this._getters, (g, name) => {
      const gns = gd[name]
      if (this.findDependency(gns._depreg, target, property)) {
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
   * @param name {string} array name useful for tracking dependency
   * @return {[]} clone of aTarget
   */
  proxifyArray (aTarget, name) {
    const aClone = aTarget.map(e => this.proxify(e))
    ARRAY_TRACKED_METHODS.forEach(m => {
      Object.defineProperty(aClone, m, {
        value: (...args) => {
          this.track(aClone, '')
          return Array.prototype[m].call(aClone, ...args)
        }
      })
    })
    ARRAY_TRIGGERED_METHODS.forEach(m => {
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
    if (this.isReactive(oTarget)) {
      return oTarget
    }
    oTarget[SYMBOL_PROXY] = ++this._proxyId
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
    const sGetterType = typeof getter
    if (sGetterType !== 'function') {
      throw new TypeError(`Getter "${name}" must be a function ; "${sGetterType}" was given.`)
    }
    this._getters[name] = getter
    this._getterData[name] = {
      _cache: undefined,
      _invalidCache: true,
      _name: name,
      _depreg: {}
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
    pEffect._depreg = gns._depreg = {}
    this.createEffect(pEffect)
    return gns._cache
  }
}

module.exports = Reactor
