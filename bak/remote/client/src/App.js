import React from "react"
import './App.css';

import Cookies from 'js-cookie';
//import lightbulb from './img/lightbulb.png';
import loading from "./img/loading.gif"
//import loading_small from "./img/loading_small.gif"
var images = require.context("./img", true)

const POLL_INTERVAL = 4000;
const MIN_TIME_BETWEEN_UPDATES = 100; // rtt is probably something like 50ms, unit in ms

const wss = new WebSocket("wss://home.fakult.net/remote/update")

wss.onopen = function() {console.log("Websocket opening")};

wss.onmessage = function(event) {
	var msg = event.data
	var response = ""
	try
	{
		response = JSON.parse(msg)
		console.log("Socket message received:", JSON.stringify(response))
	}
	catch(e)
	{
		console.log("Socket error received:", msg)
	}
};

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

var lastTimeDeviceUpdated = 0
async function executeButtonTask(deviceData, pollUpdateCallback)
{
	if ((new Date()).getTime() < (lastTimeDeviceUpdated + MIN_TIME_BETWEEN_UPDATES))
		return
	
	var message = deviceData
	message.token = Cookies.get("token")
	console.log("Sending message:", message)
	wss.send(JSON.stringify(message))
	
	lastTimeDeviceUpdated = (new Date()).getTime()
	pollUpdateCallback()
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

var buttonPollHandle = -1
export class Button extends React.Component {

	constructor(props)
	{
		super(props)
		this.state = { expanded: props.expanded, index: props.index, data: props.data, clickFunc: props.clickFunc }
	}

	componentWillReceiveProps(newProps)
	{
		this.setState( {expanded: newProps.expanded, data: newProps.data})
		if (newProps.expanded)
		{
		}
	}

	handleClick = (e) => {
		if (this.state.expanded && !this.state.data.passive)
		{
			var currentData = this.state.data
			currentData.active = !currentData.active
			this.setState({ data: currentData })
			executeButtonTask(this.state.data, this.pollForUpdate)
		}
		this.state.clickFunc(this.state.index - 1)
		expand(e, this.state.data)
	}

	pollForUpdate = () => {
		//console.log(this.state)
		this.state.clickFunc(this.state.index - 1, this.state.data.device)
	}
	
	shrink = (event) =>
	{
		clearInterval(buttonPollHandle)
		buttonPollHandle = -1
		//this.state.clickFunc(-1)
	}

	updateRGBColor = (e) => {
		var input = e.currentTarget
		var rgb = hexToRgb(input.value)
		var currentData = this.state.data
		currentData.device.data.red = rgb.r
		currentData.device.data.green = rgb.g
		currentData.device.data.blue = rgb.b
		this.setState({ data: currentData })

		executeButtonTask(this.state.data, this.pollForUpdate)
		//this.pollForUpdate()
	}

	render() {
		let buttonInfo;
		var image_name = "generic";
		let image_format = "png";

		//console.log("Botton state", this.state)
		//console.log(this.state.data.device.device_type === "rgblights")
		if (this.state.expanded)
		{
			if (this.state.data.passive && buttonPollHandle === -1)
				buttonPollHandle = setInterval(this.pollForUpdate, POLL_INTERVAL)

			var optionalFields = []

			if (this.state.data.passive)
			{
				// Do passive things here
			}
			else
			{
				//optionalFields.push(<div className={"button-state state-"+this.state.data.state}>{this.state.data.state}</div>)
			}

			if (this.state.data.device.device_type === "lights")
			{
				image_name = "lightbulb"
			}
			if (this.state.data.device.device_type === "rgblights")
			{
				image_name = "LED"
				optionalFields.push(<div className={"button-data"}>
					<input type="color" value={rgbToHex(this.state.data.device.data.red, this.state.data.device.data.green, this.state.data.device.data.blue)} onChange={this.updateRGBColor}></input>
				</div> )
			}
			if (this.state.data.device.device_type === "locks")
			{
				image_name = "bolt_lock"
			}
			if (this.state.data.device.device_type === "temperature")
			{
				image_name = "humidity_sensor"
				optionalFields.push(<div className={"button-data"}>
					<div>Temp: {this.state.data.device.data.temperature}&deg; F</div>
					<div>Mode: {this.state.data.device.data.mode}</div>
					<div>Fan: {this.state.data.device.data.fan}</div>
				</div> )
			}
			if (this.state.data.device.device_type === "humidity")
			{
				image_name = "humidity_sensor"
				optionalFields.push(<div className={"button-data"}>
					<div>Humidity: {this.state.data.device.data.humidity}%</div>
				</div> )
			}
			if (this.state.data.device.device_type === "moisture")
			{
				image_name = "air_conditioner"
			}
			if (this.state.data.device.device_type === "motors")
			{
				image_name = ""
			}

			buttonInfo = <div className="info-wrapper">
				<div className="button-description">{this.state.data.description}</div>
				<span>at</span>
				<div className="button-location">{this.state.data.location}</div>
				{optionalFields}
			</div>
		}

		if (this.state.data.device.image_name) { image_name = this.state.data.device.image_name }
		if (this.state.data.device.image_format) { image_format = this.state.data.device.image_format }

		var image = {default: ""};
		try
		{
			image = images("./" + image_name + "." + image_format)
		} catch(e){ console.log("Error: unable to find icon image", image_name, image_format) }
		
		return (
			<div className={"button" + (this.state.expanded ? " expanded" : "") + (this.state.data.active | this.state.data.passive ? "" : " inactive" ) } tabIndex={this.state.index} onClick={this.handleClick} onBlur={this.shrink}>
				<div className="button-image-wrapper">
					<img src={image.default} alt={this.state.data.description} className="button-image" />
				</div>
				<div className="button-text">{this.state.data.device.name}</div>
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
