# Laboralphy store manager
A store manager base on Vue.js reactivity :
https://v3.vuejs.org/guide/reactivity.html

However this is not a copy/paste of the article.
And the article has been updated many times since 2021.

## Description
This is a rudimentary store manager supporting :
- State
- Getters
- Mutations

Example :
```javascript
const state = {
	a: 0,
	b: 0
}
const getters = {
	sum: state => state.a + state.b
}
const r = new Reactor({ state, getters })
console.log(r.getters.sum)
// should display 0

r.state.a = 5
r.state.b = 6
console.log(r.getters.sum)
// should display 11
```

## Some advice
1) Arrays are not reactive.
2) Use array.push, array.unshift, to add items. Many array functions are reactive.
3) Use array.splice to replace items inside arrays.
4) You may add/delete properties within objects, it is reactive.
5) Object stored in arrays have reactive properties.

## Other examples with arrays

```javascript
// This example has been adapted to a unit test

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
console.log(r.getters.getMaxId) // prints "2"
console.log(
    r.getters.getBooksOf20thCentury
      .map(({ title }) => title)
      .sort()
) // prints [ "Connan of cimmeria" ]

r.mutations.addBook({ title: 'The Colour of Magic', author: 'Terry Pratchett', year: 1983 })
console.log(
    r.getters.getBooksOf20thCentury
      .map(({ title }) => title)
      .sort()
) // prints [ "Connan of cimmeria", "The Colour of Magic" ]

```
