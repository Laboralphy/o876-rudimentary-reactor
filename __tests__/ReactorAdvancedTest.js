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
            o[sAction] = oAction.cooldown.$length
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
