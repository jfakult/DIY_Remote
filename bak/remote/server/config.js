const fs = require("fs")

var config = {}

config.USER_ID_LENGTH = 32
config.TOKEN_LENGTH = 32
config.DEVICE_ID_LENGTH = 32
config.DEVICE_SECRET_KEY_LENGTH = 32

config.MASTER_PASSWORD = "12345"
config.PASS_LENGTH = 5

config.BACKEND_PORT = 6011
config.REMOTE_SOCKET_PORT = 6013
config.DEVICE_SOCKET_PORT = 6014
config.SSL_KEY_DIR = "/etc/letsencrypt/live/home.fakult.net/";
config.HTTP_OPTIONS = {
  key: fs.readFileSync(config.SSL_KEY_DIR + 'privkey.pem'),
  cert: fs.readFileSync(config.SSL_KEY_DIR + 'cert.pem')
//  ca: fs.readFileSync(keyDir + 'ca.pem')
};


config.TAGS = {
	LIGHTS: "lights",
	LOCKS: "locks",
	TEMPERATURE: "temperature",
	HUMIDITY: "humidity",
	MOISTURE: "moisture",
	MOTORS: "motors",
	RGBLIGHTS: "rgblights"
}

module.exports = config
