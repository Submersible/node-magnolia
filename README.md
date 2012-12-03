# magnolia&ndash;A beautiful MongoDB driver w/ Q

Don't nest callbacks anymore than you have to!  Magnolia implements a coherent,
lazy, & chainable interface... with promises!

## Init

If you don't mind state, you can init the module's state with default options.

```javascript
var mongo = require('magnolia'),
    ObjectID = mongo.ObjectID;

mongo.init({
    db: 'hello',
    server: {host: 'localhost', port: 27117},
    w: 1
});
```

Or you can start a chain with the defaults you would like.

```javascript
var mongo = require('magnolia')
    .server({host: 'localhost', port: 27117)
    .db('hello')
    .options({w: 1});
```

## Find

```javascript
magnolia('user')
    .filter({_id: ObjectID('4e4e1638c85e808431000003')}) // filter!
    .one() // just find one!
    .then(...); // evaluate!
```

* `.limit(n).skip(m)` to control paging.
* `.sort(fields)` Order by the given fields. There are several equivalent syntaxes:
  * `.sort({field1: -1, field2: 1})` descending by field1, then ascending by field2.
  * `.sort([['field1', 'desc'], ['field2', 'asc']])` same as above
  * `.sort([['field1', 'desc'], 'field2'])` same as above
  * `.sort('field1')` ascending by field1

### Find and modify

```javascript
magnolia('user')
    .filter(query)
    .sort(sort)
    .options(options)
    .findAndModify(update, [options], [callback]);
```

Useful options:

* `.filter(...)`
* `.sort(...)`
* `.options(...)`
    * `remove:true` set to a true to remove the object before returning
    * `new:true` set to true if you want to return the modified object rather than the original. Ignored for remove.
    * `upsert:true` Atomically inserts the document if no documents matched.

## Remove

## Insert

## Update; update and insert (upsert)

Signature:

```javascript
magnolia('user')
    .filter(criteria)
    .update(objNew, [callback]);
```

```javascript
magnolia('user')
    .filter(criteria)
    .upsert(objNew, [callback]);
```

Useful options:

* `.filter(...)`
* `safe:true` Should always set if you have a callback.
* `multi:true` If set, all matching documents are updated, not just the first.
* `upsert:true` Atomically inserts the document if no documents matched.

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
