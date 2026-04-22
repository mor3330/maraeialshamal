const bcrypt = require('bcryptjs');
bcrypt.hash('1234', 10).then(h => console.log('Hash for 1234:', h));
