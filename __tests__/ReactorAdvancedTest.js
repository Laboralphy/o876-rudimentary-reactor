const Reactor = require('../src/Reactor')

describe('checks object in array reactivity', function () {
  it('should invalidate getter when pushing a number in array', function () {
    const r = new Reactor({
      state: {
        actions: {
          a1: {
            cooldown: []
          }
        }
      },
      getters: {
        getItems: state => {
          const o = {}
          Object.entries(state.actions).forEach(([ sAction, oAction]) => {
            o[sAction] = oAction.cooldown.length
          })
          return o
        }
      },
      mutations: {
        useItem: ({ state }, { id }) => {
          state.actions[id].cooldown.push(5)
        },
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getItems).toEqual({ a1: 0 })
    r.mutations.useItem({ id: 'a1' }) // should trigger something
    expect(r.getters.getItems).toEqual({ a1: 1 })
  })
})

describe('check equipment inventory error', function () {
  it('should recompute getter when changin one of object properties', function () {
    const r = new Reactor({
      state: {
        equipment: {
          chest: null,
          weapon: null
        }
      },
      getters: {
        getEquipment: (state) => state.equipment,
        getArmorClass: (state) => {
          if (state.equipment.chest !== null) {
            return state.equipment.chest.ac
          } else {
            return -1
          }
        }
      },
      mutations: {
        equipItem: ({ state }, { item }) => {
          state.equipment.chest = item
        },
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })
    expect(r.getters.getArmorClass).toBe(-1)
    r.mutations.equipItem({ item: { ac: 11 } })
    expect(r.getters.getArmorClass).toBe(11)
    r.mutations.equipItem({ item: { ac: 12 } })
    expect(r.getters.getArmorClass).toBe(12)
  })
})

describe('symbol managemennt', function () {
  const SYMBOL_TEST = Symbol('test')
  it('symbol should be still in proxified object', function () {
    const a = { x: 1 }
    a[SYMBOL_TEST] = true
    expect(a[SYMBOL_TEST]).toBe(true)
    const r = new Reactor({
      state: {},
      getters: {}
    })

    const b = r.proxifyObject(a)
    expect(b[SYMBOL_TEST]).toBe(true)
  })
  it('symbol should be still in proxified object', function () {
    const a = { x: 10 }
    a[SYMBOL_TEST] = true
    const r = new Reactor({
      state: {
        myList: []
      },
      getters: {
        getMyListWithSymbol: (state) => state.myList.filter(x => x[SYMBOL_TEST]),
        getMyListSum: (state) => state.myList.reduce((prev, x) => x.x + prev, 0)
      },
      mutations: {
        addItem: ({ state }, { item }) => {
          state.myList.push(item)
        },
      },
      config: {
        mutationParamOrder: Reactor.CONSTS.MUTATION_PARAM_ORDER_CONTEXT_PAYLOAD
      }
    })

    r.mutations.addItem({ item: a })
    expect(r.getters.getMyListWithSymbol.length).toBe(1)
    expect(r.getters.getMyListSum).toBe(10)

  })
})
