module.exports = {

toJSON: function(jsonStr, expectedKeys = [])
{
	var json = {}

	try
	{
		json = JSON.parse(jsonStr)
	}
	catch(e){}

	expectedKeys.map(key => (key in json) ? true : json[key] = "")
	return json
}
,
midnight: function()
{
	var midnight = new Date()
	midnight.setHours(23, 59, 59, 999)
	return + midnight // Timestamp

}
,
gen_random_string: function(length)
{
	var asciiBlacklist = [ 58, 34 ] // Don't use colons because of redis-commander, list: : "
	const asciiStart = 33
	const asciiEnd = 126
	const asciiRange = asciiEnd - asciiStart + 1
	var str = ""
	for (var i = 0; i < length; i++)
	{
		var randomAsciiVal = parseInt(Math.random() * asciiRange) + asciiStart
		while (asciiBlacklist.indexOf(randomAsciiVal) >= 0)
		{
			randomAsciiVal = parseInt(Math.random() * asciiRange) + asciiStart
		}
		str += String.fromCharCode(randomAsciiVal)
	}

	return str
}
,
toJSONString(json)
{
	var str = '{"status": "JSON decoding error"}'
	return JSON.stringify(json, null, 4)
}



} // Closing bracket for module.exports
