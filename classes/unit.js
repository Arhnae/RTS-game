class Unit extends PIXI.Container {
	constructor(i, j, map, player, options = {}){
		super();

		this.setParent(map);
		this.id = this.parent.children.length;
		this.name = 'unit'
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.next = null;
		this.dest = null;
		this.previousDest = null;
		this.path = [];
		this.player = player;
		this.zIndex = getInstanceZIndex(this);
		this.interactive = true;
		this.selected = false;
		this.degree = randomRange(1,360);
		this.currentFrame = randomRange(0, 4);
		this.action = null;
		this.work = null;
		this.loading = 0;
		this.maxLoading = 10;
		this.currentSheet = null;
		
		this.currentCell = this.parent.grid[this.i][this.j];
		this.currentCell.has = this;
		this.currentCell.solid = true;

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		this.originalSpeed = this.speed;		
		this.actionSheet = null;
		this.deliverySheet = null;

		let sprite = new PIXI.AnimatedSprite(this.standingSheet.animations['south']);
		sprite.name = 'sprite';
		changeSpriteColor(sprite, player.color);

		sprite.updateAnchor = true;
		this.addChild(sprite);
		this.stop();
		if (!this.parent.revealEverything){
			renderCellOnInstanceSight(this);
		}
	}
	select(){
		if (this.selected){
			return;
		}
		this.selected = true;
		let selection = new PIXI.Graphics();
		selection.name = 'selection';
		selection.zIndex = 3;
		selection.lineStyle(1, 0xffffff);		
		const path = [(-32*.5), 0, 0,(-16*.5), (32*.5),0, 0,(16*.5)];
		selection.drawPolygon(path);
		this.addChildAt(selection, 0);
	}
	unselect(){
		this.selected = false;
		let selection = this.getChildByName('selection');
		if (selection){
			this.removeChild(selection);
		}
	}
	hasPath(){
		return this.path.length > 0;
	}
	setDestination(instance, action, cpt = 0){
		this.dest = instance;	
		//No instance we cancel the destination
		if (!instance){
			this.stop();
			return;
		}
		//Unit is already beside our target
		if (action && instanceContactInstance(this, instance)){
			this.degree = getInstanceDegree(this, instance.x, instance.y);
			this.getAction(action);
			return;
		}
		//Set unit path
		if (this.parent.grid[instance.i][instance.j].solid){
			this.path = getInstanceClosestFreeCellPath(this, instance.i, instance.j, this.parent);
		}else{
			this.path = getInstancePath(this, instance.i, instance.j, this.parent);
		}
		//Unit found a path, set the action and play walking animation
		if (this.path.length){
			this.action = action;
			this.setAnimation('walkingSheet');
			return;
		}
		//Unit didn't find a way we wait and try again
		this.stop();
		if (cpt > 5){
			this.action = null;
		}else{
			setTimeout(() => {
				cpt++;
				this.setDestination(instance, action, cpt);
			}, 300);
		}
	}
	moveToNearestTree(){
		this.stop();
		setTimeout(() => {
			const targets = findInstancesInSight(this, (instance) => instance.name === 'resource' && instance.type === 'tree' && instance.quantity > 0);
			if (targets.length){
				const target = getClosestInstance(this, targets);
				this.setDestination(target, 'chopwood');
			}else{
				this.stop();
			}
		}, 150);
	}
	moveToNearestBerrybush(){
		this.stop();
		setTimeout(() => {
			const targets = findInstancesInSight(this, (instance) => instance.name === 'resource' && instance.type === 'berrybush');
			if (targets.length){
				const target = getClosestInstance(this, targets);
				this.setDestination(target, 'forageberry');
			}else{
				this.stop()
			}
		}, 150);

	}
	moveToNearestConstruction(){
		//TODO CHECK FOR CONSTRUCTION SAME PLAYER
		this.stop();
		setTimeout(() => {
			const targets = findInstancesInSight(this, (instance) => instance.name === 'building' && !instance.isBuilt);
			if (targets.length){
				const target = getClosestInstance(this, targets);
				this.setDestination(target, 'build');
			}else{
				this.stop();
			}
		}, 150);
	}
	getAction(name){
		let sprite = this.getChildByName('sprite');
		switch (name){
			case 'chopwood':
				if (!this.dest || this.dest.type !== 'tree' || this.dest.quantity <= 0){
					this.moveToNearestTree();
					return;
				}
				sprite.onLoop = () => {
					//Villager is full we send him delivery first
					if (this.loading === this.maxLoading || !this.dest){
						let targets = filterInstancesByTypes(this.player.buildings, ['TownCenter', 'StoragePit']);
						let target = getClosestInstance(this, targets);
						if (this.dest){
							this.previousDest = this.dest;
						}else{
							this.previousDest = this.parent.grid[this.i][this.j];
						}
						this.setDestination(target, 'deliverywood');
						return;
					}
					//Tree destination is still alive we cut him until it's dead
					if (this.dest.life > 0){
						this.dest.life--;
						if (this.dest.life <= 0){
							//Set cutted tree texture
							let sprite = this.dest.getChildByName('sprite');
							const spritesheet = app.loader.resources['636'].spritesheet;
							const textureName = `00${randomRange(0,3)}_636.png`;
							const texture = spritesheet.textures[textureName];
							sprite.texture = texture;
							const points = [-32, 0, 0,-16, 32,0, 0,16];
							sprite.hitArea = new PIXI.Polygon(points);
							sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y);
						}
						return;
					}
					//Villager cut the stump
					this.loading++;
					this.dest.quantity--;
					//Destroy tree if stump out of quantity
					if (this.dest.quantity <= 0){
						if (this.parent.grid[this.dest.i][this.dest.j].has === this.dest){
							const spritesheet = app.loader.resources['623'].spritesheet;
							const textureName = `00${randomRange(0,3)}_623.png`;
							const texture = spritesheet.textures[textureName];
							let sprite = new PIXI.Sprite(texture);
							sprite.name = 'stump';
							this.parent.grid[this.dest.i][this.dest.j].addChild(sprite);
							this.dest.destroy();
						}
						this.dest = null;
					}
					//Set the walking with wood animation
					if (this.loading > 1){
						this.walkingSheet = app.loader.resources['273'].spritesheet;
						this.standingSheet = null;
					}
				}
				this.setAnimation('actionSheet');
				break;
			case 'deliverywood':
				this.player.wood += this.loading;
				this.parent.interface.updateTopbar();
				this.loading = 0;
				this.walkingSheet = app.loader.resources['682'].spritesheet;
				this.standingSheet = app.loader.resources['440'].spritesheet;
				if (this.previousDest){
					this.setDestination(this.previousDest, 'chopwood');
				}else{
					this.stop()
				}
				break;
			case 'forageberry':
				if (!this.dest || this.dest.type !== 'berrybush' || this.dest.quantity <= 0){
					this.moveToNearestBerrybush();
					return;
				}
				sprite.onLoop = () => {
					//Villager is full we send him delivery first
					if (this.loading === this.maxLoading || !this.dest){
						let targets = filterInstancesByTypes(this.player.buildings, ['TownCenter', 'Granary']);
						let target = getClosestInstance(this, targets);
						if (this.dest){
							this.previousDest = this.dest;
						}else{
							this.previousDest = this.parent.grid[this.i][this.j];
						}
						this.setDestination(target, 'deliveryberry');
						return;
					}
					//Villager forage the berrybush
					this.loading++;
					this.dest.quantity--;
					//Destroy berrybush if it out of quantity
					if (this.dest.quantity <= 0){
						this.dest.destroy();
						this.dest = null;
					}
				}
				this.setAnimation('actionSheet');
				break;
			case 'deliveryberry':
				this.player.food += this.loading;
				this.parent.interface.updateTopbar();
				this.loading = 0;
				if (this.previousDest){
					this.setDestination(this.previousDest, 'forageberry');
				}else{
					this.stop()
				}
				break;
			case 'build':
				if (!this.dest || this.dest.isBuilt){
					this.moveToNearestConstruction();
					return;
				}
				sprite.onLoop = () => {
					if (this.dest.name !== 'building'){
						this.stop()
						return;
					}
					if (this.dest.life < this.dest.lifeMax){
						this.dest.life += this.attack;
						this.dest.updateTexture();
					}else{
						if (!this.dest.isBuilt){
							this.dest.updateTexture();
							this.dest.isBuilt = true;
						}
						this.moveToNearestConstruction();
					}
				}
				this.setAnimation('actionSheet');
				break;
			default: 
				this.stop()	
		}
	}
	moveToPath(){
		this.next = this.path[this.path.length - 1];
		const nextCell = this.parent.grid[this.next.i][this.next.j];
		let sprite = this.getChildByName('sprite');
		//Collision with another walking unit, we block the mouvement
		if (nextCell.has && nextCell.has.name === 'unit' && nextCell.has !== this
			&& nextCell.has.hasPath() && instancesDistance(this, nextCell.has, true) <= 1
			&& nextCell.has.getChildByName('sprite').playing){ 
			sprite.stop();
			return;
		}
		//Next cell is a solid
		if (nextCell.solid && this.dest){
			//We got a work we find another solution
			if (this.path.length === 1 && this.work && this.action){
				switch(this.action){
					case 'chopwood' :
						this.moveToNearestTree();
						break;
					case 'forageberry':
						this.moveToNearestBerrybush();
						break;
					case 'build':
						this.moveToNearestConstruction();
						break;
					default: 
						this.path = getInstanceClosestFreeCellPath(this, this.dest.i, this.dest.j, this.parent);
				}
				return;
			}else{
				//Search another way
				this.path = getInstanceClosestFreeCellPath(this, this.dest.i, this.dest.j, this.parent);
				return;
			}
		}

		if (!sprite.playing){
			sprite.play();
		}

		this.zIndex = getInstanceZIndex(this); 
		if (instancesDistance(this, this.next) < 10){
			this.z = this.next.z;
			this.i = this.next.i;
			this.j = this.next.j;
	
			if (this.currentCell.has === this){
				this.currentCell.has = null;
				this.currentCell.solid = false;
			}
			this.currentCell = this.parent.grid[this.i][this.j];
			if (this.currentCell.has === null){
				this.currentCell.has = this;
				this.currentCell.solid = true;
			}
	
			if (!this.parent.revealEverything){
				renderCellOnInstanceSight(this);
			}
			this.path.pop();
			if (!this.path.length){
				if (this.action && instanceContactInstance(this, this.dest)){
					this.degree = getInstanceDegree(this, this.dest.x, this.dest.y);
					this.getAction(this.action);
				}else{
					this.stop()
				}
				return;
			}
		}else{
			//Move to next
			const oldDeg = this.degree;
			let speed = this.speed;
			if (this.loading > 1){
				speed*=.75;
			}
			moveTowardPoint(this, this.next.x, this.next.y, speed);
			if (oldDeg !== this.degree){	
				//Change animation according to degree
				this.setAnimation('walkingSheet');
			}
		}
	}
	stop(){
		if (this.currentCell.has !== this && this.currentCell.solid){
			this.setDestination(this.currentCell);
			return;
		}
		this.currentCell.has = this;
		this.currentCell.solid = true;
		this.path = [];
		this.setAnimation('standingSheet');
	}
	step(){
		if (this.hasPath()){
			this.moveToPath();
		}
	}
	setAnimation(sheet){
		let sprite = this.getChildByName('sprite');
		//Sheet don't exist we just block the current sheet
		if (!this[sheet]){
			if (this.currentSheet !== 'walkingSheet' && this.walkingSheet){
				sprite.textures = [this.walkingSheet.textures[Object.keys(this.walkingSheet.textures)[0]]];
			}else{
				sprite.textures = [sprite.textures[sprite.currentFrame]];
			}
			this.currentSheet = 'walkingSheet';
			sprite.stop();
			sprite.anchor.set(sprite.textures[sprite.currentFrame].defaultAnchor.x, sprite.textures[[sprite.currentFrame]].defaultAnchor.y)
			return;
		}
		//Reset action loop
		if (sheet !== 'actionSheet'){
			sprite.onLoop = () => {};
		}
		this.currentSheet = sheet;
		sprite.animationSpeed = this[sheet].data.animationSpeed || ( sheet === 'standingSheet' ? .1 : .2);
		if (this.degree > 67.5 && this.degree < 112.5){
			sprite.scale.x = 1;
			sprite.textures = this[sheet].animations['north']
		}else if (this.degree > 247.5 && this.degree < 292.5){
			sprite.scale.x = 1;
			sprite.textures = this[sheet].animations['south']
		}else if (this.degree > 337.5 || this.degree < 22.5){
			sprite.scale.x = 1;			
			sprite.textures = this[sheet].animations['west']
		}else if (this.degree >= 22.5 && this.degree <= 67.5){
			sprite.scale.x = 1;
			sprite.textures = this[sheet].animations['northwest'];
		}else if (this.degree >= 292.5 && this.degree <= 337.5){
			sprite.scale.x = 1;			
			sprite.textures = this[sheet].animations['southwest'];
		}else if (this.degree > 157.5 && this.degree < 202.5){
			sprite.scale.x = -1;
			sprite.textures = this[sheet].animations['west'];
		}else if (this.degree > 112.5 && this.degree < 157.5){
			sprite.scale.x = -1;
			sprite.textures = this[sheet].animations['northwest'];
		}else if (this.degree > 202.5 && this.degree < 247.5){
			sprite.scale.x = -1;
			sprite.textures = this[sheet].animations['southwest'];
		}
		sprite.play();
	}
}

class Villager extends Unit {
	constructor(i, j, map, player){
		const data = empires.units['Villager'];
		super(i, j, map, player, {
			type: 'Villager',
			lifeMax: data.lifeMax,
			sight: data.sight,
			speed: data.speed,
			attack: data.attack,
			standingSheet: app.loader.resources['418'].spritesheet,
			walkingSheet: app.loader.resources['657'].spritesheet,
			interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
				},
				menu: [
					{
						icon: 'data/interface/50721/002_50721.png',
						children : [
							map.interface.getBuildingButton(player, 'House'),
							map.interface.getBuildingButton(player, 'Barracks'),
							map.interface.getBuildingButton(player, 'Granary'),
							map.interface.getBuildingButton(player, 'StoragePit'),
						]
					},
				]
			}
		})
	}
}

class Clubman extends Unit {
	constructor(i, j, map, player){
		const data = empires.units['Clubman'];
		super(i, j, map, player, {
			type: 'Clubman',
			lifeMax: data.lifeMax,
			sight: data.sight,
			speed: data.speed,
			attack: data.attack,
			standingSheet: app.loader.resources['425'].spritesheet,
			walkingSheet: app.loader.resources['664'].spritesheet,
			actionSheet: app.loader.resources['212'].spritesheet,
			interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
				},
			}
		})
	}
}