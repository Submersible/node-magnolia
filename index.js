/*jslint node: true, nomen: true, vars: true, todo: true */

'use strict';

var _ = require('lodash'),
    Q = require('q'),
    merge = require('merge-recursive').recursive,
    mongodb = require('mongodb'),
    dsl = require('../node-dsl');

// function chain(obj, actions) {
//     actions.reduce(function (obj, action) {
//         return obj[action[0]].apply(obj, action[1]);
//     }, obj);
// }

// helpers

function actionFind(actions, name, fallback) {
    return _.find(actions, function (action) {
        return action[0] === name;  // @TODO pf.slice(0).seq(name)
    }) || fallback;
}

function actionFindOne(actions, name, fallback) {
    // @TODO _(actionFind(actions, name)).otherwise(fallback)
    return (actionFind(actions, name) || ['', [fallback]])[1][0];
}

function actionsLast(actions, name) {
    return actionFind(actions, name, []).reverse()[0];
}

function actionsCombine(actions, name, cb, start) {
    return actionFind(actions, name, []).reduce(cb, start);
}

function actionsMerge(actions, name) {
    /**
     * Ugh.  Merge will take in the extra reduce parameters, and throw an
     * exception.  No point free style today.
     */
    return actionsCombine(actions, name, function (a, b) {
        return merge(a, b); // @TODO pf(merge).limit(2)
    }, {});
}

function actionsAdd(actions, name) {
    return actionsCombine(actions, name, function (a, b) {
        return a + b; // @TODO pf.add2
    }, 0);
}

function actionsPush(actions, name) {
    return actionsCombine(actions, name, function (a, b) {
        if (!a instanceof Array) {
            a = [a];
        }
        if (!b instanceof Array) {
            b = [b];
        }
        return b.concat(a);
    }, []);
}

function actionsFlag(actions, good, bad) {
    var found = actions.filter(function (action) {
        return _.include([good, bad], action[0]);
    }).reverse()[0];
    if (!found) {
        return true;
    }
    if (found[0] === good) {
        if (typeof found[1][0] === 'boolean') {
            return !!found[1][0];
        }
        return true;
    }
    if (typeof found[1][0] === 'boolean') {
        return !found[1][0];
    }
    return false;
}

function getCollection(actions) {
    var conn = new mongodb.Db(
        actionFindOne(actions, 'db'),
        new mongodb.Server('localhost', 27017),
        {w: 1} // {w, journal, fsync}
    );
    return Q.ninvoke(conn, 'open').then(function (client) {
        return Q.ninvoke(client, 'collection', actionFindOne(actions, 'collection'));
    });
}

// queries

function toArray(actions, cb) {
    var has_sort = actionFind(actions, 'sort'),
        sort = actionsPush(actions, 'sort'),
        has_skip = actionFind(actions, 'skip'),
        skip = actionsAdd(actions, 'skip'),
        has_limit = actionFind(actions, 'limit'),
        limit = actionsLast(actions, 'limit'),
        find_one = !actionsFlag(actions, 'multi', 'one'),
        filter = actionsMerge(actions, 'filter'),
        fields = actionsMerge(actions, 'fields'),
        options = actionsMerge(actions, 'options');

    return getCollection(actions).then(function (collection) {
        var d = Q.defer(), obj = collection;
        if (has_sort) { obj = obj.sort(sort); }
        if (has_skip) { obj = obj.skip(skip); }
        if (has_limit) { obj = obj.limit(limit); }
        obj.find(filter, fields, options).toArray(function (err, docs) {
            if (cb !== undefined) {
                cb.apply(undefined, arguments);
            }
            if (err) {
                d.reject(err);
            } else {
                d.resolve(find_one ? docs[0] : docs);
            }
        });
        return d.promise;
    });
}

function remove(actions, cb) {
    var has_limit = actionFind(actions, 'limit'),
        limit = actionsLast(actions, 'limit'),
        filter = actionsMerge(actions, 'filter'),
        multi = actionsFlag(actions, 'one', 'multi');

    return getCollection(actions).then(function (collection) {
        var obj = collection;
        if (has_limit) {
            obj = obj.limit(limit);
        }
        return Q.ninvoke(obj, 'remove', filter, {multi: multi}, cb);
    });
}

function update(actions, options) {
}

function insert(actions, options) {
}

var magnolia = dsl.methods([
    // connection
    'collection',
    'db',

    // options
    'filter', // find, merge
    'sort', // find, pushs infront
    'limit', // find remove, last
    'skip', // find, add
    'fields', // find, merge
    'options', // find, merge
    'one', // find remove, last
    'multi', // find remove, last

    // eh?
    'rewind',
    'safe',
    'unsafe'
]).call(function (collection, db) {
    var l = this._addAction(['collection', [collection]]); //.notCallable();
    if (db === undefined) {
        return l;
    }
    return l._addAction(['db', [db]]);
}).call('remove', function (filter, cb) {
    var actions = this._actions;
    if (typeof filter === 'function') {
        cb = filter;
        filter = false;
    }
    if (filter) {
        actions = actions.concat([['filter', [filter]]]);
    }
    return remove(actions, cb);
}).call('toArray', function (cb) {
    return toArray(this._actions, cb);
}).call('then', function () {
    var p = toArray(this._actions);
    return p.then.apply(p, arguments);
}).call('nextObject', function () {
    throw new Error('TODO');
}).call('each', function () {
    throw new Error('TODO');
}).call('findAndModify', function () {
    //
}).call('update', function (objNew, options, cb) {
    return update(this._actions, objNew, options, cb);
}).call('upsert', function (objNew, options, cb) {
    objNew = objNew || {};
    objNew.upsert = true;
    return update(this._actions, objNew, options, cb);
}).call('insert', function (docs, options, cb) {
    return insert(docs, options, cb);
}).done();

/**
 * @param {Function} fn
 * @return {Function}
 */
function newIsForChumps(fn) {
    var obj = Object.create(fn.prototype);
    fn.apply(obj, arguments);
    return obj;
}

/* BSON Types */
// Object.keys(mongodb).filter(function (key) {
//     return key[0] === key[0].toUpperCase();
// }).forEach(function (key) {
//     console.log('magnolia.' + key);
//     magnolia[key] = newIsForChumps(mongodb[key]);
// });

module.exports = magnolia;
