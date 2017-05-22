'use strict'

// return 1-2 capital letter initials from a string
exports.initialsOf = function(name) {
	let words = name.split(' ')
	let initials = words[0].charAt(0)

	if(words.length > 1){
	  initials = initials.concat(words[words.length-1].charAt(0))
	}

	initials = initials.toUpperCase()

	return initials
}
