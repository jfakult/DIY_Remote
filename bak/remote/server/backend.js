const express = require('express');
const app = express();
const bodyParser = require("body-parser")
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const cookies = require("cookie-parser")
app.use(cookies())

const https = require("https")
const fs = require("fs")

const config = require("./config.js")

const path = require("path")

var db = require("./db")
var tools = require("./tools")

const baseURL = "https://localhost:6011"
const basePath = "/remote/backend/"

const ABS_SCRIPT_PATH = path.resolve(".") + "/"
const MAX_POLL_TRIES = 3
var master_token = {}

app.route(basePath + "poll")
	.get( (req, res) => pollAllDevices(req, res) )
	.post( (req, res) => pollSingleDevice(req, res) )

function initializeServer()
{
	db.db_read("master_token", function(err, result)
	{
		if (err)
		{
			console.log("Error reading master token")
		}
		else if (result == null)
		{
			console.log("No master token found")
		}
		else
		{
			master_token = tools.toJSON(result, ["token", "expiration"])
			db.db_read("token:" + master_token.token, function(err, result) {
				if (err)
				{
					console.log("Error reading master token user")
				}
				else if (result == null)
				{
					console.log("Master token lookup was empty")
				}
				else
				{
					var master_token = tools.toJSON(result, ["user_id", "expiration"])
					//master_token = 
					/*db.db_read("user:" + master_user.user_id, function(err, result) {
						if (err)
						{
							console.log("Error reading master token user")
						}
						else if (result == null)
						{
							console.log("Master user lookup was empty")
						}
						else
						{
							var master_user_data = tools.toJSON(result, ["tokens"])
							if (master_user_data.tokens.length == 0)
							{
								master_token_exp = 0
							}
							else
							{
								master_token_exp = master_user_data.tokens[0]["expiration"]
								//console.log("Server init gave:", master_token, master_token_exp)
							}
						}
					})*/
				}
			})
		}
	})
}
initializeServer()

app.post(basePath + "authenticate", function (req, res) {
	const pass = parseInt(req.body.pass.toString()).toString()
	
	db.db_read("password:" + pass, (err, result) => {
		if (pass.length != config.PASS_LENGTH || result == null)
		{
			res.send("Invalid password")
		}
		else
		{
			var password = tools.toJSON(result, ["user_id"])
			var user_id = password.user_id

			const midnight = tools.midnight()
			const token = { "token": tools.gen_random_string(config.TOKEN_LENGTH), "expiration": midnight }

			db.db_write("token:" + token.token, tools.toJSONSting(token))

			db.db_read("user:" + user_id, function(err, result) {
				if (err || result === null)
				{
					console.log("No user found here... what?")
					res.send("{}")
				}
				else // Clear all older tokens
				{
					const user_data = tools.toJSON(result, ["tokens"])
					const tokens = user_data.tokens

					for (t in tokens)
					{
						db.db_del("token:" + t, (a,b)=>{})
					}

					user_data.tokens = [{ "token": token, "expiration": midnight }]
					db.db_write("user:" + user_id, tools.toJSONString(user_data))

					//console.log("Pass is", pass, config.MASTER_PASSWORD, token)
					if (pass == config.MASTER_PASSWORD)
					{
						db.db_write("master_token", tools.toJSONString(token))
						master_token = token
					}

					db.db_del_at_midnight("token", token)
				
					res.send(tools.toJSONString(token))
				}
			})
		}
	})
})

app.get(basePath + "bootstrap", function (req, res) {
	const fileContents = fs.readFileSync("static/bootstrap.py", "utf8")
	res.send(fileContents)
})

app.get(basePath + "logout", function (req, res) {
	console.log("Deleting token and logging out:", req.cookies.token)
	db.db_del("token:" + req.cookies.token, (err,result) => {
		if (err)
		{
			console.log("Error looking up token:", req.cookies.token)
		}
		res.redirect("/remote")
	})
})

// TODO: permatokens / secret key (new one registered per connection / per day)
// TODO: Bind device_id to user "devices"
app.post(basePath + "register_device", function (req, res) {
	const user_data = req.body.registry
	
	db.db_read("token:" + user_data.token, (err, result) => {
		device_ids = []
		if (result == null)
		{
			res.send("Invalid token")
		}
		else if (err)
		{
			res.send("Error getting token during device registry")
		}
		else
		{
			// TODO: Check for existing devices
			var token = tools.toJSON(result)
			var project_name = user_data.project_name
			var project_location = user_data.project_location
			var ssh_port = user_data.ssh_port
			
			for (var i = 0; i < user_data.devices.length; i++)
			{
				var device = user_data.devices[i]
				const device_id = tools.gen_random_string(config.DEVICE_ID_LENGTH)
				const device_secret_key = tools.gen_random_string(config.DEVICE_SECRET_KEY_LENGTH)
				device_ids.push(device_id)
				if (device.device_id)
					device.device_id = device_id

				var device_data = {
					"owner_id": user_id,
					"project_name": project_name,
					"project_location": project_location,
					"ssh_port": ssh_port,
					"device_id": device_id,
					"secret_key": device_secret_key,
					"device": device
				}
				db.db_write("device:" + device_id, tools.toJSONString(device_data))
			}

			db.db_read("device_ids", function(err, result) {
				if (err)
				{
					res.send("Error connecting to DB")
				}
				else if (result == null)
				{
					db.db_write("device_ids", JSON.stringify(device_ids))
					res.send(JSON.stringify(device_ids))
				}
				else
				{
					devices = tools.toJSON(result)
					for (var i = 0; i < device_ids.length; i++)
					{
						if ( !(device_ids[i] in devices) )
						{
							devices.concat(device_ids[i])
						}
					}
			
					db.db_write("device_ids", tools.toJSONString(devices)) 
					res.send(JSON.stringify(device_ids))
				}
			})
		}
	})
})

app.post(basePath + "create_account", function(req, res) {
	const pass = (parseInt(req.body.pass.toString())).toString()
	const first_name = req.body.first_name
	const last_name = req.body.last_name

	db.db_read("password:" + pass, (err, result) => {
		if (pass.length != config.PASS_LENGTH || result != null)
		{
			res.send("Invalid password")
		}
		else
		{
			user_id = { "user_id": tools.gen_random_string(config.USER_ID_LENGTH) }
			userData = {
				creationTime: (new Date()).getTime(),

				ips: [req.connection.remoteAddress],
				lastLogin: -1,
				remote_servers: [],
				tokens: [],
				devices: [],
				remote_server_access_list: [],
				first_name: first_name,
				last_name: last_name
			}
			
			//console.log("Adding user", pass, user_id)
			db.db_write("password:" + pass, tools.toJSONString(user_id))  // password maps to user data for quick lookups
			db.db_write("user:" + user_id, tools.toJSONString(userData))
			db.db_read("user_ids", function(err, result) {
				if (err)
				{
					res.send("Error connecting to DB")
					return
				}
				else if (result == null)
				{
					db.db_write("user_ids", tools.toJSONString([user_id.user_id]))
					res.send("Success!")
				}
				else
				{
					user_ids = tools.toJSON(result)
					user_ids.push(user_id)
					db.db_write("user_ids", tools.toJSONString(user_ids))

					res.send("Success!")
				}
			})

		}
	})
})

function pollAllDevices(req, res)
{
	db.db_read("token:" + req.cookies.token, function(err, result) {
		if (err)
		{
			console.log("Error reading from server: ", err)
			res.send("Error communicating with database. Contact Jake")
		}
		else if (result == null)
		{
			res.send("Invalid cookie")
		}
		else
		{
			var devices = []
			if (req.cookies.token == master_token.token && (new Date()) < master_token.expiration)
			{
				console.log("MAASTER")
				db.db_read("device_ids", function(err, result) {
					if (err)
					{
						console.log("Got err reading device ids")
						res.send("Error communication with DB")
					}
					else if (result != null)
					{
						const all_device_ids = tools.toJSON(result)
						db.db_read_all(all_device_ids, "device", function(all_devices) {
							res.send(tools.toJSONString(all_devices))
						})
					}
				})
			}
			else
			{
				user_id = result

				db.db_read("user:" + user_id, function(err, result) {
					if (err || result == null)
					{
						res.send("Invalid user. Contact Jake")
					}
					else
					{
						var user = tools.toJSON(result, ["devices"])
						devices = user.devices
						if (!devices) devices = []

						console.log("Found all user devices poll:", JSON.stringify(devices))

						db.db_read_all(devices, "device", function(all_devices) {
							res.send(tools.toJSONString(all_devices))
						})
					}
				})
			}
		}
	})
}

// TODO: Verify token owns device
// TODO: Check token exp
function pollSingleDevice(req, res)
{
	db.db_read("token:" + req.cookies.token, function(err, result) {
		if (err)
		{
			console.log("Error getting token on poll request:", err)
			res.send("Error communicating with database. contact Jake")
		}
		else if (result == null)
		{
			res.send("Invalid cookie")
		}
		else
		{
			var token = tools.toJSON(result, ["user_id"])
			var device_id = req.body.device_id
			var device_data = req.body.data
			//console.log("Reading device", device_id)
			db.db_read("device:" + device_id, function(err, result) {
				if (err)
				{
					res.send("Error connecting to DB")
				}
				else if (result == null)
				{
					res.send("{}")
				}
				else
				{
					var device = tools.toJSON(result, ["owner_id"])
					if (device.owner_id == token.user_id)
					{
						res.send(tools.toJSONString(device))
					}
					else
					{
						res.send("Error: User does not own this device!")
					}
				}
			})
		}
	});
}

var httpsServer = https.createServer(config.HTTP_OPTIONS, app);

httpsServer.listen(config.BACKEND_PORT, () => {
	console.log("Listening on https://localhost:6011")
});

const WebSocket = require("ws"); 
const remoteSocket = new WebSocket.Server({port: config.REMOTE_SOCKET_PORT}); 
const deviceSocket = new WebSocket.Server({port: config.DEVICE_SOCKET_PORT}); 

var socketMap = { "remoteSockets": {}, "deviceSockets": {} }

// handle socket communications
remoteSocket.on('connection', (session)=> {
	var user_id = ""
	session.on('close', () => {
		try
		{
			socketMap.remoteSockets[user_id] = {}
		}catch(e){}
	})
	session.on('message', (message)=> { 
		// This functionality has been moved to a websocket
		var updateData = {}
		try
		{
			updateData = tools.toJSON(message, ["user_id", "device_id", "device", "token"]);
		}
		catch(e) { session.send("Invalid message") }

		// TODO: Verify token is not expired
		db.db_read("token:" + updateData.token, function(err, result) {
			if (err)
			{
				console.log("Error getting token on poll request: ", err)
				session.send("Error communicating with database. contact Jake")
			}
			else if (result == null)
			{
				session.send("Invalid cookie")
			}
			else
			{
				var token = tools.toJSON(result, ["user_id"]) // TODO: Function to check token and return expiration as well
				var device_id = updateData.device_id
				var device_data = updateData.device.data

				db.db_read("device:" + device_id, function(err, result) {
					var device = tools.toJSON(result, ["owner_id"])

					if (err)
					{
						session.send("Error connecting to DB")
					}
					else if (result == null)
					{
						session.send("Unable to find device")
					}
					else if (device == {})
					{
						session.send("Enable to parse device data")
					}
					else
					{
						if (device_data == undefined || device_data == {})
						{
							session.send("No data sent")
						}
						else
						{
							if (token.user_id != device.owner_id)
							{
								console.log("User / device owner mismatch: ", token.user_id, updateData.owner_id)
								session.send("Error: User does not own this device")
							}
							else
							{
								user_id = token.user_id
								socketMap.remoteSockets[user_id] = { "socket": session }

								device.device.data = Object.assign(device.device.data, device_data)
								db.db_write("device:" + device_id, tools.toJSONString(device))

								try
								{
									// Send updated data to the end device
									socketMap.deviceSockets[user_id][device_id].socket.send(device_data)

									// Send response to the remote browser
									session.send('Success!')
								}
								catch(e)
								{
									// If the device socket doesn't exist, create it and throw the update into the update queue
									if ( !(user_id in socketMap.deviceSockets) )
									{
										socketMap.deviceSockets[user_id] = {}
									}
									if ( !(device_id in socketMap.deviceSockets[user_id]) )
									{
										socketMap.deviceSockets[user_id][device_id] = {}
									}
									if ( !(updateQueue in socketMap.deviceSockets[user_id][device_id]) )
									{
										socketMap.deviceSockets[user_id][device_id].updateQueue = []
									}
									sacketMap.deviceSockets[user_id][device_id].updateQueue.push(device_data)
								}
							}
						}
					}
				})
			}
		});
	});
});

// TODO: Update queue for closed connections
deviceSocket.on('connection', (session)=> { 
	var owner_id = ""
	var device_id = ""

	session.on('close', () => {
		try
		{
			socketMap.deviceSockets[owner_id][device_id] = {}
		}catch(e){}
	})
	session.on('message', (message)=> {
		// This functionality has been moved to a websocket
		var updateData = {}
		try
		{
			updateData = tools.toJSON(message, ["owner_id", "device_id", "device", "secret_key"]);
		}
		catch(e) { session.send("Invalid message") }

		// TODO: Verify token is not expired
		db.db_read("secret_key:" + updateData.secret_key, function(err, result) {
			if (err)
			{
				console.log("Error getting token on poll request: ", err)
				session.send("Error communicating with database. contact Jake")
			}
			else if (result == null)
			{
				session.send("Error: Device authentication failed")
			}
			else
			{
				//var secretKey = tools.toJSON(result, ["device_id"])
				var device_id = result

				if (device_id != updateData.device_id)
				{
					session.send("Error: Device authentication failed")
					//session.close()
					return
				}

				owner_id = updateData.owner_id
				var device_data = updateData.device.data

				db.db_read("device:" + device_id, function(err, result) {
					var device = tools.toJSON(result, ["owner_id"])

					if (err)
					{
						session.send("Error connecting to DB")
					}
					else if (result == null)
					{
						session.send("Unable to find device")
					}
					else if (device == {})
					{
						session.send("Enable to parse device data")
					}
					else
					{
						if (device_data == undefined || device_data == {})
						{
							session.send("No data sent")
						}
						else
						{
							if (owner_id != device.owner_id)
							{
								console.log("User / device owner mismatch: ", token.user_id, updateData.owner_id)
								session.send("Error: User does not own this device")
								//session.close() //todo?
							}
							else
							{
								if ( !(owner_id in socketMap.deviceSockets) )
								{
									socketMap.deviceSockets[owner_id] = {}
								}
								if ( !(device_id in socketMap.deviceSockets[owner_id]) )
								{
									socketMap.deviceSockets[owner_id][device_id] = {}
								}
								socketMap.deviceSockets[owner_id][device_id].socket = session

								device.device.data = Object.assign(device.device.data, device_data)
								db.db_write("device:" + device_id, tools.toJSONString(device))

								try
								{
									// Send updated data to the client browser remote or trash it
									socketMap.remoteSockets[owner_id].socket.send(device_data)

									// Send response to the remote browser
									session.send('Success!')
								}
								catch(e)
								{
								}

								var updateQueue = socketMap.deviceSockets[owner_id][device_id].updateQueue
								var combinedUpdate = {}
								for (var i = 0; i < updateQueue.length; i++)
								{
									// Object.assign essentially merges objects
									// Where newer merges update older values.
									// The updateQueue is just a device_data object
									combinedUpdate = Object.assign(combinedUpdate, updateQueue[i])
								}
								session.send(combinedUpdate)
							}
						}
					}
				})
			}
		});
	});
});
