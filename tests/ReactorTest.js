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
		const r = new Reactor(state, getters)
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
		const r = new Reactor(state, getters)
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
		const r = new Reactor(state, getters)

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
		
		const r = new Reactor(state, getters)
		
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
			const r = new Reactor(state, getters)
		}).toThrow(new TypeError('Getter "arraySum" must be a function ; "number" was given.'))
	})

	it('pushing or shifting item on array', function () {
		const state = {
			a: [10, 20, 30]
		}
		const getters = {
			arraySum: state => state.a.reduce((prev, curr) => curr + prev, 0)
		}
		
		const r = new Reactor(state, getters)
		
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
		
		const r = new Reactor(state, getters)
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
		const r = new Reactor(state, getters)
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
		
		const r = new Reactor(state, getters)
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
			render_2: state => 'there ' + (state.a.$length > 1 ? 'are' : 'is') + ' ' + state.a.$length + ' item' + (state.a.$length > 1 ? 's' : '') + '.' 
		}
		const r = new Reactor(state, getters)
		expect(r.getters.render_1).toBe('there is 0 item.')
		expect(r.getters.render_2).toBe('there is 0 item.')

		// let's add 3 items
		r.state.a.push(5, 5, 5)
		// .length is NOT reactive
		// so the getter "render_1" will not be updated
		expect(r.getters.render_1).toBe('there is 0 item.')
		
		// on the other hand, .$length is reactive
		// the getter "render_2" will be updated with the new length value 
		expect(r.getters.render_2).toBe('there are 3 items.')
	})
})
