# RUN the following to download and run this script:
# python <(curl https://home.fakult.net/remote/backend/boostrap -L)

import requests
from getpass import getpass
import sys
import os
import time
import json

NAME = "Fakult Master Remote"
#PUBLIC_KEY = "HDSJKHDJKKDSA"
ALLOWED_HOST = "uhtenoahutenahtunoheausa"
BASE_URL = "https://home.fakult.net/remote/backend/"
DEVICE_TYPES = { "lights": "lights", "locks": "locks", "temperature": "temperature", "humidity": "humidity", "moisture": "moisture", "motors": "motors", "rgblights": "rgblights" }
REMOTE_SERVER_CONF_FILE = "remote_server_data.json"
REMOTE_SERVER_CONF_DIR = "server_config/"
PASS_LENGTH = 5

def i(data, key, prompt, default = None):
    data[key] = input(prompt)
    if data[key] == "":
        if default == None:
            print("Please enter a value")
            i(data, key, prompt, None)
        else:
            data[key] = default

def ii(s):
    inp = input(s + "(Enter for yes, anything else for no): ")

    return inp == "" or inp.lower().strip() == "yes"

def printHello():
    helloStr = "\nWelcome to the " + NAME + " setup wizard!\n"
    helloStr += "This tool will help you configure and register this remote server node with the master remote app\n"
    helloStr += "This script should be run on the server that will directly connect to the devices you wish to add\n"
    helloStr += "If you wish to use an existing config, please rename it to " + REMOTE_SERVER_CONF_DIR +  REMOTE_SERVER_CONF_FILE + "\n"
    helloStr += "If you are not in the correct directory, hit ctrl-c to stop this script now\n\n"

    print(helloStr)

def runStartup():
    data = {}
    
    if not os.path.exists(REMOTE_SERVER_CONF_DIR):
        os.makedirs(REMOTE_SERVER_CONF_DIR)

    if os.path.exists(REMOTE_SERVER_CONF_DIR + REMOTE_SERVER_CONF_FILE):
        rerun = ii("Existing server config detected, would you like to reregister that configuration? ")

        if rerun:
            f = open(REMOTE_SERVER_CONF_DIR + REMOTE_SERVER_CONF_FILE, "r")
            data = f.read()
            f.close()
            registerDevices(json.loads(data))
            sys.exit(0)
        else:
            os.rename(REMOTE_SERVER_CONF_DIR + REMOTE_SERVER_CONF_FILE, REMOTE_SERVER_CONF_DIR + REMOTE_SERVER_CONF_FILE + "_" + str(int(time.time())) + ".bak")

    runCreateAccount(data)

def runCreateAccount(data):
    account = ii("Do you have an account? ")
    if account:
        runAuthentication(data)
    else:
        print("Creating account")
        user_data = {}
        i(user_data, "first_name", "First name: ")
        i(user_data, "last_name", "Last name: ")
    
        user_data["pass"] = getpass("Password (" + str(PASS_LENGTH) + " numbers): ")
        createURL = BASE_URL + "create_account"
        response = requests.post(createURL, data = user_data)
        while response.text == "Invalid password":
            print("Please choose another password")
            
            user_data["pass"] = getpass("Password (" + str(PASS_LENGTH) + " numbers): ")
            response = requests.post(createURL, data = user_data)

        print("Your account has been created!")

        runAuthentication(data, 0, False, user_data["pass"])

def runAuthentication(data, numAttempts = 0, skipPrompt = False, pw = None):
    if pw == None:
        pw = getpass("Password (" + str(PASS_LENGTH) + " numbers): ")

    authURL = BASE_URL + "authenticate"
    response = requests.post(authURL, data = {"pass": pw})
    if response.text == "Invalid password":
        numAttempts += 1
        if (numAttempts == 3):
            print("Unable to authenticate... Exiting")
            sys.exit(0)
        else:
            print("Password was invalid. " + str(3 - numAttempts) + " tries remaining")
            runAuthentication(data, numAttempts)
    else:
        print("Got auth response:", response, response.text)
        jsonRes = json.loads(response.text)
        #print("JSONres", jsonRes)
        data["token"] = jsonRes["token"]
        print("Authentication successful!")

        if not skipPrompt:
            runPrompt(data)

def runPrompt(data, token = None):
    i(data, "project_name", "Project name: ")
    i(data, "project_location", "Project location: ")
    i(data, "ssh_port", "SSH access port (Enter for default [6013])", "6013")

    runSetupDevice(data)

def runSetupDevice(data, isNew = ""):
    setupDevice = ii("Do you want to setup a" + isNew + " device? ")
    if not setupDevice:
        registerDevices(data)
        #writeData(data)
    else:
        device = {}
        if "devices" not in data:
            data["devices"] = []
        i(device, "name", "Device name: ")
        i(device, "location", "Device location: ")
        i(device, "device_type", "Device Type (choose one [" + ", ".join(DEVICE_TYPES) + "]): ")

        t = device["device_type"]
        while device["device_type"] not in DEVICE_TYPES:
            print("Invalid device type")
            i(device, "device_type", "Device Type (choose one [" + ", ".join(DEVICE_TYPES) + "]): ")

        print("Device looks like", device)
        dt = device["device_type"]
        if dt == DEVICE_TYPES["rgblights"]:
            device["data"] = { "red": 255, "green": 255, "blue": 255 }
            device["image_name"] = "LED"
            device["image_type"] = "png"
        elif dt == DEVICE_TYPES["humidity"]:
            device["data"] = { "humidity": 50 }
            device["image_name"] = "humidity_sensor"
            device["image_type"] = "png"
        elif dt == DEVICE_TYPES["temperature"]:
            device["data"] = { "temperature": 69, "mode": "auto", "fan": "auto" }
            device["image_name"] = "air_conditioner"
            device["image_type"] = "png"
        elif dt == DEVICE_TYPES["lights"]:
            device["image_name"] = "lightbulb"
            device["image_type"] = "png"
        elif dt == DEVICE_TYPES["locks"]:
            device["image_name"] = "bolt-lock"
            device["image_type"] = "png"
        elif dt == DEVICE_TYPES["moisture"]:
            device["image_name"] = "moisture_sensor"
            device["image_type"] = "png"
        elif dt == DEVICE_TYPES["motors"]:
            device["image_name"] = "motor"
            device["image_type"] = "svg"
        
        data["devices"].append(device)
        print("Device added!")
        runSetupDevice(data, "nother")   # Don't judge me

def writeData(data):
    print("Writing data...")

    f = open(REMOTE_SERVER_CONF_DIR + REMOTE_SERVER_CONF_FILE, "w")
    f.write(json.dumps(data, indent=4))
    f.close()

    print("Done!")
    #registerDevices(data)

def registerDevices(data):
    print("Registering data to server...")

    headers={ "content-type": "application/json" }
    registerURL = BASE_URL + "register_device"
    upload_data = {"registry": data} #json.loads(json.dumps(data))}

    response = requests.post(registerURL, data=json.dumps(upload_data), headers=headers ).text

    if response == "Invalid registry":
        print("Registry format is not valid... Exiting")
        sys.exit(0)

    while response == "Invalid token":
        print("Token expired... Please reauthenticate")
        runAuthentication(data, 0, True)

        registerURL = BASE_URL + "register_device"
        response = requests.post(registerURL, data=json.dumps(upload_data) ).text

        if response == "Invalid registry":
            print("Registry format is not valid... Exiting")
            sys.exit(0)

    device_ids = json.loads(response)
    print("Got response:", response)
    if len(device_ids) != len(data["devices"]):
        print("Server didn't return correct amount of device ids", len(device_ids), "ids for", len(data["devices"]), "devices")
        return

    for index in range(len(device_ids)):
        data["devices"][index]["device_id"] = device_ids[index]

    writeData(data)

printHello()
runStartup()
