/*jslint node: true, nomen: true, vars: true */

'use strict';

var Q = require('q');

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
    /* Insert */
    }).then(function () {
        var objs = [B, C];
        return m.insert(objs).then(function (docs) {
            t.deepEqual(objs, docs, 'inserted!');
            t.type(docs[0]._id, 'object');
            t.type(objs[0]._id, 'object');
        });
    /* Save */
    }).then(function () {
        return m.save(D).then(function (doc) {
            t.deepEqual(D, doc, 'saved!');
            t.type(A._id, 'object');
            t.type(doc._id, 'object');
        });
    /* Find */
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
        return m
            .filter({hello: 'world'})
            .update({$set: {hello: 'world!!!'}, $inc: {'foo.bar': 1}})
            .then(function (count) {
                t.equal(count, 1);
            });
    }).then(function () {
        return m.filter({hello: 'world!!!'}).one().then(function (doc) {
            t.equal(doc.hello, 'world!!!');
            t.equal(doc.foo.bar, 124);
        });
    /* Update */
    }).then(function () {
        return m.update({$set: {all: 'yall'}}).then(function (count) {
            t.equal(count, 1);
        });
    }).then(function () {
        return m.multi().update({$set: {all: 'yall'}}).then(function (count) {
            t.equal(count, 4);
        });
    /* Each */
    }).then(function () {
        var d = Q.defer();

        t.test('each loop', function (t) {
            var compare = [
                {all: 'yall', foo: {bar: 124, rwar: [1, 2, 3]}, hello: 'world!!!'},
                {all: 'yall', grr: 'rwar'},
                {all: 'yall', foo: 'cat'},
                {all: 'yall', meow: 'cat', wee: [3, 2, 1]}
            ];
            t.plan(compare.length);

            m.fields({_id: 0}).each(function (doc) {
                t.deepEqual(compare.shift(), doc);

                if (compare.length === 0) {
                    d.resolve();
                }
            });
        });

        return d.promise;
    /* Upsert */
    }).then(function () {
        return m
            .filter({hello: 'world!!!'})
            .upsert({hello: 'mate'})
            .then(function (count) {
                t.equal(count, 1);
            });
    }).then(function () {
        return m.filter({hello: 'mate'}).one().then(function (doc) {
            t.equal(A._id.toString(), doc._id.toString());
        });
    }).then(function () {
        return m.count().then(function (count) {
            t.equal(count, 4);
        });
    }).then(function () {
        return m
            .filter({name: 'ryan'})
            .upsert({name: 'ryan', is: 'cool'})
            .then(function (count) {
                t.equal(count, 1);
            });
    /* Count */
    }).then(function () {
        return m.count().then(function (count) {
            t.equal(count, 5);
        });
    }).then(function () {
        return m.count({hello: 'mate'}).then(function (count) {
            t.equal(count, 1);
        });
    /* Find and modify */
    }).then(function () {
        return m
            .multi()
            .filter({grr: 'rwar'})
            .findAndModify({$set: {meow: 'face'}}, {'new': true})
            .then(function (doc) {
                B.all = 'yall';
                B.meow = 'face';
                t.deepEqual(B, doc);
            });
    /* C'est fini! */
    }).then(function () {
        return m.remove().then(function (count) {
            t.equal(count, 5);
        });
    }).then(function () {
        t.end();
    }).done();
});
