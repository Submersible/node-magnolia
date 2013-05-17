# magnolia&ndash;A beautiful MongoDB driver w/ Q [![Build Status](https://secure.travis-ci.org/Submersible/node-magnolia.png?branch=master)](http://travis-ci.org/Submersible/node-magnolia)

Magnolia implements a coherent, lazy, & chainable interface... with promises!
Don't nest callbacks anymore than you have to!

## Init

If you don't mind state, you can init the module's state with default options.

```javascript
var mongo = require('magnolia'),
    ObjectID = mongo.ObjectID;

mongo
    .server('localhost', 27117)
    .db('hello')
    .options({w: 1})
    .init(); // makes all the previous calls stored as defaults
```

Or you can start a chain with the defaults you would like.

```javascript
var mongo = require('magnolia')
    .server({host: 'localhost', port: 27117)
    .db('hello')
    .options({w: 1});
```

## Connection

* `magnolia(collection, [db])`
* `.collection(collection)`
* `.db(db)`
* `.server(server)`
* `.options(...)`
  * `m:1`
  * `journal:true`
  * `fsync:true`
  * `slaveOk:true`

## Find

```javascript
magnolia('user')
    .filter({_id: ObjectID('4e4e1638c85e808431000003')}) // filter!
    .one() // just find one!
    .then(function (user) { // evaluate as a promise
        console.log('hello', user.name);
    });

magnolia('user')
    .filter({hello: 'world'})
    .toArray(function (err, docs) { /* ... */ });
```

* `.toArray([cb])` Query the collection, otherwise it will be lazily queried when you evaluate the chain as a promise
* `.filter(criteria)` Filter the collection
* `.one()` Find one!  And return the document, instead of a list.
* `.limit(n).skip(m)` to control paging.
* `.sort(fields)` Order by the given fields. There are several equivalent syntaxes:
  * `.sort([['field1', 'desc'], ['field2', 'asc']])`
  * `.sort([['field1', 'desc'], 'field2'])`
  * `.sort('field1')` ascending by field1

### Find and modifiy

```javascript
magnolia('user')
    .filter(query)
    .sort(sort)
    .options(options)
    .findAndModify(objNew, [options], [callback]);
```

Useful options (including the previous options):

* `.filter(...)`
* `.sort(...)`
* `.options(...)`
    * `remove:true` set to a true to remove the object before returning
    * `new:true` set to true if you want to return the modified object rather than the original. Ignored for remove.
    * `upsert:true` Atomically inserts the document if no documents matched.

## Remove

```javascript
magnolia('user')
    .filter(query)
    .remove(extra_query)
    .then(function (remove_count) { /* ... */ });
```

## Insert

```javascript
magnolia('user')
    .insert({name: 'ryan', company: 'Submersible'}, {safe: true})
    .then(function (doc) { /* ... */ });

magnolia('user')
    .safe()
    .insert([{foo: 'bar'}, {hello: 'world'}], function (err, docs) {
        /* ... */
    });
```

* `.safe()` or `.unsafe()` Make sure document is in the database before returning
* `.options(...)`
    * `safe:true`

## Update; update and insert (upsert)

Signature:

```javascript
magnolia('user')
    .filter(criteria)
    .update(update, [options], [callback]);
```

```javascript
magnolia('user')
    .filter(criteria)
    .upsert(objNew, [options], [callback]);
```

Useful options:

* `.filter(...)`
* `.one()` or `.multi()`
* `.safe()` or `.unsafe()`
* `.options(...)`
  * `safe:true` Should always set if you have a callback.
  * `multi:true` If set, all matching documents are updated, not just the first.
  * `upsert:true` Atomically inserts the document if no documents matched.

## Save

Performs an update if there's an `_id`, and an insert if not!

```javascript
magnolia('user').save({_id: ObjectID('50c03c9c766c8598e0000002'), foo: 'bar'}); // update
magnolia('user').save({hello: 'world'}); // insert
```

## Count

```javascript
magnolia('user').count([filter], [cb]);
```

## Map/reduce

## Data types

```javascript
magnolia.Long(numberString)
magnolia.ObjectID(hexString)
magnolia.Timestamp()
magnolia.DBRef(collectionName, id, dbName)
magnolia.Binary(buffer)
magnolia.Code(code, [context])
magnolia.Symbol(string)
magnolia.MinKey()
magnolia.MaxKey()
magnolia.Double(number)
```

