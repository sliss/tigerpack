'use strict'

const { MongoClient } = require('mongodb')
const api = require('./src/api')
const config = require('./config')

MongoClient.connect(`mongodb://localhost:27017/${config.db}`)
  .then(db => api(db).listen(config.port))
  .catch(error => console.error(error.stack))
