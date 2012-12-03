/*jslint node: true */

'use strict';

var test = require('tap').test,
    magnolia = require('./');

test('something', function (t) {
    var m = magnolia('test', 'mongoloid-test');

    // m.remove();

    // m.insert([{hello: 'world!'}]);

    m.then(function (docs) {
        console.log('rwar', docs);
    }).done();

    // magnolia.init({db: 'hello', server: 'rwar'});
    // magnolia
    //     .filter({name: 'bar'})
    //     .update({foo: 'bar'}).unsafe()
    //     .toArray();
    t.end();
});
