/**
 * This class is an implementation of Vue.js reactivity system
 * as it is described at : https://v3.vuejs.org/guide/reactivity.html
 * @author Raphaël Marandet
 * @date 2021-07-29
 */

/**
 * these are the Array methods that are to be tracked in order to 
 * maintain reactivity
 */
const ARRAY_TRACKED_METHODS = [
	'entries',
	'every',
	'filter',
	'find',
	'findIndex',
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
]

/**
 * these Array methods triggers cache invalidation on dependent getters
 */
const ARRAY_TRIGGERED_METHODS = [
	'fill',
	'copyWithin',
	'splice',
	'push',
	'pop',
	'shift',
	'sort',
	'unshift',
	'reverse'
]

const REACTOR_NAMESPACE = '**O876_REACTOR_NS**'

/**
 * Instances of classe Reactor provide two properties :
 * - state : a proxified version of the state
 * - getters : a set of reactive getters
 * 
 * see ReactorTest unit tests to see how to use
 */
class Reactor {
	constructor (state, getters) {
		this._runningEffects = []
		this._getters = {}
		this._getterProxies = {}
		const track = this.track.bind(this)
		const trigger = this.trigger.bind(this)
		const proxify = (target) => {
			return new Proxy(oTarget, this._handler)
		}
		this._handler = {
			get(target, property, receiver) {
				track(target, property)
				return Reflect.get(target, property, receiver)
			},
			set(target, property, value, receiver) {
				trigger(target, property)
				if (typeof target[property] === 'object') {
					value = proxify(value)
				}
				return Reflect.set(target, property, value, receiver)
			},
			has(target, property) {
				track(target, property)
				return Reflect.has(target, property)
			},
			deleteProperty(target, property) {
				trigger(target, property)
				return Reflect.deleteProperty(target, property)
			}
		}
		this._state = this.proxify(state)
		this.iterate(getters, (g, name) => {
			this.defineGetter(name, g)
		})
	}
	
	get state () {
		return this._state
	}

	get getters () {
		return this._getterProxies
	}

	/**
	 * Creates an effect that push itself onto a stack
	 * in order to keep track of what's currently running.
	 * @param fn {function} code to run (should encapsulate a getter)
	 */
	createEffect (fn) {
		const effect = () => {
			this._runningEffects.push(effect)
			fn()
			this._runningEffects.pop()
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
		for (const x in oObject) {
			if (Object.prototype.hasOwnProperty.call(oObject, x)) {
				f(oObject[x], x, oObject)
			}
		}
	}
	
	/**
	 * returns true if a target/property is registred as a dependency
	 * of the specified getter
	 * @param getter {string} getter name
	 * @param target {object} an object
	 * @param property {string} property name
	 * @return {boolean}
	 */
	findDependency(registry, target, property) {
		return !!registry.find(tp => tp.target === target && tp.property === property)
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
				d.push({ target, property })
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
		this.iterate(this._getters, (g, name) => {
			const gns = g[REACTOR_NAMESPACE]
			if (this.findDependency(gns._depreg, target, property)) {
				gns._invalidCache = true
			}
		})
	}
	
	getType (x) {
		const sType = typeof x
		switch (sType) {
			case 'object':
				if (x === null) {
					return 'null'
				} else if (Array.isArray(x)) {
					return 'array'
				} else {
					return 'object'
				}
				break
				
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
					return Array.prototype[m].call(aClone, ...args)
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
	 * @param aTarget {object}
	 * @return {Proxy} proxified version of oTarget
	 */
	proxifyObject (oTarget) {
		const oClone = {}
		this.iterate(oTarget, (value, key) => {
			oClone[key] = this.proxify(value)
		})
		return new Proxy(oClone, this._handler)
	}

	/**
	 * Installs a proxy on an object to make it reactive
	 * @param target {object}
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
		getter[REACTOR_NAMESPACE] = {
			_cache: undefined,
			_invalidCache: true,
			_name: name,
			_depreg: []
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
	
	/**
	 * runs a getter
	 * @param name {string} getter name
	 * @return {*} result of the getter
	 */
	runGetter (name) {
		const getter = this._getters[name]
		const gns = getter[REACTOR_NAMESPACE]
		if (!gns._invalidCache) {
			return gns._cache
		}
		const pEffect = () => {
			gns._cache = getter(this._state, this.getters)
			gns._invalidCache = false
		}
		pEffect._depreg = gns._depreg = []
		this.createEffect(pEffect)
		return gns._cache
	}
}

module.exports = Reactor
