/*jslint node: true, nomen: true, vars: true, todo: true */

'use strict';

var _ = require('lodash'),
    Q = require('q'),
    mongodb = require('mongodb'),
    dsl = require('dsl');

// function chain(obj, actions) {
//     actions.reduce(function (obj, action) {
//         return obj[action[0]].apply(obj, action[1]);
//     }, obj);
// }

// helpers

function mergeObj(a, b) {
    var obj = {};
    // combine differences
    (function diff(a, b) {
        _.difference(_.keys(a), _.keys(b)).forEach(function (key) {
            obj[key] = a[key];
        });
        return diff;
    }(a, b)(b, a));
    // merge shared
    _.intersection(_.keys(a), _.keys(b)).forEach(function (key) {
        if (a[key] instanceof Array && b[key] instanceof Array) {
            obj[key] = a[key].concat(b[key]);
        } else if (typeof a[key] === 'object' && typeof b[key] === 'object') {
            obj[key] = mergeObj(a[key], b[key]);
        } else {
            obj[key] = b[key];
        }
    });
    return obj;
}

function merge() {
    return _.toArray(arguments).reduce(mergeObj, {});
}

function actionFind(actions, name) {
    return actions.filter(function (action) {
        return action[0] === name;  // @TODO pf.slice(0).seq(name)
    }).map(function (action) {
        return action[1][0];
    });
}

function actionFindOne(actions, name, fallback) {
    // @TODO _(actionFind(actions, name)).otherwise(fallback)
    return actionFind(actions, name)[0] || fallback;
}

function actionsLast(actions, name) {
    return actionFind(actions, name).reverse()[0];
}

function actionsCombine(actions, name, cb, start) {
    return actionFind(actions, name).reduce(cb, start);
}

function actionsMerge(actions, name, start) {
    /**
     * Ugh.  Merge will take in the extra reduce parameters, and throw an
     * exception.  No point free style today.
     */
    return actionsCombine(actions, name, function (a, b) {
        return merge(a, b); // @TODO pf(merge).limit(2)
    }, start || {});
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
    var server = actions.filter(function (action) {
            return action[0] === 'server';
        }).map(function (action) {
            return action[1];
        })[0] || ['localhost', 27017],
        conn = new mongodb.Db(
            actionFindOne(actions, 'db'),
            new mongodb.Server(server[0], server[1] || 27017),
            {w: 1} // {w, journal, fsync}
        );
    return Q.ninvoke(conn, 'open').then(function (client) {
        return Q.all([
            client,
            Q.ninvoke(client, 'collection', actionFindOne(actions, 'collection'))
        ]);
    });
}

function makeOptinalFilterCbFn(fn) {
    return function (filter, cb) {
        var actions = this._actions;
        if (typeof filter === 'function') {
            cb = filter;
            filter = false;
        }
        if (filter) {
            actions = actions.concat([['filter', [filter]]]);
        }
        return fn(actions, cb);
    };
}

function makeArgOptionCbFn(fn) {
    return function (data, options, cb) {
        var actions = this._actions;
        if (options) {
            actions = actions.concat([['options', [options]]]);
        }
        return fn(actions, data, cb);
    };
}

// queries
function toCursor(actions) {
    var has_sort = actionFindOne(actions, 'sort'),
        sort = actionsMerge(actions, 'sort'),
        has_skip = actionFindOne(actions, 'skip'),
        skip = actionsAdd(actions, 'skip'),
        has_limit = actionFindOne(actions, 'limit'),
        limit = actionsLast(actions, 'limit'),
        find_one = !actionsFlag(actions, 'multi', 'one'),
        filter = actionsMerge(actions, 'filter'),
        fields = actionsMerge(actions, 'fields'),
        options = actionsMerge(actions, 'options');

    return getCollection(actions).spread(function (client, collection) {
        var obj = collection.find(filter, fields, options);
        if (has_sort) { obj = obj.sort(sort); }
        if (has_skip) { obj = obj.skip(skip); }
        if (has_limit) { obj = obj.limit(limit); }

        return [client, obj];
    });
}

function toArray(actions, cb) {
    var find_one = !actionsFlag(actions, 'multi', 'one');
    return toCursor(actions).spread(function (client, obj) {
        var d = Q.defer();
        obj.toArray(function (err, docs) {
            client.close();
            if (cb !== undefined) {
                cb.call(undefined, err, find_one ? docs[0] : docs);
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
    var has_limit = actionFindOne(actions, 'limit'),
        limit = actionsLast(actions, 'limit'),
        filter = actionsMerge(actions, 'filter'),
        options = actionsMerge(actions, 'options', {
            safe: actionsFlag(actions, 'safe', 'unsafe'),
            multi: !actionsFlag(actions, 'one', 'multi')
        });

    return getCollection(actions).spread(function (client, collection) {
        var d = Q.defer(), obj = collection;
        // We can only limit by one
        // http://docs.mongodb.org/manual/applications/delete/#remove
        // if (has_limit) {
        //     obj = obj.limit(limit);
        // }

        collection.remove(filter, options, function (err, docs) {
            client.close();
            if (cb !== undefined) {
                cb.call(undefined, err, docs);
            }
            if (err) {
                d.reject(err);
            } else {
                d.resolve(docs);
            }
        });

        return d.promise;
    });
}

function update(actions, objNew, cb) {
    var options = actionsMerge(actions, 'options', {
            safe: actionsFlag(actions, 'safe', 'unsafe'),
            multi: !actionsFlag(actions, 'one', 'multi')
        }),
        filter = actionsMerge(actions, 'filter');

    return getCollection(actions).spread(function (client, collection) {
        var d = Q.defer(), obj = collection;

        collection.update(filter, objNew, options, function (err, count) {
            client.close();
            if (cb !== undefined) {
                cb.call(undefined, err, count);
            }
            if (err) {
                d.reject(err);
            } else {
                d.resolve(count);
            }
        });

        return d.promise;
    });
}

function upsert(actions, objNew, cb) {
    return update(actions.concat([
        ['options', [{upsert: true}]]
    ]), objNew, cb);
}

function insert(actions, docs, cb) {
    var options = actionsMerge(actions, 'options', {
            safe: actionsFlag(actions, 'safe', 'unsafe')
        }),
        one = !(docs instanceof Array);

    return getCollection(actions).spread(function (client, collection) {
        var d = Q.defer(), obj = collection;

        collection.insert(docs, options, function (err, docs) {
            client.close();
            if (cb !== undefined) {
                cb.call(undefined, err, (one && docs) ? docs[0] : docs);
            }
            if (err) {
                d.reject(err);
            } else {
                d.resolve(one ? docs[0] : docs);
            }
        });

        return d.promise;
    });
}

function save(actions, doc, cb) {
    var options = actionsMerge(actions, 'options', {
            safe: actionsFlag(actions, 'safe', 'unsafe')
        }),
        one = true;

    return getCollection(actions).spread(function (client, collection) {
        var d = Q.defer(), obj = collection;

        collection.save(doc, options, function (err, doc) {
            client.close();
            if (cb !== undefined) {
                cb.call(undefined, err, doc);
            }
            if (err) {
                d.reject(err);
            } else {
                d.resolve(doc);
            }
        });

        return d.promise;
    });
}

function count(actions, cb) {
    var filter = actionsMerge(actions, 'filter');

    return getCollection(actions).spread(function (client, collection) {
        var d = Q.defer(), obj = collection;

        collection.count(filter, function (err, docs) {
            client.close();
            if (cb !== undefined) {
                cb.call(undefined, err, docs);
            }
            if (err) {
                d.reject(err);
            } else {
                d.resolve(docs);
            }
        });

        return d.promise;
    });
}

function findAndModify(actions, objNew, cb) {
    var sort = actionsMerge(actions, 'sort'),
        filter = actionsMerge(actions, 'filter'),
        fields = actionsMerge(actions, 'fields'),
        options = actionsMerge(actions, 'options');

    return getCollection(actions).spread(function (client, collection) {
        var d = Q.defer(), obj = collection;
        // wtf...
        obj.findAndModify({
            query: filter, 
            sort: sort, 
            remove: false,
            update: objNew, 
            new: true,
            fields: fields,
            upsert: false
        }, function (err, doc) {
            client.close();
            if (cb !== undefined) {
                cb.call(undefined, err, doc);
            }
            if (err) {
                d.reject(err);
            } else {
                d.resolve(doc);
            }
        });
        return d.promise;
    });
}

function cursor(obj) {
    if (!obj._cursor) {
        obj._cursor = toCursor(obj._actions);
    }
    return obj._cursor;
}

function wrapCursor(method) {
    return function (cb) {
        var that = this, args = _.toArray(arguments);
        cursor(this).spread(function (client, cursor) {
            cursor[method].apply(cursor, args);
        });
        return that;
    };
}

function wrapCursorPromise(method) {
    return function (cb) {
        var args = _.toArray(arguments);
        return cursor(this).then(function (cursor) {
            return Q.ninvoke.apply(Q, [cursor, method].concat(args));
        });
    };
}
function promiseCallback(p, cb) {
    if (typeof cb === 'function') {
        p.then(function (data) {
            cb(false, data);
        }, cb);
    }
    return p;
}

var magnolia = dsl.methods([
    /* Connection */
    'server',
    'db',
    'collection',

    /* Options */
    'filter', // find, merge
    'sort', // find, pushs infront
    'limit', // find remove, last
    'skip', // find, add
    'fields', // find, merge
    'options', // find, merge
    'one', // find remove, last
    'multi', // find remove, last
    'sort', // find

    'safe', // insert upsert update findAndModify? remove, last
    'unsafe' // insert upsert update findAndModify? remove, last

    // 'timeout' // last DO THIS
]).call('init', function () {
    throw new Error('TODO init magnolia');
}).call(function (collection, db) {
    var l = this._addAction(['collection', [collection]]); //.notCallable();
    if (db !== undefined) {
        l = l._addAction(['db', [db]]);
    }
    return l;
}).call('toArray', function (cb) {
    return toArray(this._actions, cb);
}).call('then', function () {
    /* Memoize! */
    if (!this._promise) {
        this._promise = toArray(this._actions);
    }
    return this._promise.then.apply(this._promise, arguments);
}).call('cursor', function (cb) {
    return promiseCallback(cursor(this), cb);
}).call('close', function (cb) {
    /* TODO: Queue cursor commands */
    if (this._cursor) {
        return this._cursor.spread(function (client, cursor) {
            client.close();
            cb();
        });
    }
    return promiseCallback(Q.defer().resolve(), cb);
})
    /* Cursor! */
    .call('nextObject', wrapCursorPromise('nextObject'))
    .call('once', wrapCursorPromise('once'))
    .call('each', function (cb) {
        var that = this, args = _.toArray(arguments);
        cursor(this).spread(function (client, cursor) {
            cursor.each(function (err, doc) {
                if (!doc) {
                    return client.close();
                }
                cb(doc);
            });
        });
        return that;
    })
    .call('on', wrapCursor('on'))
    .call('rewind', wrapCursor('rewind'))
    /* Operations! */
    .call('count', makeOptinalFilterCbFn(count))
    .call('remove', makeOptinalFilterCbFn(remove))
    // @TODO Fix findAndModify
    // .call('findAndModify', makeArgOptionCbFn(findAndModify))
    .call('update', makeArgOptionCbFn(update))
    .call('upsert', makeArgOptionCbFn(upsert))
    .call('insert', makeArgOptionCbFn(insert))
    .call('save', makeArgOptionCbFn(save))
    .done();

/**
 * That's right, chump.
 * @param {Function} fn
 * @return {Function}
 */
function newIsForChumps(fn) {
    return function () {
        var obj = Object.create(fn.prototype);
        fn.apply(obj, arguments);
        return obj;
    };
}

/* BSON Types */
['Long', 'ObjectID', 'Timestamp', 'DBRef', 'Binary', 'Code', 'Symbol',
    'MinKey', 'MaxKey', 'Double'].forEach(function (key) {
    magnolia[key] = newIsForChumps(mongodb[key]);
});

magnolia.merge = merge;

module.exports = magnolia;
