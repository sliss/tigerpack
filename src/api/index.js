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

  // Invite a friend
  app.post('/friends/invitation', wrap(async function (body) {
    let {user_id, friend_id} = body

    // save friend_id to user's outgoing_friend_ids

    // save user_id to friend's incoming_friend_ids
    return {}
  }))

  // Respond to a friend invitation
  app.put('/friends/invitation', wrap(async function (body) {
    let {user_id, friend_id, accept} = body

    // if accepting invitation
    // remove friend_id from user's incoming_friend_ids; add to user's friend_ids
    // remove friend_id from user's incoming_friend_ids; add to user's friend_ids

    // if not accepting invitation
    // remove friend_id from user's incoming_friend_ids
    // remove user_id from friend's outgoing_friend_ids
    return {}
  }))

  // Remove a friend
  app.delete('/friends', wrap(async function (body) {
    let {user_id, friend_id} = body

    // remove friend_id from user's friend_ids, tracking_ids, sharing_ids, trackable_ids

    // remove user_id from friend's friend_ids, sharing_ids, trackable_ids

    return {}
  }))

  // Grant map-sharing permission to a friend
  app.post('/friends/location-sharing', wrap(async function (body) {
    let {user_id, friend_id} = body

    // save friend_id to user's sharing_ids
    // save user_id to friend's trackable_ids

    return {}
  }))

  // Revoke map-sharing permission to a friend
  app.delete('/friends/location-sharing', wrap(async function (body) {
    let {user_id, friend_id} = body

    // remove friend_id from user's sharing_ids
    // remove user_id from friend's trackable_ids

    return {}
  }))

  // Get user's current friends, and potential friends who've sent the user a friend request.
  app.get('/friends', wrap(async function (params) {
    const { user_id } = params
    const user = await db.collection('User').findOne({
      _id: Archetype.to(user_id, ObjectId)
    })
    console.log('user', user)

    const {incoming_friend_ids, friend_ids} = user
    console.log('incoming_friend_ids', incoming_friend_ids)

    const incomingFriends = await db.collection('User').find({_id:{$in:incoming_friend_ids}}).toArray()
    console.log('incomingFriends', incomingFriends)

    const friends = await db.collection('User').find({_id:{$in:friend_ids}}).toArray()
    console.log('friends', friends)

    return { friends }
  }))

  // ### Check-ins

  // get check-ins from all friends.  get tracking coords from intersection of trackable_ids and sharing_ids
  app.get('/check-ins', wrap(async function (params) {
    const { user_id } = params
    const user = await db.collection('User').findOne({
      _id: Archetype.to(user_id, ObjectId)
    })
    console.log('user', user)

    const {friend_ids, trackable_ids, sharing_ids} = user

    // get all checkins that contain a friend_id

    // for the trackable_ids the user wishes to share/see, output trackings
    

    return { /*stuff*/ }
  }))

  // TODO
  // post check-in
  app.post('/check-ins', wrap(async function (body) {
    const { user_id, lat, long } = body

    // upsert check-in doc.  db only stores the single most recent check-in
    
    // ****** TODO: Zone magic ***************

    const check_in = await db.collection('CheckIn').insert(doc)
    let checkInObj = check_in.ops[0]

    return {}
  }))

  // delete check-in
  app.delete('/check-ins', wrap(async function (params) {
    const { user_id } = params
    
    // delete user's check-in 

    return {}
  }))


  // ### Config

  // get config info
  app.get('/config', wrap(async function () {
    const config = {
      send_check_in_frequency: 60,
      get_check_in_frequency: 60,
      get_geo_check_in_frequency: 60,
      send_geo_check_in_frequency: 60,
    }

    return {config}
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

