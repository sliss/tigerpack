'use strict'

const superagent = require('superagent')
const config = require('../../config')

const firebase_url = config.firebase_url
const firebase_server_key = config.firebase_server_key

exports.sendNotification = function(firebase_token, title, body) {
  console.log('send notification', title, body, firebase_token)
  console.log('fb auth:', firebase_server_key)
  console.log('fb url:', firebase_url)
  return superagent.post(firebase_url)
    .set('Authorization', `key=${firebase_server_key}`)
    .send({
      "to" : firebase_token,
      "notification" : {
        "body" : body,
        "title" : title,
        "icon" : "myicon"
      }
    })
    .then(res => res.body)
}

