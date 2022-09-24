console.log("%cGotcha!", "color:blue;font-family:system-ui;font-size:3rem;font-weight:bold");
console.log("Looking for errors being displayed here? Before publishing anything I test my code multiple times and these lonely messages are a testament to that.");

const images = [
	'jan-walter-luigi-oQrtoQqSlgQ-unsplash',
	'jan-walter-luigi-6V05p54JImM-unsplash',
	'jan-walter-luigi-gFockXDZP-o-unsplash',
	'jan-walter-luigi-7-wGXsi_EoE-unsplash',
	'jan-walter-luigi-F6igwFpKikE-unsplash',
	'jan-walter-luigi-8zvODOnXbk4-unsplash',
	'jan-walter-luigi-fRCzJlOdu5w-unsplash'
];

document.addEventListener("DOMContentLoaded", function() {
	// Searches for dynamic background objects
	var dynamicBackground = document.querySelectorAll(".dynamic-background");
	dynamicBackground.forEach((background) => {
		background.src = `images/backgrounds/${images[Math.floor(Math.random()*images.length)]}.jpg`;
	});
		
	// Easter-egg for every 05/16
	var today = new Date();
	if(today.getMonth()+1 === 5 && today.getDate() === 16) {
		var easterEgg = document.querySelectorAll(".self");
		easterEgg.forEach((selfBackground) => {
			selfBackground.src = 'images/backgrounds/jan-walter-luigi-WoVrVb8_UCQ-unsplash.jpg';
		});
	}
});