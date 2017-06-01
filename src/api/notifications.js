'use strict'

const superagent = require('superagent')
const config = require('../../config')

const firebase_url = config.firebase_url
const firebase_server_key = config.firebase_server_key
const test_token = 'cxK_1grCkOw:APA91bEO6aVEJE0TEBlHj7rBClDneWn3xLU9UslxIHAi0MOCRMP-3k8a2T6BOdLOOW3DDP3B0xoE701q7FaxBXsXa5epCZbJruijL0RcnsMRtaWNfR6X4Mur9J8bjO4LOBJhq9VOes-s'

exports.sendNotification = function(firebase_token, title, body) {
  console.log('send notification', title, body)
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

