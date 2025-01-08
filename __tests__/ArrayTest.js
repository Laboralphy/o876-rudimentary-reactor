const Reactor = require('../src/Reactor')

describe('items in arrays', function () {
  it('should return 1 when adding an item of value 1', function () {
    const r = new Reactor({
      state: {
        items: []
      },
      getters: {
        getSum: state => state.items.reduce((prev, curr) => prev + curr, 0)
      },
      mutations: {
        addItem: ({ state }, { value }) => {
          state.items.push(value)
        }
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toBe(0)
    r.mutations.addItem({ value: 1 })
    expect(r.getters.getSum).toBe(1)
  })
  it('should return 1 when replacing an existing item by using index', function () {
    const r = new Reactor({
      state: {
        items: [0]
      },
      getters: {
        getSum: state => state.items.reduce((prev, curr) => prev + curr, 0)
      },
      mutations: {
        addItem: ({ state }, { index, value }) => {
          state.items[index] = value
        }
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toBe(0)
    r.mutations.addItem({ index: 0, value: 1 })
    expect(r.getters.getSum).toBe(1)
  })
  it('should return 1 when adding an item of value 1 by using index instead of push', function () {
    const r = new Reactor({
      state: {
        items: []
      },
      getters: {
        getSum: state => state.items.reduce((prev, curr) => prev + curr, 0)
      },
      mutations: {
        addItem: ({ state }, { index, value }) => {
          state.items[index] = value
        }
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toBe(0)
    r.mutations.addItem({ index: 0, value: 1 })
    expect(r.getters.getSum).toBe(1)
  })
  it('should return 30 result when using .pop()', function () {
    const r = new Reactor({
      state: {
        items: [{ value: 10 }, { value: 20 }, { value: 30 }]
      },
      getters: {
        getSum: state => state.items.reduce((prev, curr) => prev + curr.value, 0)
      },
      mutations: {
        removeItem: ({ state }) => {
          state.items.pop()
        },
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toEqual(60)
    r.mutations.removeItem()
    expect(r.getters.getSum).toEqual(30)
  })
  it('should return 50 result when using .shift()', function () {
    const r = new Reactor({
      state: {
        items: [{ value: 10 }, { value: 20 }, { value: 30 }]
      },
      getters: {
        getSum: state => state.items.reduce((prev, curr) => prev + curr.value, 0)
      },
      mutations: {
        removeItem: ({ state }) => {
          state.items.shift()
        },
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toEqual(60)
    r.mutations.removeItem()
    expect(r.getters.getSum).toEqual(50)
  })
  it('should return 40 result when using .splice()', function () {
    const r = new Reactor({
      state: {
        items: [{ value: 10 }, { value: 20 }, { value: 30 }]
      },
      getters: {
        getSum: state => state.items.reduce((prev, curr) => prev + curr.value, 0)
      },
      mutations: {
        removeItem: ({ state }) => {
          state.items.splice(1, 1)
        },
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toEqual(60)
    r.mutations.removeItem()
    expect(r.getters.getSum).toEqual(40)
  })
  it('should return 40 result when using .splice() to replace item', function () {
    const r = new Reactor({
      state: {
        items: [{ value: 10 }, { value: 20 }, { value: 30 }]
      },
      getters: {
        getSum: state => state.items.reduce((prev, curr) => prev + curr.value, 0)
      },
      mutations: {
        removeItem: ({ state }) => {
          state.items.splice(1, 1, { value: 0 })
        },
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toEqual(60)
    r.mutations.removeItem()
    expect(r.getters.getSum).toEqual(40)
  })
  it('should return 40 result when replacing value of item #1', function () {
    const r = new Reactor({
      state: {
        items: [{ value: 10 }, { value: 20 }, { value: 30 }]
      },
      getters: {
        getSum: state => state.items.reduce((prev, curr) => prev + curr.value, 0)
      },
      mutations: {
        removeItem: ({ state }) => {
          state.items[1].value = 0
        },
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toEqual(60)
    r.mutations.removeItem()
    expect(r.getters.getSum).toEqual(40)
  })
  it('should return 40 result when replacing item #1 with index', function () {
    const r = new Reactor({
      state: {
        items: [{ value: 10 }, { value: 20 }, { value: 30 }]
      },
      getters: {
        getSum: state => state.items.reduce((prev, curr) => prev + curr.value, 0)
      },
      mutations: {
        removeItem: ({ state }) => {
          state.items[1] = { value: 0 }
        },
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toEqual(60)
    r.mutations.removeItem()
    expect(r.getters.getSum).toEqual(40)
  })
})


describe('adding items in objects', function () {
  it('should return 1 when adding an item with value 1 by using index', function () {
    const r = new Reactor({
      state: {
        items: {}
      },
      getters: {
        getSum: state => Object.values(state.items).reduce((prev, curr) => prev + curr, 0)
      },
      mutations: {
        addItem: ({ state }, { index, value }) => {
          state.items[index] = value
        }
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getSum).toBe(0)
    r.mutations.addItem({ index: 'x', value: 1 })
    expect(r.getters.getSum).toBe(1)
  })
})
