class DependencyRegistry {
  constructor () {
    this._properties = {}
    this._instances = new Set()
  }

  add (target, property) {
    this._instances.add(target)
    const p = this._properties
    if (property in p) {
      p[property].add(target)
    } else {
      p[property] = new Set([target])
    }
  }

  has (target, property = undefined) {
    let r
    if (property === undefined) {
      r = this._instances.has(target)
    } else if (property in this._properties) {
      r = this._properties[property].has(target)
    } else {
      r = false
    }
    console.log('HAS', property, target, 'result', r)
    return r
  }

  get data () {
    return {
      properties: this._properties,
      instances: this._instances
    }
  }

  reset () {
    this._instances.clear()
    Object
      .keys(this._properties)
      .forEach(prop => {
        delete this._properties[prop]
      })
  }
}

module.exports = DependencyRegistry
