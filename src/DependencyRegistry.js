class DependencyRegistry {
  constructor () {
    this._properties = {}
    this._instances = new Set()
  }

  add (target, property) {
    const p = this._properties
    if (property in p) {
      p[property].add(target)
    } else {
      p[property] = new Set([target])
    }
  }

  has (target, property = undefined) {
    let r = false
    if (property in this._properties) {
      r = this._properties[property].has(target)
    }
    return r
  }

  get data () {
    return {
      properties: this._properties,
      un: this._instances
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
