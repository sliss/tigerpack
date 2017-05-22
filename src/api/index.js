'use strict'

const Archetype = require('archetype-js')
const { ObjectId } = require('mongodb')
const express = require('express')
const bodyParser = require('body-parser')
const utils = require('../utils/utils')

module.exports = db => {
  const app = express()
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  // ### Users

  // get all users.  if user_id query string provided, get that user
  app.get('/users', wrap(async function (params) {
    if(params.hasOwnProperty('user_id')){
      const { user_id } = params
      const user = await db.collection('User').findOne({
        _id: Archetype.to(user_id, ObjectId)
      })
      return { user }
    }
    else {
      const users  = await db.collection('User').find().toArray()
      return { users }
    }
  }))

  // create a new user and return it.  if email is already taken, return existing user.
  app.post('/users', wrap(async function (body) {
    let {name, email, year, lat, long} = body

    // create new user document
    let objId = new ObjectId()

    let doc = {
      _id: objId,
      user_id: objId.toHexString(),
      name: name,
      initials: utils.initialsOf(name),
      email: email,
      year: year,
      last_check_in_time: 0,
      location: {
        type: "Point",
        coordinates:[long,lat]
      },
      friend_ids:[],
      outgoing_friend_ids:[],
      incoming_friend_ids:[],
      super_friend_ids:[]
    }

    // if email is taken, do not create new user; instead return existing user
    // TODO: unhandled edge case: >1 doc already exist w same email.  *should* be impossible...

    // TODO: perform initial check-in
    let sameEmail = await db.collection('User').findOne({email:email})

    if(sameEmail == null){
      const user  = await db.collection('User').insert(doc)
      let userObj = user.ops[0]
      userObj.lat = userObj.location.coordinates[1]
      userObj.long = userObj.location.coordinates[0]
      delete userObj.location

      return {user:userObj}
    }
    else {
      sameEmail.lat = sameEmail.location.coordinates[1]
      sameEmail.long = sameEmail.location.coordinates[0]
      delete sameEmail.location
      return {user:sameEmail}
    }
    
  }))

  
  // ### Friends

  // Get user's current friends, and potential friends who've sent the user a friend request.
  // app.get('/friends/:id', wrap(async function (params) {
  // const users  = await db.collection('User').find().toArray()
  // return { users }
  // }))

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

