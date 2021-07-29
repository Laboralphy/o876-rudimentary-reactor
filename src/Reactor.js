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
	 * @param fn {function} code to run
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
	findDependency(getter, target, property) {
		const d = getter._depreg
		if (!Array.isArray(d)) {
			throw new Error('getter ' + getter._name + ' has no valid dependency register')
		}
		return d.some(tp => tp.target === target && tp.property === property)
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
			d.push({ target, property })
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
			if (this.findDependency(g, target, property)) {
				g._invalidCache = true
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
		return aClone
	}
	
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
		getter._cache = undefined
		getter._invalidCache = true
		getter._name = name
		getter._depreg = []
		Object.defineProperty(
			this._getterProxies,
			name,
			{
				enumerable: true,
				get: () => this.runGetter(name)
			}
		)
	}
	
	setProperty (target, property, value) {
		target[property] = value
		this.proxify(target)
	}
	
	/**
	 * runs a getter
	 * @param name {string} getter name
	 * @return {*} result of the getter
	 */
	runGetter (name) {
		const fn = this._getters[name]
		if (!fn._invalidCache) {
			return fn._cache
		}
		const pEffect = () => {
			fn._cache = fn(this._state, this.getters)
			fn._invalidCache = false
		}
		pEffect._depreg = fn._depreg = []
		this.createEffect(pEffect)
		return fn._cache
	}
}

module.exports = Reactor

