# DIY Remote

DIY Remote is a front-end interface that connects with your DIY projects.

The frontend has two main views:
1. Device View
	Scroll through a list of connected devices
	Depending on the classification of the device, you will be able to perform different actions (example: Turn a light on or off, set the RGB value of an LED)
2. Gameplan View
	A gameplan consists of a triggerring event (or a "hook") and a series of actions (or a "runbook")
	A single hook can launch more than 1 runbook, either sequentially, or parallel. Runbooks can also launch other runbooks at any point
	Events can consist of any of the following:
		Certain time of day
		DIY Device reports certain value (i.e your temperature sensor drops below 30)
		This second method is especially powerful, as any DIY device can report any value
			For example: You can have a RasPi report a status of 1 when the Cleveland Cavs win a game, and launch a runbook that sends out a tweet and flashes your lights
			Another example: A RaspPi reports when the sun sets, and launches the "night mode" runbook
		
	

The remote consists of a frontend UI used to give you access to your devices, and a backend used to send commands to them and keep things in line.

## Installation

```
npm install
pacman -Syu redis (or however you install redis)
```

## Usage

```
npm start
```
Then navigate to localhost: 6010

## Future Features
Integrate with Amazon Alexa, Google Home, and Siri, with the goal of adding compatibility for IOT devices.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[MIT](https://choosealicense.com/licenses/mit/)
