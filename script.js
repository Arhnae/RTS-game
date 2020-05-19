
//Settings
const cellWidth = 64;
const cellHeight = 32;
const cellDepth = 16;

const ua = window.navigator.userAgent.toLowerCase();
const isMobile = ua.indexOf('mobile') !== -1 || ua.indexOf('android') !== -1;

const appLeft = 0;
const appTop = 0;
const appWidth = window.innerWidth - 150;
const appHeight = window.innerHeight;
const gamebox = document.getElementById('game');

const maxSelectUnits = 25;

//Map default values
const mapDefaultSize = 52;
const mapDefaultReliefRange = [1, 3];
const mapDefaultChanceOfRelief = 0;
const mapDefaultChanceOfTree = .1;

//Colors
const colorWhite = 0xffffff;
const colorBlack = 0x000000;
const colorGrey = 0x808080;
const colorRed = 0xff0000;
const colorOrange = 0xffa500;
const colorYellow = 0xffff00;
const colorGreen = 0x008000;
const colorBlue = 0x0000ff;
const colorIndigo = 0x4b0082;
const colorViolet = 0xee82ee;
const colorBone = 0xe2dac2;
const colorShipgrey = 0x3c3b3d;

//Cursor icons
const defaultIcon = "url('assets/images/interface/51000/000_51000.png'),auto";
const hoverIcon = "url('assets/images/interface/51000/003_51000.png'),auto";

//Game variables
let app;
let map;
let mouseRectangle;
let mouseBuilding;

window.onload = preload();
function preload(){
	PIXI.settings.ROUND_PIXELS = true;
	app = new PIXI.Application({
		width: appWidth,
		height: appHeight, 
		antialias: false,
		resolution: window.devicePixelRatio, 
		autoResize: true
	});

	//Set loading screen
	let loading = document.createElement('div');
	loading.id = 'loading';
	loading.innerText = 'Loading..';
	Object.assign(loading.style, {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: '100%'
	});
	gamebox.appendChild(loading);

	//Disable contextmenu on rightclick
	gamebox.style.background = 'black';
	gamebox.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});

	//Preload assets
	app.loader.baseUrl = 'assets/images';
	app.loader
		.add('50405','interface/50405/texture.json')
		.add('212','unit/212/texture.json')
		.add('218','building/218/texture.json')
		.add('230','building/230/texture.json')
		.add('233','building/233/texture.json')
		.add('240','ressource/240/texture.json')
		.add('254','building/254/texture.json')
		.add('261','building/261/texture.json')
		.add('273','unit/273/texture.json')
		.add('280','building/280/texture.json')
		.add('418','unit/418/texture.json')
		.add('419','unit/419/texture.json')
		.add('425','unit/425/texture.json')
		.add('432','unit/432/texture.json')
		.add('440','unit/440/texture.json')
		.add('489','building/489/texture.json')
		.add('492','ressource/492/texture.json')
		.add('493','ressource/493/texture.json')
		.add('494','ressource/494/texture.json')
		.add('503','ressource/503/texture.json')
		.add('509','ressource/509/texture.json')
		.add('625','unit/625/texture.json')
		.add('628','unit/628/texture.json')
		.add('632','unit/632/texture.json')
		.add('657','unit/657/texture.json')
		.add('658','unit/658/texture.json')
		.add('664','unit/664/texture.json')
		.add('672','unit/672/texture.json')
		.add('682','unit/682/texture.json')
		.add('15001','terrain/15001/texture.json')
	;

	app.loader.onProgress.add(showProgress);
	app.loader.onComplete.add(create);
	app.loader.onError.add(reportError);
	app.loader.load();
}
function showProgress(e){
}
function reportError(e){
	document.getElementById('loading').innerText = 'ERROR: ' + e.message;
}
function create(){
	//Remove loading screen
	document.getElementById('loading').remove();

	//Set our Pixi application
	gamebox.style.cursor = defaultIcon;
	gamebox.appendChild(app.view);

	//Init map
	map = new Map(mapDefaultSize, mapDefaultReliefRange, mapDefaultChanceOfRelief, mapDefaultChanceOfTree);
	app.stage.addChild(map);

	//Set-up global interactions
	const interactionManager = new PIXI.interaction.InteractionManager(app.renderer);
	interactionManager.on('rightdown', () => {
		map.interface.setBottombar();
		map.player.unselectAllUnit();
	})
	interactionManager.on('pointerdown', (evt) => {
		setTimeout(() => {
			mouseRectangle = {
				x: evt.data.global.x,
				y: evt.data.global.y,
				width: 0,
				height: 0,
				graph: new PIXI.Graphics()
			}
			app.stage.addChild(mouseRectangle.graph);
		}, 50)
	})
	interactionManager.on('pointerup', () => {
		if (mouseRectangle){
			//Select units on mouse selection
			for(let i = 0; i < map.player.units.length; i++){
				let unit = map.player.units[i];
				if (map.player.selectedUnits.length < maxSelectUnits && pointInRectangle(unit.x-map.camera.x, unit.y-map.camera.y, mouseRectangle.x, mouseRectangle.y, mouseRectangle.width, mouseRectangle.height)){
					unit.select();
					map.player.selectedUnits.push(unit);
				}
			}
			//Set our bottombar
			if (map.player.selectedUnits.length){
				let villager = map.player.selectedUnits.find((unit) => unit.type === 'villager');
				if (villager){
					map.interface.setBottombar(villager);
				}else{
					//TODO SELECT UNITS THAT HAVE THE MOST FREQUENCY
					map.interface.setBottombar(map.player.selectedUnits[0]);
				}
			}
			//Reset mouse selection
			mouseRectangle.graph.destroy();
			mouseRectangle = null;
		}
	})
	let hammertime = new Hammer(gamebox);
	hammertime.on('swipe', (evt) => {
		//app.stage.removeChildren();
	})
	interactionManager.on('pointermove', (evt) => {
		let mousePos = evt.data.global;
		if (mouseRectangle && !mouseBuilding){
			if (map.player.selectedUnits.length){
				map.interface.setBottombar();
				map.player.unselectAllUnit();
			}
			mouseRectangle.graph.clear();
			if (mousePos.x > mouseRectangle.x && mousePos.y > mouseRectangle.y){
				mouseRectangle.width = Math.round(mousePos.x - mouseRectangle.x);
				mouseRectangle.height = Math.round(mousePos.y - mouseRectangle.y);
				mouseRectangle.graph.lineStyle(1, colorWhite, 1);
				mouseRectangle.graph.drawRect(mouseRectangle.x, mouseRectangle.y, mouseRectangle.width, mouseRectangle.height);
			}
		}
	})
	//Start main loop
	app.ticker.add(step);
}


function step(){
	if (map){
		map.step();
	}
}
