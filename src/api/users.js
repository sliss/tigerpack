'use strict'

// ## get all users.  if user_id query string provided, get that user
exports.getUsers = async function (params, db) {
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
}
