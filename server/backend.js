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
			master_token = tools.toJSON(result, ["token", "user-id", "expiration"])
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
					var master_token = tools.toJSON(result, ["token", "user_id", "expiration"])
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

// TODO: Fingerprinting
// TODO: Multiple tokens per user
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
			console.log(password);

			const midnight = tools.midnight()
			const token = { "token": tools.gen_random_string(config.TOKEN_LENGTH), "user_id": user_id, "expiration": midnight }

			db.db_write("token:" + token.token, tools.toJSONString(token))

			db.db_read("user:" + user_id, function(err, result) {
				if (err || result === null)
				{
					console.log("No user found here... what?")
					res.send("{}")
				}
				else // Clear all older tokens
				{
					const user_data = tools.toJSON(result, ["tokens"])

					if (user_data.tokens.indexOf(token.token) === -1)
					{
						user_data.tokens.push(token.token)
					}
					
					db.db_write("user:" + user_id, tools.toJSONString(user_data))

					//console.log("Pass is", pass, config.MASTER_PASSWORD, token)
					if (pass == config.MASTER_PASSWORD)
					{
						db.db_write("master_token", tools.toJSONString(token))
						master_token = token
					}

					db.db_del_at_midnight("token", token, (a,b) => {})
					db.db_del_value_at_midnight("user", user_id, "tokens",(a,b) => {}, token)
				
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
// TODO: Track IP
app.post(basePath + "register_device", function (req, res) {
	const user_data = req.body.registry
	const user_token = req.body.token
	console.log("Got data:", user_data, user_token)
	
	db.db_read("token:" + user_token, (err, result) => {
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
			var token = tools.toJSON(result, ["user_id"])
			var allDeviceData = {}

			//var project_name = user_data.project_name
			//var project_location = user_data.project_location
			//var ssh_port = user_data.ssh_port
			
			for (var i = 0; i < user_data.length; i++)
			{
				var device = user_data[i]
				const device_id = tools.gen_random_string(config.DEVICE_ID_LENGTH)
				const device_secret_key = tools.gen_random_string(config.DEVICE_SECRET_KEY_LENGTH)
				if ( !("device_id" in device) )
					device.device_id = device_id

				device_ids.push(device.device_id)
				device.device_secret_key = device_secret_key
				device.owner_id = token.user_id
				//"project_name": project_name,
				//"project_location": project_location,
				//"ssh_port": ssh_port,
				
				allDeviceData[device.device_id] = device
				
				db.db_write("device:" + device.device_id, tools.toJSONString(device))
				db.db_write("device_secret_key:" + device.device_secret_key, device.device_id)
				// TODO: Add device id to devices list in user
			}

			// Update the list of known devices with the newly registered ids
			db.db_read("device_ids", function(err, result) {
				if (err)
				{
					res.send("Error connecting to DB")
				}
				else if (result == null)
				{
					db.db_write("device_ids", tools.toJSONString(device_ids))
					res.send(tools.toJSONString(allDeviceData))
				}
				else
				{
					devices = tools.toJSON(result)
					for (var i = 0; i < device_ids.length; i++)
					{
						if ( devices.indexOf(device_ids[i]) === -1 )
						{
							devices = devices.concat(device_ids[i])
						}
					}
			
					db.db_write("device_ids", tools.toJSONString(devices)) 
					res.send(tools.toJSONString(allDeviceData))
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
			db.db_write("user:" + user_id.user_id, tools.toJSONString(userData))
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
			// TODO: unufck master token with multiple tokens
			if (req.cookies.token == master_token.token && (new Date()) < master_token.expiration)
			{
				//console.log("MAASTER")
				db.db_read("device_ids", function(err, result) {
					if (err)
					{
						console.log("Got err reading device ids")
						res.send("Error communication with DB")
					}
					else if (result != null)
					{
						const all_device_ids = tools.toJSON(result)
						console.log("sending devices:", all_device_ids);
						db.db_read_all(all_device_ids, "device", function(all_devices) {
							res.send(tools.toJSONString(all_devices))
						})
					}
				})
			}
			else
			{
				var token = tools.toJSON(result, ["user_id", "expiration"])
				user_id = token.user_id
				//console.log("USer is:", result);

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

						//console.log("Found all user devices poll:", tools.toJSONString(devices))

						db.db_read_all(devices, "device", function(all_devices) {
							all_devices.map(device => delete(device.device_secret_key))
							res.send(tools.toJSONString(all_devices))
						})
					}
				})
			}
		}
	})
}

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
						delete(device.device_secret_key)
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

// TODO: Multiple sockets to different ips
// handle socket communications
remoteSocket.on('connection', (session)=> {
	var user_id = ""
	var pingInterval = -1
	var sessionID = tools.gen_random_string(16); // Give each browser websocket a unique session so multiple sockets can exist to the same user

	pingInterval = setInterval(function() { session.send("") }, Math.max(10*1000, config.WEBSOCKET_TIMEOUT - (10*1000)))

	console.log("Opening socket")
	session.on('close', () => {
		try
		{
			socketMap.remoteSockets[user_id][sessionID] = {}
			clearInterval(pingInterval)
		}catch(e){}
	})
	session.on('message', (message)=> { 
		// This functionality has been moved to a websocket
		console.log("Remote socket message received:", message)
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
				delete(updateData.token)   // We don't need to send the token to the device
				var device_id = updateData.device_id
				var device_data = updateData.data

				var user_id = token.user_id
				if ( !(user_id in socketMap.remoteSockets) )
				{
					socketMap.remoteSockets[user_id] = {}
				}
				socketMap.remoteSockets[user_id][sessionID] = { "socket": session }

				// Remote won't send a device when establishing the websocket
				if (device_id == "")
				{
					return;
				}

				db.db_read("device:" + device_id, function(err, result) {
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
						var device = tools.toJSON(result, ["owner_id"])

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
								device.data = Object.assign(device.data, device_data)
								db.db_write("device:" + device_id, tools.toJSONString(device))
								//console.log("Updated device:", device)

								try
								{
									// Send updated data to the end device
									socketMap.deviceSockets[user_id][device_id].socket.send(tools.toJSONString(device))
									//console.log("Sent to socket")

									// Send response to the remote browser
									session.send('Success!')
								}
								catch(e)
								{
									//console.log("Failed remote->device send!, error was:", e)
									// If the device socket doesn't exist, create it and throw the update into the update queue
									if ( !(user_id in socketMap.deviceSockets) )
									{
										socketMap.deviceSockets[user_id] = {}
									}
									if ( !(device_id in socketMap.deviceSockets[user_id]) )
									{
										socketMap.deviceSockets[user_id][device_id] = {}
									}
									if ( !("updateQueue" in socketMap.deviceSockets[user_id][device_id]) )
									{
										socketMap.deviceSockets[user_id][device_id].updateQueue = []
									}
									socketMap.deviceSockets[user_id][device_id].updateQueue.push(device)

									console.log(socketMap.deviceSockets[user_id][device_id].updateQueue)
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
	var STATE_CONNECTING = true
	var pingInterval = -1

	pingInterval = setInterval(function() { session.send("") }, Math.max(10*1000, config.WEBSOCKET_TIMEOUT - (10*1000)))

	session.on('close', () => {
		try
		{
			socketMap.deviceSockets[owner_id][device_id] = {}
			clearInterval(pingInterval)
		}catch(e){}
	})
	session.on('message', (message)=> {
		console.log("GOt message!", message)
		var updateData = {}
		try
		{
			updateData = tools.toJSON(message, [ "owner_id", "device_id", "data", "device_secret_key"]);
		}
		catch(e) { session.send("Invalid message") }

		// TODO: Verify token is not expired
		//console.log("Got key:", updateData, message);
		db.db_read("device_secret_key:" + updateData.device_secret_key, function(err, result) {
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

				/*// Despite allowing full configs on valid secret key, send an error anyway if needed
				if (device_id != updateData.device_id)
				{
					session.send("Error: Device authentication failed")
					//session.close()
					return
				}*/

				// Do initialization things for the first communication
				//console.log("Device data:", updateData)
				owner_id = updateData.owner_id
				var device_data = updateData.data

				db.db_read("device:" + device_id, function(err, result) {
					var device = tools.toJSON(result, ["owner_id", "data"])

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
						if (device_data == {} || device_data === "")
						{
							if (STATE_CONNECTING)
							{
								STATE_CONNECTING = false
								// TODO: Persistent memory on device
								// TODO: Update secret key
								//device.device_secret_key = tools.gen_random_string(config.DEVICE_SECRET_KEY_LENGTH)
								session.send(tools.toJSONString(device))
								return;
							}
							console.log("Bad device data")
						}
						else
						{
							// If they only pass in a secret_key, assume they are asking for their device config
							/*if (updateData.token + updateData.owner_id + updateData.device_id + updateData.device == "")
							{
								console.log("Sending you config:", tools.toJSON(device))
								session.send(tools.toJSON(device))
								return
							}*/
							if (owner_id != device.owner_id)
							{
								console.log("User / device owner mismatch: ", owner_id, updateData.owner_id)
								session.send("Error: User does not own this device")
								//session.close() //todo?
							}
							else
							{
								// On new connections refresh the device's secret key
								if ( !(owner_id in socketMap.deviceSockets) )
								{
									socketMap.deviceSockets[owner_id] = {}
								}
								if ( !(device_id in socketMap.deviceSockets[owner_id]) )
								{
									socketMap.deviceSockets[owner_id][device_id] = {}
								}
								socketMap.deviceSockets[owner_id][device_id].socket = session
								socketMap.deviceSockets[owner_id][device_id].updateQueue = []

								device.data = Object.assign(device.data, device_data)
								db.db_write("device:" + device_id, tools.toJSONString(device))

								try
								{
									// Send updated data to the client browser remote or trash it
									//  TODO
									//delete(device.device_secret_key)
									for (sessionID in socketMap.remoteSockets[owner_id])
									{
										socketMap.remoteSockets[owner_id][sessionID].socket.send(tools.toJSONString(device))
									}

									// Send response to the device, may not be needed
									session.send('Success!')
								}
								catch(e)
								{
									console.log("Failed device->remote send!, error was:", e);
								}

								// Check if the remote has queued any commands
								// (This implies the device socket was previously down)
								var updateQueue = socketMap.deviceSockets[owner_id][device_id].updateQueue
								var combinedUpdate = {}
								for (var i = 0; i < updateQueue.length; i++)
								{
									console.log("Queueing:", updateQueue)
									// Object.assign essentially merges objects
									// Where newer merges update older values.
									// The updateQueue is just a device object
									combinedUpdate = Object.assign(combinedUpdate, updateQueue[i])
								}
								//console.log("Update data:", updateQueue, updateQueue.length, combinedUpdate, combinedUpdate == {})
								if (updateQueue.length > 0)  // If we have updates
								{
									combinedUpdate.device_secret_key = device.device_secret_key
									session.send(tools.toJSONString(combinedUpdate))
								}
							}
						}
					}
				})
			}
		});
	});
});
