class Player{
	constructor(i, j, map, age, civ, color, type, isPlayed = false){
		this.name = 'player';
		this.parent = map;
		this.i = i;
		this.j = j;
		this.civ = civ;
		this.age = age;
		this.wood = 200;
		this.food = 200;
		this.stone = 150;
		this.gold = 0;
		this.type = type;
		this.units = [];
		this.buildings = [];
		this.population = 0;
		this.populationMax = 5;
		this.color = color;
		this.isPlayed = isPlayed
		this.foundedTrees = [];
		this.foundedBerrybushs = [];
		this.foundedEnemyBuildings = [];

		if (this.isPlayed){
			player = this;
			this.interface = new Interface(this);
		}

		let cloneGrid = [];
		for (let i = 0; i <= map.size; i++){
			for (let j = 0; j <= map.size; j++){
				if(cloneGrid[i] == null){
					cloneGrid[i] = [];	
				}
				cloneGrid[i][j] = {
					i,
					j,
					viewedBy: [],
					viewed: false
				}
			}
		}
		this.views = cloneGrid;
	}
	otherPlayers(){
		let others = [ ...this.parent.players];
		others.splice(this.parent.players.indexOf(this), 1);
		return others;
	}
	buyBuilding(i, j, type, map){
		const building = empires.buildings[this.civ][this.age][type];
		if (canAfford(this, building.cost)){	
			this.spawnBuilding(i, j, type, map);
			payCost(this, building.cost);
			if (this.isPlayed){
				this.interface.updateTopbar();
			}
			return true;
		}
		return false;
	}
	createUnit(x, y, type, map){	
		const units = {
			Clubman,
			Villager
		}	
		let unit = new units[type](x, y, map, this);
		this.units.push(unit);
		return unit;
	}
	createBuilding(x, y, type, map, isBuilt = false){
		const buildings = {
			Barracks,
			TownCenter,
			House,
			StoragePit,
			Granary
		}			
		let building = new buildings[type](x, y, map, this, isBuilt);
		this.buildings.push(building);
		return building;
	}
}

class AI extends Player{
	constructor(i, j, map, age, civ, color){
		super(i, j, map, age, civ, color, 'AI');
		this.interval = setInterval(() => this.step(), 1000);
	}
	spawnUnit(...args){
		let unit = this.createUnit(...args);
		unit.on('mouseover', () => {
			if (!player){
				return;
			}
			if (player.selectedUnits.length && unit.visible){
				gamebox.setCursor('attack');
			}
		})
		unit.on('mouseout', () => {
			gamebox.setCursor('default');
		})
		unit.on('pointertap', (evt) => {
			if (!player){
				return;
			}
			//If we are placing a building don't permit click
			if (mouseBuilding || mouseRectangle){
				return;
			}
			if (player.selectedUnits.length){
				drawInstanceBlinkingSelection(unit);
				for(let i = 0; i < player.selectedUnits.length; i++){
					let playerUnit = player.selectedUnits[i];
					if (playerUnit.type === 'Villager'){
						playerUnit.sendToAttack(unit);
					}else{
						playerUnit.sendTo(unit, 'attack');
					}
				}
			}
		});
		return unit;
	}
	spawnBuilding(...args){
		let building = this.createBuilding(...args);
		let sprite = building.getChildByName('sprite');
		sprite.on('mouseover', () => {
			if (!player){
				return;
			}
			if (player.selectedUnits.length && building.visible){
				gamebox.setCursor('attack');
			}
		})
		sprite.on('mouseout', () => {
			gamebox.setCursor('default');
		})
		sprite.on('pointertap', (evt) => {
			if (!player){
				return;
			}
			//If we are placing a building don't permit click
			if (mouseBuilding || mouseRectangle){
				return;
			}
			if (player.selectedUnits.length){
				drawInstanceBlinkingSelection(building);
				for(let i = 0; i < player.selectedUnits.length; i++){
					let playerUnit = player.selectedUnits[i];
					if (playerUnit.type === 'Villager'){
						playerUnit.sendToAttack(building);
					}else{
						playerUnit.sendTo(building, 'attack');
					}
				}
			}
		});
		return building;
	}
	step(){
		const maxVillagers = 20;
		const maxVillagersOnConstruction = 4;
		const maxClubmans = 10;
		const howManyVillagerBeforeBuyingABarracks = 10;
		const howManySoldiersBeforeAttack = 5;
		const villagers = this.units.filter(unit => unit.type === 'Villager' && unit.life > 0);
		const clubmans = this.units.filter(unit => unit.type === 'Clubman' && unit.life > 0);
		const towncenters = this.buildings.filter(building => building.type === 'TownCenter');
		const storagepits = this.buildings.filter(building => building.type === 'StoragePit');
		const granarys = this.buildings.filter(building => building.type === 'Granary');
		const barracks = this.buildings.filter(building => building.type === 'Barracks');
		const notBuiltBuildings = this.buildings.filter(building => !building.isBuilt || (building.life > 0 && building.life < building.lifeMax));
		const notBuiltHouses = notBuiltBuildings.filter(building => building.type === 'House');
		const builderVillagers = villagers.filter(villager => !villager.inactif && villager.work === 'builder');
		const villagersOnWood = villagers.filter(villager => !villager.inactif && villager.work === 'woodcutter');
		const villagersOnFood = villagers.filter(villager => !villager.inactif && (villager.work === 'gatherer'));
		const inactifVillagers = villagers.filter(villager => villager.inactif && villager.action !== 'attack');
		const inactifClubmans = clubmans.filter(clubman => clubman.inactif && clubman.action !== 'attack');
		const maxVillagersOnWood = getValuePercentage(villagers.length, 30);
		const maxVillagersOnFood = getValuePercentage(villagers.length, 70);

		//Player loosing
		if (this.buildings.length === 0 && this.units.length === 0){
			this.die();
		}

		/**
		 * Units action
		 */
		//Look for food
		if (villagersOnFood.length <= maxVillagersOnFood && (towncenters.length || granarys.length)){
			if (this.foundedBerrybushs.length){
				for (let i = 0; i < Math.min(maxVillagersOnFood, inactifVillagers.length); i ++){
					let bush = getClosestInstance(inactifVillagers[i], this.foundedBerrybushs);
					inactifVillagers[i].sendToBerrybush(bush);
					//Build a granary close to it, if to far
					let closestTownCenter = getClosestInstance(bush, towncenters);
					let closestGranary = getClosestInstance(bush, granarys);
					if (instancesDistance(closestTownCenter, bush) > 6 && (!instancesDistance(closestGranary, bush) || instancesDistance(closestGranary, bush) > 15)){
						let bushNeighbours = getPlainCellsAroundPoint(bush.i, bush.j, this.parent.grid, 2, (cell) => cell.has && cell.has.type === 'Berrybush');
						if (bushNeighbours.length > 3){
							let pos = getPositionInZoneAroundInstance(bush, this.parent.grid, [0, 6], 2);
							if (pos){
								this.buyBuilding(pos.i, pos.j, 'Granary', this.parent);
							}
						}
					}
				}
			}else{
				for (let i = 0; i < Math.min(maxVillagersOnFood, inactifVillagers.length); i ++){
					inactifVillagers[i].explore();
				}
			}
		}
		//Look for wood
		if (villagersOnWood.length <= maxVillagersOnWood && (towncenters.length || storagepits.length)){
			if (this.foundedTrees.length){
				for (let i = 0; i < Math.min(maxVillagersOnWood, inactifVillagers.length); i ++){
					let tree = getClosestInstance(inactifVillagers[i], this.foundedTrees);
					inactifVillagers[i].sendToTree(tree);
					//Build a storagepit close to it, if to far
					let closestTownCenter = getClosestInstance(tree, towncenters);
					let closestStoragepit = getClosestInstance(tree, storagepits);
					if (instancesDistance(closestTownCenter, tree) > 6 && (!instancesDistance(closestStoragepit, tree) || instancesDistance(closestStoragepit, tree) > 15)){
						let treeNeighbours = getPlainCellsAroundPoint(tree.i, tree.j, this.parent.grid, 2, (cell) => cell.has && cell.has.type === 'Tree');
						if (treeNeighbours.length > 5){
							let pos = getPositionInZoneAroundInstance(tree, this.parent.grid, [0, 6], 2);
							if (pos){
								this.buyBuilding(pos.i, pos.j, 'StoragePit', this.parent);
							}
						}
					}
				}
			}else{
				for (let i = 0; i < Math.min(maxVillagersOnWood, inactifVillagers.length); i ++){
					inactifVillagers[i].explore();
				}
			}
		}
		//Send to construction
		if (notBuiltBuildings.length > 0){
			for (let i = 0; i < notBuiltBuildings.length; i++){
				if (builderVillagers.length >= maxVillagersOnConstruction){
					break;
				}
				const noWorkers = villagers.filter(villager => villager.work !== 'builder' || villager.inactif);
				let villager = getClosestInstance(notBuiltBuildings[i], noWorkers);
				if (villager){
					villager.sendToBuilding(notBuiltBuildings[i]);
				}
			}
		}
		//Send clubman to attack
		if (inactifClubmans.length >= howManySoldiersBeforeAttack){
			if (!this.foundedEnemyBuildings.length){
				let targetIndex = randomRange(0, this.otherPlayers().length - 1);
				let target = this.otherPlayers()[targetIndex];
				let i = target.i + randomRange(-5, 5);
				let j = target.j + randomRange(-5, 5);
				if (this.parent.grid[i] && this.parent.grid[i][j]){
					let cell = this.parent.grid[i][j];
					for (let i = 0; i < clubmans.length; i++){
						clubmans[i].sendTo(cell, 'attack');
					}
				}
			}else{
				for (let i = 0; i < clubmans.length; i++){
					clubmans[i].sendTo(this.foundedEnemyBuildings[0], 'attack');
				}
			}
		}

		/**
		 * Units buying
		 */
		//Buy villager
		if (villagers.length < maxVillagers){
			for (let i = 0; i < maxVillagers - villagers.length; i++){
				if (towncenters[i]){
					towncenters[i].buyUnit('Villager');
				}
			}
		}
		//Buy clubman
		if (clubmans.length < maxClubmans){
			for (let i = 0; i < maxClubmans - clubmans.length; i++){
				if (barracks[i]){
					barracks[i].buyUnit('Clubman');
				}
			}
		}

		/**
		 * Building buying
		 */
		//Buy a house
		if (this.population + 3 > this.populationMax && !notBuiltHouses.length){
			let pos = getPositionInZoneAroundInstance(towncenters[0], this.parent.grid, [3, 12], 2);
			if (pos){
				this.buyBuilding(pos.i, pos.j, 'House', this.parent);
			}
		}
		//Buy a barracks
		if (villagers.length > howManyVillagerBeforeBuyingABarracks && barracks.length === 0){
			let pos = getPositionInZoneAroundInstance(towncenters[0], this.parent.grid, [4, 20], 3, false, (cell) => {
				let isMiddle = true;
				for (let i = 0; i < this.otherPlayers().length; i++){
					if (instancesDistance(cell, this.otherPlayers()[i]) > instancesDistance(towncenters[0], this.otherPlayers()[i])){
						isMiddle = false;
					}
				}
				return isMiddle;
			});
			if (pos){
				this.buyBuilding(pos.i, pos.j, 'Barracks', this.parent);
			}
		}
	}
	die(){
		clearInterval(this.interval);
		this.parent.players.splice(this.parent.players.indexOf(this), 1);
	}
}

class Human extends Player{
	constructor(i, j, map, age, civ, color, isPlayed){
		super(i, j, map, age, civ, color, 'Human', isPlayed);
		this.selectedUnits = [];
		this.selectedBuilding = null;
	}
	spawnUnit(...args){
		let unit = this.createUnit(...args);
		unit.on('pointertap', (evt) => {
			//If we are placing a building don't permit click
			if (mouseBuilding || mouseRectangle){
				return;
			}
			this.unselectAll();
			unit.select();
			this.interface.setBottombar(unit);
			this.selectedUnits.push(unit);
		});
		return unit;
	}
	spawnBuilding(...args){
		let building = this.createBuilding(...args);
		building.visible = true;
		for(let u = 0; u < this.selectedUnits.length; u++){
			let unit = this.selectedUnits[u];
			if (unit.type === 'Villager'){
				drawInstanceBlinkingSelection(building);
				unit.sendToBuilding(building);
			}
		}

		building.getChildByName('sprite').on('pointertap', (evt) => {
			//If we are placing a building don't permit click
			if (mouseBuilding || mouseRectangle){
				return;
			}
			//Send Villager to build the building
			if (!building.isBuilt){
				for (let i = 0; i < this.selectedUnits.length; i++){
					let unit = this.selectedUnits[i];
					if (unit.type === 'Villager'){
						drawInstanceBlinkingSelection(building);
						unit.sendToBuilding(building);
					}
				}
				return;
			}

			//Send Villager to give loading of resources
			if (this.selectedUnits){
				let hasVillagerLoaded = false;
				for (let i = 0; i < this.selectedUnits.length; i++){
					let unit = this.selectedUnits[i];
					if (unit.type === 'Villager' && unit.loading > 0){
						hasVillagerLoaded = true;
						drawInstanceBlinkingSelection(building);
						unit.previousDest = null;
						switch (unit.work){
							case 'woodcutter':
								unit.sendTo(building, 'deliverywood');
								break;
							case 'gatherer':
								unit.sendTo(building, 'deliveryberry');
								break;
						}
					}
				}
				if (hasVillagerLoaded){
					return;
				}
			}
		
			//Select
			this.unselectAll();
			building.select();
			this.interface.setBottombar(building);
			this.selectedBuilding = building;
		});
		return building;
	}
	unselectAllUnits(){
		for (let i = 0; i < this.selectedUnits.length; i++){
			this.selectedUnits[i].unselect();
		}
		this.selectedUnits = [];
	}
	unselectAll(){
		if (this.selectedBuilding){
			this.selectedBuilding.unselect();
			this.selectedBuilding = null;
		}
		this.unselectAllUnits();
	}
}