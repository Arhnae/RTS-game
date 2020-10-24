class resource extends PIXI.Container{
	constructor(i, j, map, options){
		super();

		this.setParent(map);
		this.id = this.parent.children.length;
		this.name = 'resource';
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.zIndex = getInstanceZIndex(this);
		this.parent.grid[i][j].has = this;
        this.selected = false;
		this.visible = false;

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		//Set solid zone
		let cell = map.grid[i][j];
		cell.solid = true;
		cell.has = this;
		
		if (this.sprite){
			//Change mouse icon if mouseover/mouseout events
			this.sprite.on('mouseover', () => { 
				if (player && player.selectedUnits.length && this.visible){
					if (player.selectedUnits.some(unit => unit.type === 'Villager')){
						gamebox.setCursor('hover');
					}
				}
			})
			this.sprite.on('mouseout', () => {
				gamebox.setCursor('default');
            })
            this.sprite.on('pointertap', () => {
                if (!player.selectedUnits.length){
                    player.unselectAll();
                    this.select();
                    player.interface.setBottombar(this);
                    player.selectedOther = this;
                }
            });
			this.addChild(this.sprite);
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
		const path = [(-32*this.size), 0, 0,(-16*this.size), (32*this.size),0, 0,(16*this.size)];
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
	die(){
		if (this.parent){
			if (typeof this.onDie === 'function'){
				this.onDie();
			}
			let listName = 'founded' + this.type + 's';
			for (let i = 0; i < this.parent.players.length; i++){
				let list = this.parent.players[i][listName];
				let index = list.indexOf(this);
				list.splice(index, 1);
			}
			this.parent.grid[this.i][this.j].has = null;
			this.parent.grid[this.i][this.j].solid = false;
			this.parent.removeChild(this);
		}
		this.isDestroyed = true;
		this.destroy({ child: true, texture: true });
	}
}

class Tree extends resource{
	constructor(i, j, map, textureNames){
		const data = empires.resources['Tree'];

		//Define sprite
		const randomSpritesheet = randomItem(textureNames);
		const spritesheet = app.loader.resources[randomSpritesheet].spritesheet;
		const textureName = '000_' + randomSpritesheet + '.png';
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);
		sprite.on('pointerup', () => {
			if (!player){
				return;
			}
			//If we are placing a building don't permit click
			if (mouseBuilding){
				return;
			}
			//Send Villager to cut the tree
			let hasVillager = false;
			let dest = this;
			for(let i = 0; i < player.selectedUnits.length; i++){
				let unit = player.selectedUnits[i];
				if (instanceIsSurroundedBySolid(this)){
					let newDest = getNewInstanceClosestFreeCellPath(unit, this, this.parent);
					if (newDest){
						dest = newDest.target;
					}
				}
				if (unit.type === 'Villager'){
					hasVillager = true;
					unit.sendToTree(dest);
				}else{
					unit.sendTo(dest);
				}
			}
			if (hasVillager){
				drawInstanceBlinkingSelection(dest);
			}
		})

		super(i, j, map, {
			type: 'Tree',
			sprite: sprite,
			size: 1,
			quantity: data.quantity,
            life: data.life,
            interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
				}
			}
		});
	}
	onDie(){
		const spritesheet = app.loader.resources['623'].spritesheet;
		const textureName = `00${randomRange(0,3)}_623.png`;
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.name = 'stump';
		this.parent.grid[this.i][this.j].addChild(sprite);
	}
}

class Berrybush extends resource{
	constructor(i, j, map){
		const data = empires.resources['Berrybush'];

		//Define sprite
		const spritesheet = app.loader.resources['240'].spritesheet;
		const texture = spritesheet.textures['000_240.png'];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames['000_240.png'].hitArea);
		sprite.on('pointerup', () => {
			if (!player){
				return;
			}
			//If we are placing a building don't permit click
			if (mouseBuilding){
				return;
			}
			//Send Villager to forage the berry
			let hasVillager = false;
			for(let i = 0; i < player.selectedUnits.length; i++){
				let unit = player.selectedUnits[i];
				if (unit.type === 'Villager'){
					hasVillager = true;
					unit.sendToBerrybush(this);
				}else{
					unit.sendTo(this)
				}
			}
			if (hasVillager){
				drawInstanceBlinkingSelection(this);
			}
		})

		super(i, j, map, {
			type: 'Berrybush',
			sprite: sprite,
			size: 1,
            quantity: data.quantity,
            interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
				}
			}
		});
	}
}