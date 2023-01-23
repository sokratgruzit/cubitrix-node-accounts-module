const {Schema, model, mongoose} = require('mongoose');

const schema = new Schema({
   value: {
		type: String,
		unique: true,
		default: "USER"
	}
},{
	timestamps: true
})

module.exports = model('Role', schema);