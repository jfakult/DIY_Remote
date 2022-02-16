import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import {Button, PasswordPanel, SplashScreen} from './App';
import Cookies from 'js-cookie';
//import reportWebVitals from './reportWebVitals';

const wss = new WebSocket("wss://home.fakult.net/remote/update")
var buttonData = {}

wss.onopen = function(forceInit = false)
{
	if (forceInit || Cookies.get("token"))
	{
		console.log("Websocket opening")

		console.log("COokie is:", (Cookies.get("token")))
		wss.send( JSON.stringify({"token": Cookies.get("token")}) )
	}
}

wss.onmessage = function(event) {
	var msg = event.data
	var response = ""
	try
	{
		response = JSON.parse(msg)
		console.log("Socket message received:", JSON.stringify(response))

		if (response.device_id && response.device_id in buttonData)
		{
			buttonData[response.device_id] = response
			renderButtons();
		}
	}
	catch(e)
	{
		console.log("Socket error received:", msg)
		return
	}
};

ReactDOM.render(<h2>Home Remote Control</h2>, document.getElementById("title"))

if (!Cookies.get("token"))
{
	ReactDOM.render(<PasswordPanel maxPassLength="5" />, document.getElementById("passwordPanel"))
}
else
{
	pollDevicesAndPopulate()

	if (wss.readyState === wss.OPEN)
	{
		wss.onopen(true)
	}
}

var expandedButtonIndex = -1;
async function pollDevicesAndPopulate(device)
{
	//console.log("Polling devices from index")
	var postOptions = {}
	if (device !== undefined)
	{
		postOptions = {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(device)
		}
	}
	else
	{
		ReactDOM.render(<SplashScreen visible={true} />, document.getElementById("splash"))
	}
	
	const response = await fetch("/remote/backend/poll", postOptions)
	const text = await response.text()
	console.log("Poll response:", text)
		
	ReactDOM.render(<SplashScreen visible={false} />, document.getElementById("splash"))

	if (text === "Invalid cookie")
	{
		Cookies.remove("token")
		window.location.reload(false)
		return
	}
	else if (text === "Invalid user. Contact Jake")
	{
		// TODO toast
		return
	}
	else if (text === "No devices found")
	{
		// TODO toast
		return
	}

	if (response.status !== 200)
	{
		console.log("Failed to reach backend server")
		return
		//throw Error(text.message)
	}

	if (device !== undefined && device.device_id !== undefined)
	{
		var deviceData = JSON.parse(text)
		buttonData[deviceData.device_id] = deviceData
	}
	else
	{
		var data = JSON.parse(text)
		for (var i = 0; i < data.length; i++)
		{
			device = data[i]
			buttonData[device.device_id] = device
		}
	}

	//console.log("Currnt button data", buttonData)
	
	renderButtons()
}

function renderButtons(expandedButton, dev)
{
	console.log("Rendering")
	if (expandedButton !== undefined)
		expandedButtonIndex = expandedButton

	if (dev !== undefined && dev.device_id !== undefined)
	{
		//pollDevicesAndPopulate(dev)
		return
	}

	var buttons = []
	var i = 0
	for (var device_id in buttonData)
	{
		var device = buttonData[device_id]
		console.log("Expanding:", i, expandedButton === i)
		buttons.push(<Button index={i+1} expanded={expandedButtonIndex === i ? true : false} device={device} clickFunc={renderButtons} websocket={wss} />)
		i++
	}

	ReactDOM.render(buttons, document.getElementById("buttonPanel"))
}


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();
