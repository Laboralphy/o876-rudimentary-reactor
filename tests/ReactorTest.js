const Reactor = require('../src/Reactor')

describe('Reactor', function () {
	it('reactor class exists', function () {
		expect(Reactor).toBeDefined()
	})

	it('basic getter testing', function () {
		// simple state with props "a" & "b"
		const state = {
			a: 10,
			b: 25
		}
		// simple getter a + b
		const getters = {
			sum: state => state.a + state.b
		}
		const r = new Reactor({ state, getters })
		expect(r.getters.sum).toBe(35)
	})

	it('changing state', function () {
		const state = {
			a: 10,
			b: 25
		}
		const getters = {
			sum: state => state.a + state.b
		}
		const r = new Reactor({ state, getters })
		expect(r.getters.sum).toBe(35)
		r.state.a = 55
		expect(r.getters.sum).toBe(55 + 25)
	})

	it('checking if cache works', function () {
		let nComputed = 0 // used by getter "sum"
		const state = {
			a: 10,
			b: 25,
			c: 5
		}
		const getters = {
			sum: state => {
				++nComputed // will increase each time getter "sum" is computed
				return state.a + state.b
			}
		}
		expect(nComputed).toBe(0)
		const r = new Reactor({ state, getters })

		expect(r.getters.sum).toBe(35)
		expect(nComputed).toBe(1) // getter "sum" is computed for first time

		expect(r.getters.sum).toBe(35)
		expect(nComputed).toBe(1) // no need to recompute "sum" : state is unchanged

		r.state.a = 55 // changing state, prop "a" is a dependency of "sum"

		expect(r.getters.sum).toBe(55 + 25)
		expect(nComputed).toBe(2) // "sum" need to be recomputed

		expect(r.getters.sum).toBe(55 + 25)
		expect(nComputed).toBe(2) // "sum" : no need to recompute : state is unchanged

		r.state.c = 100 // changing state, but prop "c" is not a dependency of "sum"

		expect(r.getters.sum).toBe(55 + 25)
		expect(nComputed).toBe(2) // "sum" has not been recomputed
	})

	it('deep state : check if reactivity goes deep inside state', function () {
		const state = {
			a: 10,
			b: 25,
			c: {
				x: 5,
				y: 6
			}
		}
		const getters = {
			prod: state => state.c.x * state.c.y
		}

		const r = new Reactor({ state, getters })

		expect(r.getters.prod).toBe(5 * 6)
		r.state.c.y = 10

		expect(r.getters.prod).toBe(5 * 10)
	})

	it('what if a getter is not a function', function () {
		const state = {
			a: [10, 20, 30]
		}
		const getters = {
			// I made a mistake
			// array sum is not a function !
			arraySum: state.a.reduce((prev, curr) => curr + prev, 0)
		}

		expect(() => {
			const r = new Reactor({ state, getters })
		}).toThrow(new TypeError('Getter "arraySum" must be a function ; "number" was given.'))
	})

	it('pushing or shifting item on array', function () {
		const state = {
			a: [10, 20, 30]
		}
		const getters = {
			arraySum: state => state.a.reduce((prev, curr) => curr + prev, 0)
		}

		const r = new Reactor({ state, getters })

		// origianl sum
		expect(r.getters.arraySum).toBe(60)

		// pushing an item
		r.state.a.push(40)
		// testing existance
		expect(r.state.a[3]).toBe(40)
		// testing sum
		expect(r.getters.arraySum).toBe(100)

		// removing first item
		const n = r.state.a.shift()
		expect(n).toBe(10)
		expect(r.getters.arraySum).toBe(90)
	})

	it('managing array of objects', function () {
		// starting with no item
		const state = {
			a: []
		}

		const getters = {
			count: state => state.a.slice(0).length, // length is not reactive at the moment
			render: (s, g) => {
				const c = g.count
				const dToday = new Date()
				const nThisYear = dToday.getFullYear()
				const aPeople = s.a.map(({ year, name }) => name + ' is born in ' + year)
				const sPeople = aPeople.join(' ; ')
				return `${c} people : ${sPeople}.`
			},
			names: s => s.a.map(e => e.name).join(', ')
		}

		const r = new Reactor({ state, getters })
		expect(r.getters.count).toBe(0)
		expect(r.getters.render).toBe('0 people : .')

		// adding a person
		r.state.a.push({
			name: 'The Deep',
			year: 1985
		})
		expect(r.getters.count).toBe(1)
		expect(r.getters.render).toBe('1 people : The Deep is born in 1985.')

		// adding 3 people
		r.state.a.push(
			{ name: 'Starlight', year: 1994 },
			{ name: 'Queen Maeve', year: 1986 },
			{ name: 'Stormfront', year: 1919 }
		)
		expect(r.getters.count).toBe(4)
		expect(r.getters.render).toBe('4 people : The Deep is born in 1985 ; Starlight is born in 1994 ; Queen Maeve is born in 1986 ; Stormfront is born in 1919.')
		expect(r.getters.names).toBe('The Deep, Starlight, Queen Maeve, Stormfront')

		// sorting by year
		r.state.a.sort((a, b) => a.year - b.year)
		expect(r.getters.names).toBe('Stormfront, The Deep, Queen Maeve, Starlight')

		// sorting by name
		r.state.a.sort((a, b) => a.name.localeCompare(b.name))
		expect(r.getters.names).toBe('Queen Maeve, Starlight, Stormfront, The Deep')
	})

	it('deals with in operator and property deletion', function () {
		const state = {
			x: {
				good: true,
				evil: false,
				neutral: false
			}
		}
		const getters = {
			hasNeutralProperty: state => 'neutral' in state.x
		}
		const r = new Reactor({ state, getters })
		expect(r.getters.hasNeutralProperty).toBeTruthy()
		delete r.state.x.neutral
		expect(r.getters.hasNeutralProperty).toBeFalsy()
		r.state.x.neutral = true
		expect(r.getters.hasNeutralProperty).toBeTruthy()
	})

	it('deals with a slightly more complex state', function () {
		const state = {
			equip: {
				weapon: {
					name: 'sword',
					weight: 6,
					effects: [
						{
							type: 'bonus',
							ability: 'strength',
							value: 2
						},
						{
							type: 'bonus',
							ability: 'attack',
							value: 2
						}
					]
				},
				armor: {
					name: 'armor dragon',
					weight: 30,
					effects: [
						{
							type: 'bonus',
							ability: 'armor',
							value: 5
						},
						{
							type: 'bonus',
							ability: 'resist-fire',
							value: 4
						}
					]
				},
				shield: {
					name: 'shield tall',
					weight: 15,
					effects: [
						{
							type: 'bonus',
							ability: 'armor',
							value: 2
						},
						{
							type: 'bonus',
							ability: 'armor',
							value: 1
						}
					]
				}
			}
		}
		const getters = {
			getAC: state => {
				let nAC = 0
				for (let e in state.equip) {
					nAC += state
						.equip[e]
						.effects
						.filter(e => e.type === 'bonus' && e.ability === 'armor')
						.reduce((prev, curr) => curr.value + prev, 0)
				}
				return nAC
			}
		}
		expect(getters.getAC(state)).toBe(8)

		// put in Reactor

		const r = new Reactor({ state, getters })
		expect(r.getters.getAC).toBe(8)

		// let's add a shield penalty
		r.state.equip.shield.effects.push({
			type: 'bonus',
			ability: 'armor',
			value: -1
		})
		expect(r.getters.getAC).toBe(7)
	})

	it('using $length reactive property', function () {
		const state = {
			a: []
		}
		const getters = {
			// this getter uses "length" property
			render_1: state => 'there ' + (state.a.length > 1 ? 'are' : 'is') + ' ' + state.a.length + ' item' + (state.a.length > 1 ? 's' : '') + '.',

			// this getter uses "$length" custom property (only available thru Reactor Class)
			// "$length" is a reactive alias of "length"
			render_2: state => 'there ' + (state.a.$length > 1 ? 'are' : 'is') + ' ' + state.a.$length + ' item' + (state.a.$length > 1 ? 's' : '') + '.'
		}
		const r = new Reactor({ state, getters })
		expect(r.getters.render_1).toBe('there is 0 item.')
		expect(r.getters.render_2).toBe('there is 0 item.')

		// let's add 3 items
		r.state.a.push(5, 5, 5)
		// .length is NOT reactive
		// so the getter "render_1" will not be updated
		expect(r.getters.render_1).toBe('there is 0 item.') // still the old value of length

		// on the other hand, .$length is reactive
		// the getter "render_2" will be updated with the new length value
		expect(r.getters.render_2).toBe('there are 3 items.')
	})

	it('mutations basic testing', function () {
		const store = {
			state: {
				a: []
			},
			getters: {
				sum: state => state.a.reduce((prev, curr) => prev + curr, 0)
			},
			mutations: {
				pushItem: ({ state, getters }, { value }) => state.a.push(value)
			}
		}
		const r = new Reactor(store)
		expect(r.getters.sum).toBe(0)
		r.mutations.pushItem({ value: 10 })
		r.mutations.pushItem({ value: 20 })
		r.mutations.pushItem({ value: 30 })
		expect(r.getters.sum).toBe(60)
	})

	it('mutations calling getters', function () {
		const store = {
			state: {
				a: []
			},
			getters: {
				sum: state => state.a.reduce((prev, curr) => prev + curr, 0)
			},
			mutations: {
				pushItem: ({ state, getters }, { value }) => state.a.push(value + getters.sum)
			}
		}
		const r = new Reactor(store)
		expect(r.getters.sum).toBe(0)
		r.mutations.pushItem({ value: 10 })
		// [10]
		expect(r.getters.sum).toBe(10)
		r.mutations.pushItem({ value: 20 })
		// [10, 20 + 10]
		expect(r.getters.sum).toBe(40)
		r.mutations.pushItem({ value: 30 })
		// [10, 20 + 10, 30 + 10 + 20 + 10] : sum (10) + (30) + (70) = 110
		expect(r.getters.sum).toBe(110)
	})

	it('new item are reactive', function () {
		const store = {
			state: {
				a: [],
				b: {
					i1: {
						x: 5,
						y: 9
					},
					i2: {
						x: 12,
						y: -5
					}
				}
			},
			getters: {
				sumX: state => state.a.reduce((prev, curr) => prev + curr.x, 0),
				bp: state => state.b
			}
		}
		const r = new Reactor(store)
		expect(r.getters.sumX).toBe(0)
		r.state.a.push({x: 10, y: 8})
		expect(r.getters.sumX).toBe(10)
		r.state.a.push({x: 5, y: 8})
		expect(r.getters.sumX).toBe(15)
		r.state.a[0].x = 100
		expect(r.getters.sumX).toBe(105)
	})


	it('detecting proxified items', function () {
		const store = {
			state: {
				a: [],
				b: {
					i1: {
						x: 5,
						y: 9,
						toto: 99999999
					},
					i2: {
						x: 12,
						y: -5
					}
				}
			},
			getters: {
				sumX: state => state.a.reduce((prev, curr) => prev + curr.x, 0),
				bp: state => state.b
			}
		}
		const r = new Reactor(store)
		const i1 = r.getters.bp.i1
		expect(r.isReactive(i1)).toBeTruthy()
		expect(r.isReactive(store.state.b.i1)).toBeFalsy()
		expect(r.isReactive(r.state.b.i1)).toBeTruthy()
	})

	it('by the way : testing proxy and symbol', function () {
		const a = { x: 1 }
		const sym = Symbol('PROX')
		const h = {
			get (target, property, receiver) {
				if (property === sym) {
					return true
				}
				return Reflect.get(target, property, receiver)
			}
		}
		const b = new Proxy(a, h)
		expect(a[sym]).toBeFalsy()
		expect(b[sym]).toBeTruthy()
	})

	it('filter which have enough points', function () {
		const store = {
			state: {
				characters: [
					{
						id: 1,
						name: 'rogue',
						skills: [
							{
								skill: 'stealth',
								value: 10
							},
							{
								skill: 'detect-trap',
								value: 7
							}
						]
					},
					{
						id: 2,
						name: 'wizard',
						skills: [
							{
								skill: 'lore',
								value: 10
							},
							{
								skill: 'spellcraft',
								value: 15
							},
							{
								skill: 'detect-trap',
								value: 2
							}
						]
					},
					{
						id: 3,
						name: 'warrior',
						skills: [
							{
								skill: 'detect-trap',
								value: 4
							}
						]
					},
					{
						id: 4,
						name: 'ranger',
						skills: [
							{
								skill: 'detect-trap',
								value: 8
							},
							{
								skill: 'survival',
								value: 15
							}
						]
					}
				]
			},
			getters: {
				// list of characters that have more than 6 in skill detect trap
				getThoseWhoHaveEnoughtDetectTrap: state => state.characters.filter(c => c.skills.some(s => s.skill === 'detect-trap' && s.value >= 6)),
				numOfSuchCharacters: (state, getters) => getters.getThoseWhoHaveEnoughtDetectTrap.length
			}
		}
		const r = new Reactor(store)
		expect(r.getters.numOfSuchCharacters).toBe(2)
		const oWiz = r.state.characters.find(c => c.name === 'wizard')
		const oSkillDT = oWiz.skills.find(s => s.skill === 'detect-trap')
		// ok let's change value to see if getter is updated
		oSkillDT.value = 10
		expect(r.getters.numOfSuchCharacters).toBe(3)
	})

  it('states with circular reference during runtime', function () {
    const ent1 = {
      target: null,
      id: 1,
      name: 'cloud strife'
    }
    const ent2 = {
      target: ent1,
      id: 2,
      name: 'tifa lockheart'
    }
    const state = {
      entities: [
        ent1,
        ent2
      ]
    }
    const getters = {
      getEntityTargetList: state => state.entities.map(e => e.name + ' targets ' + (e.target ? e.target.name : 'nobody'))
    }
    const r = new Reactor({ state, getters })
    expect(r.getters.getEntityTargetList[0]).toBe('cloud strife targets nobody')
    expect(r.getters.getEntityTargetList[1]).toBe('tifa lockheart targets cloud strife')
    r.state.entities[0].target = ent2
    expect(r.getters.getEntityTargetList[0]).toBe('cloud strife targets tifa lockheart')
  })

  it('states with circular reference in store definition', function () {
    const ent1 = {
      target: null,
      id: 1,
      name: 'cloud strife'
    }
    const ent2 = {
      target: ent1,
      id: 2,
      name: 'tifa lockheart'
    }
    ent1.target = ent2
    const state = {
      entities: [
        ent1,
        ent2
      ]
    }
    const getters = {
      getEntityTargetList: state => state.entities.map(e => e.name + ' targets ' + (e.target ? e.target.name : 'nobody'))
    }
    expect(() => {
      new Reactor({ state, getters })
    }).not.toThrow(new RangeError('Maximum call stack size exceeded'))
  })

  it('Reactor TestCase #1', function () {

    const state = {
      books: [
        {
          id: 1,
          title: '20,000 leagues under seas',
          author: 'Jules Vernes',
          year: 1870
        },
        {
          id: 2,
          title: 'Connan of cimmeria',
          author: 'Robert E. Howard',
          year: 1932
        }
      ]
    }

    const getters = {
      getMaxId: state => state.books.reduce((prev, curr) => Math.max(prev, curr.id), -Infinity),
      getBooksOf20thCentury: state => state.books.filter(b => b.year >= 1900)
    }

    const mutations = {
      addBook: ({ state, getters }, { title, author, year }) => {
        state.books.push({
          id: getters.getMaxId + 1,
          title,
          author,
          year
        })
      },
      deleteBook: ({ state }, { id }) => {
        // search for book index in array
        const nBookIndex = state.books.findIndex(book => id === book.id)
        state.books.splice(nBookIndex, 1) // remove book from list
      }
    }

    const r = new Reactor({ state, getters, mutations })
    expect(r.getters.getMaxId).toBe(2) // prints "2"
    expect(r.getters.getBooksOf20thCentury
      .map(({ title }) => title)
      .sort())
      .toEqual([ "Connan of cimmeria" ])

    r.mutations.addBook({ title: 'The Colour of Magic', author: 'Terry Pratchett', year: 1983 })
    expect(r.getters.getBooksOf20thCentury
      .map(({ title }) => title)
      .sort())
      .toEqual([ "Connan of cimmeria", "The Colour of Magic" ])
  })
})

