'use strict'

const { MongoClient } = require('mongodb')
const api = require('./src/api')

MongoClient.connect('mongodb://localhost:27017/tigerpack')
  .then(db => api(db).listen(3000))
  .catch(error => console.error(error.stack))
