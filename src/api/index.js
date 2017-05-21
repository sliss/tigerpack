'use strict'

const Archetype = require('archetype-js')
const { ObjectId } = require('mongodb')
const express = require('express')

module.exports = db => {
  const app = express()

  app.get('/users/:id', wrap(async function (params) {
    const { id } = params
    const user = await db.collection('User').findOne({
      _id: Archetype.to(id, ObjectId)
    })
    return { user }
  }))

  app.get('/users', wrap(async function () {
    const users  = await db.collection('User').find().toArray()
    return { users }
  }))

  return app
}

function wrap(fn) {
  return (req, res) => {
    const params = Object.assign({}, req.query, req.body, req.params)
    fn(params).then(
      result => res.json(result),
      err => res.status(500).json({ message: err.message })
    )
  }
}
