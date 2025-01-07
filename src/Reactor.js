const DependencyRegistry = require('./DependencyRegistry')
/**
 * This class is an implementation of Vue.js reactivity system
 * as it is described at : https://v3.vuejs.org/guide/reactivity.html
 * @author Raphaël Marandet
 * @date 2021-07-29
 *
 * read README.md for "how to use"
 */

const Events = require('events')
const { SYMBOL_PROXY, SYMBOL_BASE_OBJECT } = require('./symbols')

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

function isPositiveNumber (x) {
  const sType = typeof x
  if (sType === 'string') {
    const y = +x
    return !isNaN(y) && y >= 0
  } else if (sType === 'number') {
    return !isNaN(x) && x >= 0
  } else {
    return false
  }
}

/**
 * Instances of classe Reactor provide two properties :
 * - state : a proxified version of the state
 * - getters : a set of reactive getters
 *
 * see ReactorTest unit __tests__ to see how to use
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
      mutationParamOrder = MUTATION_PARAM_ORDER_PAYLOAD_CONTEXT
    } = {}
  }) {
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
    this._handlerArray = {
      get (target, property, receiver) {
        if (property === SYMBOL_PROXY) {
          return target[SYMBOL_PROXY] || true
        }
        const result =  Reflect.get(target, property, receiver)
        if (typeof target[property] === 'function') {
          track(target, SYMBOL_BASE_OBJECT)
        }
        if (property === 'length' || isPositiveNumber(property)) {
          track(target, property)
        }
        return result
      },
      set (target, property, value, receiver) {
        const bIndex = isPositiveNumber(property)
        const bNewIndex = bIndex && target[property] !== undefined
        const result = Reflect.set(target, property, proxify(value), receiver)
        if (property === 'length' || bIndex) {
          trigger(target, property)
        }
        if (bNewIndex) {
          trigger(target, SYMBOL_BASE_OBJECT)
        }
        return result
      },
      has (target, property) {
        const result =  Reflect.has(target, property)
        track(target, property)
        return result
      },
      ownKeys (target) {
        const result =  Reflect.ownKeys(target)
        track(target, SYMBOL_BASE_OBJECT)
        return result
      },
      deleteProperty (target, property) {
        const result = Reflect.deleteProperty(target, property)
        trigger(target, property)
        return result
      }
    }
    this._handler = {
      get (target, property, receiver) {
        if (property === SYMBOL_PROXY) {
          return target[SYMBOL_PROXY] || true
        }
        const result = Reflect.get(target, property, receiver)
        track(target, property)
        return result
      },
      set (target, property, value, receiver) {
        const bNewProperty = !(property in target)
        const result =  Reflect.set(target, property, proxify(value), receiver)
        trigger(target, property)
        if (bNewProperty) {
          trigger(target, SYMBOL_BASE_OBJECT)
        }
        return result
      },
      has (target, property) {
        const result =  Reflect.has(target, property)
        track(target, property)
        return result
      },
      ownKeys (target) {
        const result =  Reflect.ownKeys(target)
        track(target, SYMBOL_BASE_OBJECT)
        return result
      },
      deleteProperty (target, property) {
        throw new Error('Cannot delete key ' + property + '. Adding or deleting keys is forbidden in state. This is because getters cache is not invalidate by adding/removing properties')
        // trigger(target, property)
        // return Reflect.deleteProperty(target, property)
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
      MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
    }
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

  createArrayProxy (aTarget) {
    if (this.isReactive(aTarget)) {
      return aTarget
    }
    return new Proxy(aTarget, this._handlerArray)
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
    const sType = this.getType(target[property])
    if (sType === 'function') {
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
  trigger (target, property) {
    // if no property specified, is getter dependent to target
    // invalidate cache for all getters having target/property
    const gd = this._getterData
    this.iterate(this._getters, (g, name) => {
      const gns = gd[name]
      const depreg = gns._depreg
      let bInvalidate = false
      if (depreg.has(target, property)) {
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
   * Turn an object into à reactive object
   * @param oTarget
   * @returns {Proxy}
   */
  proxifyObject (oTarget) {
    if (Object.isFrozen(oTarget) || Object.isSealed(oTarget) || this.isReactive(oTarget)) {
      return oTarget
    }
    const bArray = Array.isArray(oTarget)
    Object.defineProperty(oTarget, SYMBOL_PROXY, {
      value: true,
      writable: false,
      configurable: false,
      enumerable: false
    })
    if (bArray) {
      const aClone = oTarget.map(e => this.proxify(e))
      return this.createArrayProxy(aClone)
    } else {
      const oClone = {}
      this.iterate(oTarget, (value, key) => {
        oClone[key] = this.proxify(value)
      })
      return this.createProxy(oClone)
    }
  }

  /**
   * Installs a proxy on an object to make it reactive
   * @param target {object|[]}
   */
  proxify (target) {
    switch (this.getType(target)) {
      case 'array':
      case 'object': {
        return this.proxifyObject(target)
      }

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
