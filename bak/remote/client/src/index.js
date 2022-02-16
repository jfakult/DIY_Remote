import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import {Button, PasswordPanel, SplashScreen} from './App';
import Cookies from 'js-cookie';
//import reportWebVitals from './reportWebVitals';

ReactDOM.render(<h2>Home Remote Control</h2>, document.getElementById("title"))

if (!Cookies.get("token"))
{
	ReactDOM.render(<PasswordPanel maxPassLength="5" />, document.getElementById("passwordPanel"))
}
else
{
	pollDevicesAndPopulate()
}

var expandedButtonIndex = -1;
var buttonData = {}
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
	//console.log("Poll response:", text)
		
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
	if (expandedButton !== undefined)
		expandedButtonIndex = expandedButton

	if (dev !== undefined && dev.device_id !== undefined)
	{
		pollDevicesAndPopulate(dev)
		return
	}

	var buttons = []
	var i = 0
	for (var key in buttonData)
	{
		var device = buttonData[key]
		buttons.push(<Button index={i+1} expanded={expandedButtonIndex === i ? true : false} data={device} clickFunc={renderButtons} />)
		i++
	}

	ReactDOM.render(buttons, document.getElementById("buttonPanel"))
}


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();
