import React from "react"
import './App.css';

import Cookies from 'js-cookie';
//import lightbulb from './img/lightbulb.png';
import loading from "./img/loading.gif"
//import loading_small from "./img/loading_small.gif"
var images = require.context("./img", true)

//const POLL_INTERVAL = 4000;
//const MIN_TIME_BETWEEN_UPDATES = 100; // rtt is probably something like 50ms, unit in ms

function expand(event, deviceData)
{
	var button = event.currentTarget
	var expanded=button.classList.contains("expanded")
	if (expanded)
	{
		console.log("Clicked expanded button")
	}
	else
	{
		//button.classList.add("expanded")
		button.focus()
		setTimeout(function() {
			button.scrollIntoView({ block: "start", behavior: "smooth" })
		}, 600) // Matched with transition time value in css.button.expanded 
	}
}

//var lastTimeDeviceUpdated = 0
async function executeButtonTask(deviceData, pollUpdateCallback)
{
	//if ((new Date()).getTime() < (lastTimeDeviceUpdated + MIN_TIME_BETWEEN_UPDATES))
	//	return
	
	var message = deviceData
	message.token = Cookies.get("token")
	//console.log("Sending message:", message)
	//wss.send(JSON.stringify(message))
	
	//lastTimeDeviceUpdated = (new Date()).getTime()
	//pollUpdateCallback()
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export class Button extends React.Component {

	constructor(props)
	{
		super(props)
		this.state = { expanded: props.expanded, index: props.index, device: props.device, websocket: props.websocket, clickFunc: props.clickFunc, token: Cookies.get("token") }

		//document.getElementById("content").addEventListener("click", this.shrink, false) 
		window.addEventListener("click", this.shrink, false) 
			/*function(event) {
					}, false)*/
	}

	componentWillReceiveProps(newProps)
	{
		this.setState( {expanded: newProps.expanded, device: newProps.device})
		if (newProps.expanded)
		{
		}
	}

	handleClick = (e) => {
		if (this.state.expanded && !this.state.device.passive)
		{
			var currentDevice = this.state.device
			currentDevice.active = !currentDevice.active
			this.setState({ device: currentDevice })
			executeButtonTask(this.state.device, this.pollForUpdate)
		}
		this.state.clickFunc(this.state.index - 1)
		expand(e, this.state.device)
	}

	updateButton = () => {
		//console.log(this.state)
		//this.state.clickFunc(this.state.index - 1, this.state.device.
	}
	
	shrink = (event) =>
	{
		if (this.state.expanded)  // The expanded button will be responsible for shrinking itself
		{
			console.log(event.path)
			for (var i = 0; i < event.path.length; i++)
			{
				var elem = event.path[i];
				if (elem.classList && elem.classList.contains("button"))
				{
					console.log(elem)
					var index = parseInt(elem.getAttribute("tabindex"))
					if (this.state.index !== index)   // If we clicked ourself, don't run the shrink function
					{
						this.state.clickFunc(-1)
					}

					return
				}
			}

			this.state.clickFunc(-1)
		}
	}

	updateRGBColor = (e) => {
		var input = e.currentTarget
		var rgb = hexToRgb(input.value)
		var currentDevice = this.state.device
		currentDevice.red = rgb.r
		currentDevice.data.green = rgb.g
		currentDevice.data.blue = rgb.b
		this.setState({ device: currentDevice })

		executeButtonTask(this.state.device, this.pollForUpdate)
	}

	sendRemoteCommand = (e) => {
		console.log("Sending remote command")
		var elem = e.currentTarget
		var updateData = {}
		try
		{
			updateData = JSON.parse(elem.value)
		}catch(e){}

		var device = this.state.device
		device.data = updateData
		this.setState({ device: device })

		device.token = this.state.token  // Don't need to save the token to the state, but we do need to send it to the server for authentication
		this.state.websocket.send(JSON.stringify(device))
	}

	render() {
		let buttonInfo;
		var image_name = "generic"
		let image_type = "png"

		//console.log("Botton state", this.state)
		//console.log(this.state.device.device_type === "rgblights")
		if (this.state.expanded)
		{
			/*if (this.state.device.passive && buttonPollHandle === -1)
				buttonPollHandle = setInterval(this.pollForUpdate, POLL_INTERVAL)
			*/

			var optionalFields = []

			if (this.state.device.passive)
			{
				// Do passive things here
			}
			else
			{
				//optionalFields.push(<div className={"button-state state-"+this.state.device.state}>{this.state.device.state}</div>)
			}

			if (this.state.device.device_type === "lights")
			{
				image_name = "lightbulb"
				optionalFields.push(
					<div className={"button-data"}>
						<div>{this.state.device.data.state}</div>
					</div>
				)
			}
			if (this.state.device.device_type === "rgblights")
			{
				image_name = "LED"
				optionalFields.push(<div className={"button-data"}>
					<div>{this.state.device.data.state}</div>
					<input type="color" value={rgbToHex(this.state.device.data.red, this.state.device.data.green, this.state.device.data.blue)} onChange={this.updateRGBColor}></input>
				</div> )
			}
			if (this.state.device.device_type === "locks")
			{
				image_name = "bolt_lock"
				optionalFields.push(
					<div className={"button-data"}>
						<div>{this.state.device.data.state}</div>
					</div>
				)
			}
			if (this.state.device.device_type === "temperature")
			{
				image_name = "humidity_sensor"
				var fields = []
				if (this.state.device.data.temperature) fields.push(<div>Temp: {this.state.device.data.temperature}&deg; F</div>)
				if (this.state.device.data.mode) fields.push(<div>Mode: {this.state.device.data.mode}</div>)
				if (this.state.device.data.fan) fields.push(<div>Fan: {this.state.device.data.fan}</div>)

				optionalFields.push(
					<div className={"button-data"}>
						{fields}
					</div>
				)
			}
			if (this.state.device.device_type === "humidity")
			{
				image_name = "humidity_sensor"
				optionalFields.push(
					<div className={"button-data"}>
						<div>Humidity: {this.state.device.data.humidity}%</div>
					</div>
				)
			}
			if (this.state.device.device_type === "moisture")
			{
				image_name = "air_conditioner"
			}
			if (this.state.device.device_type === "motors")
			{
				image_name = ""
				optionalFields.push(
					<div>
						<button value='{ "speed": -1 }' onClick={this.sendRemoteCommand}>Backward</button>
						<button value='{ "speed": 0 }'  onClick={this.sendRemoteCommand}>Stop</button>
						<button value='{ "speed": 1 }'  onClick={this.sendRemoteCommand}>Forward</button>
					</div>
				)
			}

			buttonInfo = <div className="info-wrapper">
				<div className="button-description">{this.state.device.description}</div>
				<span>at</span>
				<div className="button-location">{this.state.device.location}</div>
				{optionalFields}
			</div>
		}

		if (this.state.device.image_name) { image_name = this.state.device.image_name }
		if (this.state.device.image_type) { image_type = this.state.device.image_type }

		var image = {default: ""};
		try
		{
			image = images("./" + image_name + "." + image_type)
		} catch(e){ console.log("Error: unable to find icon image", image_name, image_type) }
		
		return (
			<div className={"button" + (this.state.expanded ? " expanded" : "") + (this.state.device.active | this.state.device.passive ? "" : " inactive" ) } tabIndex={this.state.index} onClick={this.handleClick} onBlur={this.sherink}>
				<div className="button-image-wrapper">
					<img src={image.default} alt={this.state.device.description} className="button-image" />
				</div>
				<div className="button-text">{this.state.device.name}</div>
				{buttonInfo}
			</div>
		);
	}
}


function PasswordButton(props)
{
	function pressButton(e)
	{
		var button = e.currentTarget
		button.classList.add("active-button")
		setTimeout(function() {button.classList.remove("active-button")}, 120)
		props.handlePress(props.number)
	}

	return <div className="password-button" onClick={pressButton}>{props.number}</div>
}

class ErrorMessage extends React.Component {
	render()
	{
		return <div className="error-message">{this.props.errMessage}</div>
	}
}

class PasswordBox extends React.Component {
	deleteNumber = (e) =>
	{
		this.props.updateIndex(e.currentTarget.getAttribute("data-index"))
	}
	generatePasswordBox = (len) =>
	{
		let charBoxes = []
		for (var i = 0; i < len; i++)
		{
			let value = ""
			if (this.props.password[i] !== " ")
			{
				value = "\u2022";
			}
			charBoxes.push(<div data-index={i} onClick={this.deleteNumber}>{value}</div>)
		}

		return charBoxes
	}

	/*constructor(props)
	{
		super(props)
	}*/

	render()
	{
		return <div className="password-box">{this.generatePasswordBox(this.props.maxPassLength)}</div>
	}
}

export class PasswordPanel extends React.Component {
	constructor(props)
	{
		super(props)
		var pass = []
		for (var i = 0; i < props.maxPassLength; i++)
			pass.push(" ")
		this.state = { password: pass, errMessage: "", maxPassLength: parseInt(props.maxPassLength), index: 0 }
	}

	render()
	{
		return <div> <ErrorMessage msg={this.state.errMessage} /><PasswordBox password={this.state.password} maxPassLength={this.state.maxPassLength} updateIndex={this.updateIndex} /><div className="password-panel">{this.createTable()}</div> </div>
	}

	updateIndex = (newIndex) =>
	{
		console.log("before", this.state.index, newIndex)
		this.setState({ index: newIndex })
		console.log("after", this.state.index, newIndex)
		var p = this.state.password
		p[newIndex] = " "
		this.setState({ password: p })

		var pass = this.state.password.join("").replaceAll(" ", "")
		if (pass === "" && newIndex !== 0) this.updateIndex(0)
	}
	handlePress = (number) => 
	{
		var p = this.state.password
		p[this.state.index] = number
		this.setState({ password: p })
		this.setState({ index: (this.state.index + 1) % this.state.maxPassLength })

		p = p.join("").replaceAll(" ", "")
		if (p.length === this.state.maxPassLength)
		{
			this.authenticate("authenticate", p)
		}
	}

	createTable = () =>
	{
		let table = []
		for (var r = 0; r <= 2; r++)
		{
			let cells = []
			for (var c = 1; c <= 3; c++)
			{
				cells.push(<PasswordButton number={r*3 + c} handlePress={this.handlePress} />)
			}
			table.push(<div>{cells}</div>)
		}
		return table
	}

	authenticate = async (path, data) =>
	{
		const response = await fetch("/remote/backend/" + path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ pass: data })
		})
		const body = await response.text()

		if (response.status !== 200)
		{
			console.log("Failed to reach backend server")
			throw Error(body.message)
		}

		console.log("Auth response", body)
		if (body === "Invalid password")
		{
			// Show toast
			// clear table
			return
		}

		const json = JSON.parse(body)

		const midnight = new Date()
		midnight.setHours(23, 59, 59, 999)
		Cookies.set("token", json.token, {expires: midnight} )
		window.location.reload()
	}
}

export class SplashScreen extends React.Component
{
	constructor(props)
	{
		super(props)
		this.state = {visible: props.visible} 
	}

	componentWillReceiveProps(newProps)
	{
		this.setState({ visible: newProps.visible })
	}

	render()
	{
		if (this.state.visible)
		{
			document.body.parentElement.style.overflow = "hidden"
		}
		else
		{
			document.body.parentElement.style.overflow = ""
		}
		return ( <div className={"splash-screen " + (!this.state.visible ? "splash-hide" : "" )}>
			<div className="splash-image"><img src={loading} alt="loading gif" /></div>
		</div> )
	}
}

//export default Button;
//export default PasswordPanel
