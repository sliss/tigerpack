'use strict'

const { MongoClient } = require('mongodb')
const api = require('../src/api')
const assert = require('assert')
const superagent = require('superagent')

let db

before(async function () {
  db = await MongoClient.connect('mongodb://localhost:27017/test')

  const app = api(db)
  app.listen(3000)

  await db.dropDatabase()
})

describe('Users', function () {
  let doc

  before(async function () {
    doc = {
      name: 'Bob Mueller',
      year: 1966
    }

    await db.collection('User').insertOne(doc)
  })

  it('findById', async function () {
    const { user } = await _request('get', `/users/${doc._id}`)
    assert.equal(user.name, 'Bob Mueller')
    assert.equal(user.year, 1966)
  })

  it('find', async function () {
    const { users } = await _request('get', '/users')
    assert.equal(users.length, 1)
    const [user] = users
    assert.equal(user.name, 'Bob Mueller')
    assert.equal(user.year, 1966)
  })
})

function _request (method, relative) {
  return superagent[method](`http://localhost:3000${relative}`)
    .then(res => res.body)
}
