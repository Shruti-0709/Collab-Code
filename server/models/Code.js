// models/Code.js
const mongoose = require('mongoose');

const codeSchema = new mongoose.Schema({
    roomId: { type: String, required: true },
    code: { type: String, required: true },
});

const Code = mongoose.model('Code', codeSchema);
module.exports = Code;
