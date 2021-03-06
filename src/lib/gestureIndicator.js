'use strict'

let Settings = null,
		TargetData = null;

// also used to caputre the events on mouse release when canvas is hidden
let Overlay = document.createElement("div");
		Overlay.style = `
			position: fixed;
			top: 0;
			bottom: 0;
			left: 0;
			right: 0;
			z-index: 1999999999;
		`;

let Canvas = document.createElement("canvas");
let Context = Canvas.getContext('2d');
let ContextStyle = {
			lineCap: "round",
			lineJoin: "round",
			globalAlpha: 0.1
		};
let Directions = document.createElement("div");
		Directions.style = `
			position: absolute;
			bottom: 0;
			left: 0;
			font-family: firefox-gesture-arrows;
			direction: rtl;
			letter-spacing: 1vw;
			width: 100%;
			text-shadow: 1px 1px 5px rgba(0,0,0, 0.8);
			padding: 1vh 1vh;
			line-height: normal;
			white-space: nowrap;
		`;
let Action = document.createElement("div");
		Action.style = `
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			font-family: Orkney Regular;
			line-height: normal;
			text-shadow: 1px 1px 5px rgba(0,0,0, 0.8);
			text-align: center;
			padding: 25px 20px 20px 20px;
			border-radius: 5px;
			font-weight: bold;
		`;


// get target data from iframes
window.addEventListener("message", (event) => {
	if (TargetData === null &&
			typeof event.data === 'object' &&
			"src" in event.data &&
			"href" in event.data &&
			"selection" in event.data
		) TargetData = event.data;
}, false);


// get target data on first mousemove and right click
document.addEventListener('mousemove', (event) => {
	if (event.buttons === 2 && TargetData === null) {
		TargetData = {
			href: getLinkHref(event.target),
			src: getImageSrc(event.target),
			selection: getTextSelection()
		}
	}
}, true);



// setup gesture handler
let tabGesture = new GestureHandler();

// append canvas and draw
tabGesture.onStart = function (x, y) {
	document.body.appendChild(Overlay);

	if (Settings.Gesture.display) {
		Context.beginPath();
		Context.moveTo(x, y);
	}
}

// draw gesture line
tabGesture.onUpdate = function (x, y) {
	if (Settings.Gesture.display && Overlay.contains(Canvas)) {
		Context.lineTo(x, y);
		Context.stroke();
	}
}

// display directions and action
tabGesture.onChange = function (directions) {
	if (Settings.Directions.display) {
		if (!Overlay.contains(Directions)) Overlay.appendChild(Directions);
		// display the matching direction arrow symbols
		Directions.textContent = directions.join("");
	}
	if (Settings.Action.display) {
		// send message to background on gesture change
		let message = browser.runtime.sendMessage({
			gesture: directions.join(""),
			completed: false
		});
		// display or remove action on response
		message.then((response) => {
			if (response) {
				if (!Overlay.contains(Action)) Overlay.appendChild(Action);
				Action.textContent = response.action;
			}
			else Overlay.removeChild(Action);
		});
	}
}

// remove and clear all elements, then send the gesture to the background script
tabGesture.onEnd = function (directions) {
	document.body.removeChild(Overlay);

	if (Settings.Gesture.display && Overlay.contains(Canvas)) {
		Context.clearRect(0, 0, Canvas.width, Canvas.height);
	}
	if (Settings.Action.display && Overlay.contains(Action)) {
		Action.textContent = "";
		Overlay.removeChild(Action);
	}
	if (Settings.Directions.display && Overlay.contains(Directions)) {
		Directions.textContent = "";
		Overlay.removeChild(Directions);
	}
	// send message to background with the final gesture
	browser.runtime.sendMessage({
		gesture: directions.join(""),
		completed: true,
		data: TargetData
	});

	TargetData = null;
}


// get necessary data from storage and apply styles afterwards
// enable gesture if not already done
chrome.storage.local.get("Display", (settings) => {
	if (Object.keys(settings).length !== 0) {
		Settings = settings.Display;
		applySettings();
		if (!tabGesture.enabled) tabGesture.enable();
	}
});


// listen for propagations from the options or background script and apply styles afterwards
// enable gesture if not already done
chrome.runtime.onMessage.addListener((message) => {
  if (message.Display) {
		Settings = message.Display;
		applySettings();
		if (!tabGesture.enabled) tabGesture.enable();
	}
});



/**
 * will adjust the canvas size
 * and apply its custom styles
 **/
function adjustCanvasToMaxSize () {
	Canvas.width = window.innerWidth;
	Canvas.height = window.innerHeight;
	// FIX ZOOM
	//Canvas.getContext('2d').scale(1/window.devicePixelRatio, 1/window.devicePixelRatio);
	//Canvas.style.transform = "scale("+ 1/window.devicePixelRatio+","+ 1/window.devicePixelRatio+")";

	// reset all style properties becuase they get cleared on canvas resize
	Object.assign(
		Context,
		ContextStyle,
		{
			lineWidth: Settings.Gesture.style.lineWidth,
			strokeStyle: Settings.Gesture.style.strokeStyle
		}
	);
}


/**
 * applies all custom styles to the html elements
 **/
function applySettings () {
	if (Settings.Gesture.display) {
		Canvas.style.opacity = Settings.Gesture.style.opacity;

		// resize canvas on window resize
		window.addEventListener('resize', adjustCanvasToMaxSize, true);
		adjustCanvasToMaxSize();
		Overlay.appendChild(Canvas);
	}
	else if (Overlay.contains(Canvas)) Overlay.removeChild(Canvas);

	// assign all css properties defined in the Settings.Directions
	if (Settings.Directions.display) {
		Directions.style.fontSize = Settings.Directions.style.fontSize;
		Directions.style.textAlign = Settings.Directions.style.textAlign;
		Directions.style.color = Settings.Directions.style.color;
		Directions.style.backgroundColor = 'rgba('
			+ hexToRGB(Settings.Directions.style.backgroundColor).join(",") + ','
			+ Settings.Directions.style.backgroundOpacity +
		')';
	}

	// assign all css properties defined in the Settings.Action
	if (Settings.Action.display) {
		Action.style.fontSize = Settings.Action.style.fontSize;
		Action.style.color = Settings.Action.style.color;
		Action.style.backgroundColor = 'rgba('
			+ hexToRGB(Settings.Action.style.backgroundColor).join(",") + ','
			+ Settings.Action.style.backgroundOpacity +
		')';
	}
}


/**
 * converts a hex color either with hash or not
 * to an rgb color array
 **/
function hexToRGB (hex) {
	if (hex[0] === "#") hex = hex.slice(1);
	let arrayBuffer = new ArrayBuffer(4),
			view = new DataView(arrayBuffer);
			view.setUint32(0, parseInt(hex, 16), false);
	return new Uint8Array(arrayBuffer).slice(1);
}
