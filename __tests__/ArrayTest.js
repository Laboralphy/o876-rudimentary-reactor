const Reactor = require('../src/Reactor')

describe('adding items in arrays', function () {
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
  it('should return 1 when adding an item of value 1 by using index instead of push', function () {
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
