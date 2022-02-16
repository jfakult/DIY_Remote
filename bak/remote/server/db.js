const cron = require("node-cron")
const redis = require("redis")
const db = redis.createClient(6012)
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
		callback(results)
	}
	else
	{
		module.exports.db_read(data_type + ":" + values[lookups_completed], function(err, result) {
			//console.log("huetn")
			data = {}
			if (err || result === null)
			{
				//console.log("Read all error", err, result)
				// Ignore
			}
			else
			{
				data = JSON.parse(result)
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
db_del_at_midnight: function(data_type, value, callback)
{
	var d = new Date()
	d.setHours(24, 0, 1, 0); // Run 1 second after midnight to ensure the new day has started
	var time_to_midnight = d - Date.now
	module.exports.db_del_at(data_type, value, time_to_midnight)
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
