# o876-rudimentary-reactor
A rudimentary implementation of Vue.js reactivity :
https://v3.vuejs.org/guide/reactivity.html

## Description
This is a rudimentary reactive state manager.

Example :
```javascript
state = {
	a: 0,
	b: 0
}
getters = {
	sum: state => state.a + state.b
}
const r = new Reactor(state, getters)
console.log(r.getters.sum)
// should display 0

r.state.a = 5
r.state.b = 6
console.log(r.getters.sum)
// should display 11
```

## Some advice
1) Arrays are not reactive
2) Use array.push, array.unshift, to add items
3) Use array.splice to replace items
4) You may add/delete properties within objects, it is reactive
