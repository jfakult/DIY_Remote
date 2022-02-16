const cron = require("node-cron")
const redis = require("redis")
const db = redis.createClient(6012)
const tools = require("./tools")

db.connect()

db.on("ready", (err) => {
	if (err)
		console.log("Error connecting to redis DB")
	else
	{
		// extra DB configs can go here
	}
})

module.exports = {
db_write: function(key, val)
{
	//console.log(key, val)
	db.set(key, val, (err, reply) => {
		if (err)
			console.log("DB write error", err)
		
		return !!err
	})
}
,
db_read: function(key, callback)
{
	//console.log("DB call", key)
	db.get(key, (err, reply) => {
		//console.log("DB response", err, reply)
		if (err)
		{
			console.log("DB get error", err)
		}
		else if (reply == undefined)
		{
			reply = null
		}

		callback(!!err, reply)
	})
}
,
db_del: function(key, callback)
{
	db.del(key, (err, response) => {
		if (err)
			console.log("DB delete error", err)

		callback(err, response)
	})
}
,
db_read_all: function(values, data_type, callback, lookups_completed = 0, results = [])
{
	if (values.length <= lookups_completed)
	{
		console.log("Got results:", results)
		callback(results)
	}
	else
	{
		module.exports.db_read(data_type + ":" + values[lookups_completed], function(err, result) {
			data = {}
			if (err || result === null)
			{
				console.log("Read all error", err, result, data_type, values[lookups_completed])
				// Ignore
			}
			else
			{
				data = tools.toJSON(result)
				results.push(data)
			}
			
			module.exports.db_read_all(values, data_type, callback, lookups_completed + 1, results)
		})
	}
}
,
db_del_at: function(data_type, value, delay_ms, callback)
{
	setTimeout(function() {
		module.exports.db_del(data_type + ":" + value, (err, response) => {
			callback(err, response)
		})
	}, delay_ms)
}
,
db_del_value_at: function(data_type, value, key, delay_ms, callback, specific_value = "")
{
	setTimeout(function() {
		module.exports.db_read(data_type, value, function(err, result) {
			if (err || result === null)
			{
				callback(null, "Error getting user")
			}
			else // Clear all older tokens
			{
				const user_data = tools.toJSON(result, [key])
				if (specific_value)
				{
					var pos = result[key].indexOf(specific_value)
					var obj = result[key][specific_value]
					if (pos >= 0)
					{
						result[key].splice(pos, 1)
					}
					else if (obj)
					{
						delete(result[key][specific_value])
					}
				}
			}
		})
	}, delay_ms)
}
,
db_del_at_midnight: function(data_type, value, callback)
{
	var d = new Date()
	d.setHours(24, 0, 1, 0); // Run 1 second after midnight to ensure the new day has started
	var time_to_midnight = d - Date.now()
	module.exports.db_del_at(data_type, value, time_to_midnight, callback)
}
,
db_del_value_at_midnight: function(data_type, value, key, callback, specific_value = "")
{
	var d = new Date()
	d.setHours(24, 0, 1, 0); // Run 1 second after midnight to ensure the new day has started
	var time_to_midnight = d - Date.now()
	module.exports.db_del_value_at(data_type, value, key, time_to_midnight, callback, specific_value = specific_value)
}
,
run_token_cleaner: function(freq)
{
	cron.schedule(freq, function() {
	});
}
,
run_secret_key_cleaner: function(freq, sessionMap)
{
	cron.schedule(freq, function() {
	});
}

} // export closing bracket
