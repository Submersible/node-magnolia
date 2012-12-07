/*jslint node: true, nomen: true, vars: true */

'use strict';

var test = require('tap').test,
    magnolia = require('./');

function sortById(list) {
    return list.sort(function (a, b) {
        return a._id > b._id;
    });
}

test('merge', function (t) {
    t.deepEqual(
        magnolia.merge(),
        {}
    );
    t.deepEqual(
        magnolia.merge({hello: 'world', foo: {b: 'bar'}}),
        {hello: 'world', foo: {b: 'bar'}}
    );
    t.deepEqual(
        magnolia.merge(
            {hello: 'world', foo: {b: 'bar'}, test: {world: true}},
            {cat: 'meow', foo: {b: 'nope', t: true}, test: false}
        ),
        {hello: 'world', foo: {b: 'nope', t: true}, cat: 'meow', test: false}
    );
    t.deepEqual(
        magnolia.merge({hey: 'world', a: [1]}, {foo: 'bar', a: [2]}, {wee: 'rwar', a: [3]}),
        {hey: 'world', foo: 'bar', wee: 'rwar', a: [1, 2, 3]}
    );
    t.end();
});

test('something', function (t) {
    var m = magnolia('test', 'mongoloid-test').safe();

    var A = {hello: 'world', foo: {bar: 123, rwar: [1, 2, 3]}},
        B = {grr: 'rwar'},
        C = {foo: 'cat'},
        D = {meow: 'cat', wee: [3, 2, 1]};

    /* Clean DB for testing */
    m.multi().remove().then(function () {
        return m.insert(A).then(function (doc) {
            t.deepEqual(A, doc, 'inserted!');
            t.type(A._id, 'object');
            t.type(doc._id, 'object');
        });
    }).then(function () {
        var objs = [B, C];
        return m.insert(objs).then(function (docs) {
            t.deepEqual(objs, docs, 'inserted!');
            t.type(docs[0]._id, 'object');
            t.type(objs[0]._id, 'object');
        });
    }).then(function () {
        return m.save(D).then(function (doc) {
            t.deepEqual(D, doc, 'saved!');
            t.type(A._id, 'object');
            t.type(doc._id, 'object');
        });
    }).then(function () {
        return m.then(function (docs) {
            t.deepEqual(sortById([A, B, C, D]), sortById(docs));
        });
    }).then(function () {
        return m
            .filter({$or: [{hello: 'world'}]})
            .filter({$or: [{foo: 'cat'}]})
            .then(function (docs) {
                t.deepEqual(sortById([A, C]), sortById(docs));
            });
    }).then(function () {
        return m.remove().then(function (count) {
            t.equal(count, 4);
        });
    }).then(function () {
        t.end();
    }).done();
});
