'use strict'

const Archetype = require('archetype-js')
const { ObjectId } = require('mongodb')
const turf = require('turf');
const express = require('express')
const bodyParser = require('body-parser')

const notifications = require('./notifications')
const utils = require('../utils/utils')

module.exports = db => {
  const app = express()
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  // ### Users

  // ## get all users.  if user_id query string provided, get that user
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

  // ## create a new user and return it.  if email is already taken, return existing user.
  app.post('/users', wrap(async function (body) {
    console.log('creat user:', body)
    let {name, email, year, lat, long} = body

    // create new user document
    let objId = new ObjectId()

    let doc = {
      _id: objId,
      user_id: objId.toHexString(),
      name: name,
      initials: utils.initialsOf(name),
      email: email,
      year: parseInt(year),
      last_check_in_time: 0,
      location: {
        type: "Point",
        coordinates:[-74.659413,40.348598]
      },
      friend_ids:[],
      outgoing_friend_ids:[],
      incoming_friend_ids:[],
      trackable_ids:[],
      sharing_ids:[],
      group_ids:[],
      incoming_group_ids:[],
      firebase_token:null
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

// ## update user w firebase key
  app.put('/users', wrap(async function (body) {
    console.log('update user:', body)
    let {user_id, firebase_token} = body

    const user  = await db.collection('User').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {
        $set: {
          firebase_token: firebase_token}
      }
    )
    return { user }
  }))

  
  // ### Friends

  // ## Invite a friend
  app.post('/friends/invitations', wrap(async function (body) {
    let {user_id, friend_id} = body
    console.log('invite friend', body)

    // save friend_id to user's outgoing_friend_ids
    let user = await db.collection('User').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {$addToSet:{outgoing_friend_ids: friend_id}}
    )

    // save user_id to friend's incoming_friend_ids
    let friend = await db.collection('User').update(
      {_id: Archetype.to(friend_id, ObjectId)},
      {$addToSet:{incoming_friend_ids: user_id}}
    )

    friend = await db.collection('User').findOne(
      {_id: Archetype.to(friend_id, ObjectId)}
    )

    // if friend has fb token, send new-friend push notification
    if(true){//if(friend.firebase_token){
      user = await db.collection('User').findOne(
        {_id: Archetype.to(user_id, ObjectId)}
      )
    
      console.log('sending user', user)
      console.log('friend', friend)

      const title = 'New friend request'
      const body = `${user.name} ${user.year} wants to join your pack!`
      await notifications.sendNotification(friend.firebase_token, title, body)
    }

    return {user, friend}
  }))

  // ## Respond to a friend invitation
  app.put('/friends/invitations', wrap(async function (body) {
    console.log('respond to invite', body)
    let {user_id, friend_id, accept} = body
    let user, friend
    // if accepting invitation
    if(accept==true){
      console.log('accept friend', friend_id)
      // remove friend_id from user's incoming_friend_ids; add to user's friend_ids
      user = await db.collection('User').update(
        {_id: Archetype.to(user_id, ObjectId)},
        {$pull:{incoming_friend_ids: friend_id}}
      )

      user = await db.collection('User').update( // ought to be able to combine update ops, but didn't work...
        {_id: Archetype.to(user_id, ObjectId)},
        {$addToSet:{friend_ids: friend_id}}
      )
      

      // remove user_id from friend's outgoing_friend_ids; add user_id to friend's friend_ids
      friend = await db.collection('User').update(
        {_id: Archetype.to(friend_id, ObjectId)},
        {$pull:{outgoing_friend_ids: user_id}},
        {$addToSet:{friend_ids: user_id}}
      )

      friend = await db.collection('User').update(
        {_id: Archetype.to(friend_id, ObjectId)},
        {$addToSet:{friend_ids: user_id}}
      )
    }
    // reject invitation
    else {
      console.log('reject friend')

      // remove friend_id from user's incoming_friend_ids
      user = await db.collection('User').update(
        {_id: Archetype.to(user_id, ObjectId)},
        {$pull:{incoming_friend_ids: friend_id}}
      )

      // remove user_id from friend's outgoing_friend_ids
      friend = await db.collection('User').update(
        {_id: Archetype.to(friend_id, ObjectId)},
        {$pull:{outgoing_friend_ids: user_id}}
      )
    }

    return {user, friend}
  }))

  // ## Remove a friend
  app.delete('/friends', wrap(async function (body) {
    console.log('delete friend', body)
    let {user_id, friend_id} = body
    let user, friend

    // remove friend_id from user's friend_ids, sharing_ids, trackable_ids
    user = await db.collection('User').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {$pull:{friend_ids: friend_id}}
    )
    user = await db.collection('User').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {$pull:{sharing_ids: friend_id}}
    )
    user = await db.collection('User').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {$pull:{trackable_ids: friend_id}}
    )
    // remove user_id from friend's friend_ids, sharing_ids, trackable_ids
    friend = await db.collection('User').update(
      {_id: Archetype.to(friend_id, ObjectId)},
      {$pull:{friend_ids: user_id}}
    )
    friend = await db.collection('User').update(
      {_id: Archetype.to(friend_id, ObjectId)},
      {$pull:{sharing_ids: user_id}}
    )
    friend = await db.collection('User').update(
      {_id: Archetype.to(friend_id, ObjectId)},
      {$pull:{trackable_ids: user_id}}
    )

    return {user, friend}
  }))

  // ## Grant map-sharing permission to a friend
  app.post('/friends/location-sharing', wrap(async function (body) {
    console.log('grant location sharing', body)
    let {user_id, friend_id} = body

    // save friend_id to user's sharing_ids
    let user = await db.collection('User').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {$addToSet:{sharing_ids: friend_id}}
    )
    
    // save user_id to friend's trackable_ids
    let friend = await db.collection('User').update(
      {_id: Archetype.to(friend_id, ObjectId)},
      {$addToSet:{trackable_ids: user_id}}
    )

    return {user, friend}
  }))

  // ## Revoke map-sharing permission to a friend
  app.delete('/friends/location-sharing', wrap(async function (body) {
    console.log('revoke location sharing', body)

    let {user_id, friend_id} = body

    // remove friend_id from user's sharing_ids
    let user = await db.collection('User').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {$pull:{sharing_ids: friend_id}}
    )

    // remove user_id from friend's trackable_ids
    let friend = await db.collection('User').update(
      {_id: Archetype.to(friend_id, ObjectId)},
      {$pull:{trackable_ids: user_id}}
    )

    return {user, friend}
  }))

  // ## Get user's current friends, and potential friends who've sent the user a friend request.
  app.get('/friends', wrap(async function (params) {
    console.log('get friends for', params)

    // get only fields enumerated in the projection
    const friendProjection = {user_id:1, name:1, initials:1, year:1}
    const { user_id } = params
    const user = await db.collection('User').findOne({
      _id: Archetype.to(user_id, ObjectId)
    })
    console.log('user', user)

    const {incoming_friend_ids, friend_ids} = user
    console.log('incoming_friend_ids', incoming_friend_ids)

    const incoming_invites = await db.collection('User').find({user_id:{$in:incoming_friend_ids}}, friendProjection).toArray()
    console.log('incomingFriends', incoming_invites)

    const friends = await db.collection('User').find({user_id:{$in:friend_ids}}, friendProjection).toArray()
    console.log('friends', friends)

    return { friends, incoming_invites }
  }))

  // ## get all invitable (potential) friends and their friendship status vis a vis the current user
  app.get('/friends/invitations', wrap(async function (params) {
    console.log('get all invitable friends for', params)
    const { user_id } = params

    const currentUser = await db.collection('User').findOne({
      _id: Archetype.to(user_id, ObjectId)
    })

    // sort user fields to reduce search time for each user
    currentUser.friend_ids = currentUser.friend_ids.sort()
    currentUser.incoming_friend_ids = currentUser.incoming_friend_ids.sort()
    currentUser.outgoing_friend_ids = currentUser.outgoing_friend_ids.sort()

    const userProjection = {user_id:1, name:1, initials:1, year:1}
    // start by getting *all* users
    const friends  = await db.collection('User').find({_id:{$ne: Archetype.to(user_id, ObjectId)}}, userProjection).toArray()
    console.log('all users except current', currentUser)
    
    for(let friend of friends){
      console.log('the itarated friend', friend)
      // existing friend
      if(currentUser.friend_ids.includes(friend.user_id)){
        friend.friendship = 'friends'
      }
      // friend has invited this user
      else if(currentUser.incoming_friend_ids.includes(friend.user_id)){
        friend.friendship = 'incoming'
      }
      // user has invited this friend
      else if(currentUser.outgoing_friend_ids.includes(friend.user_id)){
        friend.friendship = 'outgoing'
      }
      // user has no friendship with this friend
      else {
        friend.friendship = 'none'
      }
    }


    return { invitable_friends:friends }
  }))

  // ### Check-ins

  // ## get check-ins from all friends.  get tracking coords from intersection of trackable_ids and sharing_ids
  app.get('/check-ins', wrap(async function (params) {
    const { user_id } = params
    const user = await db.collection('User').findOne({
      _id: Archetype.to(user_id, ObjectId)
    })

    const {friend_ids, trackable_ids, sharing_ids, location} = user

    // get all friends' check-ins
    let all_check_ins = await db.collection('CheckIn').find({
      user_id:{$in:friend_ids}
    }).toArray()

    // console.log('all checkins', all_check_ins)
    // build checkin list. add/subtract fields as necessary for client
    let check_ins = []
    let allZones = []
    
    for(let checkIn of all_check_ins){
      console.log('checkin:', checkIn)

      checkIn.distance = turf.distance(location.coordinates, checkIn.location.coordinates, "miles")
      console.log('checkin distance:', checkIn.distance)

      checkIn.initials = utils.initialsOf(checkIn.name)
      const sharingWith = user.sharing_ids.includes(checkIn.user_id)
      const tracking = user.trackable_ids.includes(checkIn.user_id)
      let status

      if(sharingWith && tracking){
        status = 'mutual'
      }
      else if(sharingWith){
        status = 'outgoing'
      }
      else if(tracking){
        status = 'incoming'
      }
      else {
        status = 'none'
      }

      if(checkIn.zone_name == null){
        checkIn.zone_name = checkIn.distance.toFixed(1).toString() + ' mi'
      }

      checkIn.sharing_status = status

      const {user_id, name, initials, year, zone_name, distance, sharing_status} = checkIn
      check_ins.push({user_id, name, initials, year, zone_name, distance, sharing_status})
    }

    // for the trackable_ids the user wishes to share/see, output trackings
    let trackings = []
    for(let tracking of all_check_ins){
      // if user has tracking permission for this user
      if(trackable_ids.includes(tracking.user_id)){
        tracking.initals = utils.initialsOf(tracking.name)
        tracking.lat = tracking.location.coordinates[1]
        tracking.long = tracking.location.coordinates[0]
        const {user_id, name, initials, year, lat, long} = tracking
        trackings.push({user_id, name, initials, year, lat, long})
      }
    }
    

    return {check_ins, trackings }
  }))

  // TODO
  // post check-in
  app.post('/check-ins', wrap(async function (body) {
    console.log('create checkin for', body)
    const { user_id, lat, long } = body
    const geoCoords = [parseFloat(long),parseFloat(lat)]

    const user = await db.collection('User').findOne({
      _id: Archetype.to(user_id, ObjectId)
    })

    // find which zone (if any) user's coords intersect
    const zone = await db.collection('Zone').findOne({
      border: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: geoCoords
          }
        }
      }
    })

    console.log('intersecting zone result:', zone)

    // create check_in doc, save to DB
    const objId = new ObjectId()
    let doc = {
      check_in_id: objId.toHexString(),
      user_id: user_id,
      name: user.name,
      year: user.year,
      location: {
        type: "Point",
        coordinates: geoCoords
      },
      timestamp:objId.getTimestamp(),
      zone_id: null,
      zone_name: null
    }

    // user is not within a zone, leave zone fields null
    if(zone != null){
      doc.zone_id = zone.zone_id
      doc.zone_name = zone.zone_name
    }
    
    const check_in = await db.collection('CheckIn').update(
      {user_id:user.user_id},
      doc,
      {upsert:true}
    )

    // update user's location
    const saveUser = await db.collection('User').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {
        $set: {
          location: {
            type: 'Point',
            coordinates: geoCoords
          }
        }
      },
      {upsert:true}
    )

    return {check_in}
  }))

  // delete check-in
  app.delete('/check-ins', wrap(async function (body) {
    const { user_id } = body
    
    // delete user's check-in 
    const check_in = await db.collection('CheckIn').deleteOne({user_id:user_id})

    return {check_in}
  }))


  // ### Config

  // ## get config info
  app.get('/config', wrap(async function () {
    const config = {
      send_check_in_frequency: 60,
      get_check_in_frequency: 60,
      get_geo_check_in_frequency: 60,
      send_geo_check_in_frequency: 60,
    }

    return {config}
  }))

  // ### Chat Groups

  // ## create new chat group
  app.post('/groups', wrap(async function (body) {
    let {user_id, group_name} = body
    console.log('create group', body)
    const objId = new ObjectId()
    const groupDoc = {
      _id: objId,
      group_id: objId.toHexString(),
      group_name: group_name,
      member_ids: [user_id]
    }

    const group = await db.collection('Group').insert(groupDoc)

    return {group}
  }))

  // ## get user's groups
  app.get('/groups', wrap(async function (params) {
    let {user_id} = params
    console.log('get groups for', user_id)

    const user = await db.collection('User').findOne({
      _id: Archetype.to(user_id, ObjectId)
    })

    const groups = await db.collection('Group').find({
      user_id:{$in:user.group_ids}
    }).toArray()

    console.log('groups:', groups)

    return {groups}
  }))


  // invite friends to chat group
  app.post('/groups/invitations', wrap(async function (body) {
    let {user_id, group_id, friend_ids} = body

    // add the group_id of the invitation to all the friends the user has invited
    invited_friends = await db.collection('User').update(
      {user_id:{$in:friend_ids}},
      {
        $addToSet:{incoming_group_ids: group_id}
      }
    )

    group = await db.collection('Group').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {
        $addToSet:{
          pending_member_ids: {
            $each: friend_ids
          }
        }
      }
    )
  
    return {invited_friends}
  }))

  // accept/decline invite to chat group
  app.put('/groups/invitations', wrap(async function (body) {
    let {user_id, group_id, accept} = body
  
    if(accept){

    }
    else {

    }


    // regardless, remove user from group's pending_member_ids
    await db.collection('Group').update(
      {_id: Archetype.to(user_id, ObjectId)},
      {
        $pull:{pending_member_ids: user_id}
      }
    )    

    return {}
  }))

  // leave chat group
  app.delete('/groups/invitations', wrap(async function (body) {
    let {user_id, group_id} = body


  
    return {}
  }))

  // ### Admin
  // ## create zone
  app.post('/zones', wrap(async function (body) {
    let { zone_name, coordinates } = body
    let objId = new ObjectId()
    let centroid = [0,0]
    
    // calculate centroid
    for(let i = 0; i < coordinates.length; i++){
      centroid[0] += parseFloat(coordinates[i][0])
      centroid[1] += parseFloat(coordinates[i][1])
      
    }

    centroid[0] /= coordinates.length
    centroid[1] /= coordinates.length

    const doc = {
      _id: objId,
      zone_id: objId.toHexString(),
      zone_name: zone_name,
      centroid: {
        type: "Point",
        coordinates: centroid
      },
      border: {
        type: "Polygon",
        coordinates: [coordinates]
      }
    }

    const zone  = await db.collection('Zone').insert(doc)

    return {zone}
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

