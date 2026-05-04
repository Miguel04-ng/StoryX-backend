const bcrypt = require('bcryptjs')
bcrypt.hash('Password1A', 12).then(h => console.log(h))