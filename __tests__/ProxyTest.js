
function createReactiveArray(array, callback) {
  return new Proxy(array, {
    get(target, prop, receiver) {
      if (prop === 'length') {
        // Rendre la propriété "length" réactive
        callback('get length', target.length);
      }
      if (!isNaN(parseInt(prop.toString())) && prop >= 0) {
        callback('get item', prop);
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      if (prop === 'length' || !(prop in target)) {
        // Notifier si "length" change
        callback('set length', target.length);
      }
      if (!isNaN(parseInt(prop.toString())) && prop >= 0) {
        callback('set item', prop);
      }
      return result;
    }
  });
}

describe('Array reactivity', function () {
  it('should', function () {

    const logs = []

    const reactiveArray = createReactiveArray([], (s, newLength) => {
      logs.push(`reactivité : ${s} - ${newLength}`);
    });

    reactiveArray.push(1);
    reactiveArray.push(2);
    reactiveArray.pop();
    reactiveArray[0] = 9

    expect(logs).toEqual([
      'reactivité : get length - 0',
      'reactivité : set item - 0',
      'reactivité : set length - 1',
      'reactivité : get length - 1',
      'reactivité : set item - 1',
      'reactivité : set length - 2',
      'reactivité : get length - 2',
      'reactivité : get item - 1',
      'reactivité : set length - 1',
      'reactivité : set item - 0'
    ])


  })
})
