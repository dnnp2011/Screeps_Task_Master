var _ = require('lodash');
var utils = require('_utilities');


/**
 * Displays x number of items from the event log.
 * @param x {Number} The number of log elements to display to console. Valid entries are between 1 and 100.
 */
global.displayFromLog = function(x) {
	var log = Memory.log;
	var displayLog = _.takeRight(log, x);
	_.forEach(displayLog, function(n) {
		console.log('[**LOG**] ' + n);
	});
};


Creep.prototype.transferResourcesToAdjacentCreep = function (resourceType = RESOURCE_ENERGY, loadouts = []) {
	if (this.carry[resourceType] > 0) {
		if (_.isString(loadouts)) {loadouts = [loadouts];}
		
		let adjacentNonFullCreeps = this.pos.findInRange(FIND_MY_CREEPS, 1, {filter: creep => {
			return (_.isEmpty(loadouts) || _.includes(loadouts, creep.memory.loadout)) && _.sum(creep.carry) < creep.carryCapacity
		}});
		let creepWithBiggestDeficiency = _.first(_.sortBy(adjacentNonFullCreeps, creep => _.sum(creep.carry) / creep.carryCapacity));
		this.transfer(creepWithBiggestDeficiency, resourceType);
	}
};


Creep.prototype.deliverEnergy = function () {
	//let dropOff = this.carry.resourceType === RESOURCE_ENERGY ? this.getEnergyDropOff() : this.getMineralDropOff();
	let dropOff = this.getEnergyDropOff();
	let path_result;
	
	if (dropOff) {
		if (!this.pos.isNearTo(dropOff)) {
			/*path_result = this.moveByMemoryTo(dropOff, 1); //Cache movement
			if (path_result === PATH_END) {utils.addToMovementLog(`${this.name}: of type ${this.memory.loadout} has reached their destination: ${dropOff}`);}*/
			this.moveTo(dropOff);
		}
		else {
			this.transfer(dropOff, RESOURCE_ENERGY);
			
			if (this.fatigue === 0 && _.sum(this.carry) > dropOff.getResourceDeficiency(this.carry.resourceType)) {
				dropOff = this.carry.resourceType === RESOURCE_ENERGY ? this.getEnergyDropOff(true) : this.getMineralDropOff(true);
				if (dropOff) {
					this.moveTo(dropOff);
					/*path_result = this.moveByMemoryTo(dropOff, 1); //Cache movement
					if (path_result === PATH_END) {utils.addToMovementLog(`${this.name}: of type ${this.memory.loadout} has reached their destination: ${dropOff}`);}*/
				}
			}
		}
	}
	else {
		//ToDo: If not energyDropOffs then shuttle energy to towers etc. ---
	}
};


Creep.prototype.getEnergyDropOff = function (forceNew = false) {
	let dropOff;
	if (!forceNew) {
		dropOff = Game.getObjectById(this.memory.dropOffId);
	}
	
	if (!dropOff || !dropOff.canReceiveEnergy()) {
		let ignored = [];
		if (_.isArray(this.room.memory.minerDropContainerIds)) {
			Array.prototype.push.apply(ignored, this.room.memory.minerDropContainerIds);
		}
		if (forceNew && _.isString(this.memory.dropOffId)) {
			ignored.push(this.memory.dropOffId);
		}
		dropOff = utils.findClosestEnergyDropOff(this.pos, ignored);
		this.memory.dropOffId = dropOff ? dropOff.id : null;
	}
	return dropOff;
};


Creep.prototype.getMineralDropOff = function (forceNew = false) {
	
};


Creep.prototype.moveByMemoryTo = function (target, distance) {
	if (this.spawning || this.fatigue > 0) {return PATH_FAIL;}
	if (this.pos.getRangeTo(target) <= distance) {return PATH_END;}
	if (!this.memory.path || !this.memory.path[this.memory.path.length - 1] || this.memory.path_failed) {
		this.memory.path = utils.setPathTo(this, target, distance);
		this.memory.prev_pos = this.pos;
		this.memory.path_failed = false;
		if (this.memory.path) {if (this.moveByPath(this.memory.path) < 0){this.memory.path_fails += 1 || 1;} return PATH_FOUND;}
		//PATH_CHANGED?
		else {this.memory.path_fails += 1 || 1;}
	}
	let lastStep = this.memory.path.length - 1;
	if (this.memory.path_fails > 0) {
		//If failed to generate path, move in a random direction and try again
		this.memory.prev_pos = this.pos;
		this.memory.path_fails = 0;
		let num = _.random(0, 6);
		switch( num ){
			case 0:
				this.moveTo(this.pos.x - 1, this.pos.y - 1);
				break;
			case 1:
				this.moveTo(this.pos.x - 1, this.pos.y);
				break;
			case 2:
				this.moveTo(this.pos.x - 1, this.pos.y + 1);
				break;
			case 3:
				this.moveTo(this.pos.x , this.pos.y + 1);
				break;
			case 4:
				this.moveTo(this.pos.x + 1 , this.pos.y + 1);
				break;
			case 5:
				this.moveTo(this.pos.x + 1 , this.pos.y);
				break;
			case 6:
				this.moveTo(this.pos.x + 1 , this.pos.y - 1);
				break;
		}
		if(JSON.stringify(this.pos) === (JSON.stringify(this.memory.prev_pos)) && this.fatigue === 0) {
			this.memory.path_fails += 1 || 1;
			return PATH_FAIL;
		}
		else {this.memory.path_failed = true; return PATH_WALKING;}
	}
	else if(!target.pos.isEqualTo(this.memory.path[lastStep].x, this.memory.path[lastStep].y)) {
		this.memory.path = utils.setPathTo(this, target, distance);
		return PATH_CHANGED;
	}
	else if (this.pos.getRangeTo(target) > distance) {
		if (JSON.stringify(this.pos) === (JSON.stringify(this.memory.prev_pos)) && this.fatigue === 0) {
			this.memory.path_fails += 1 || 1;
			return PATH_FAIL;
		}
		if (JSON.stringify(this.pos) !== JSON.stringify(this.memory.prev_pos) && this.fatigue === 0) {
			this.memory.prev_pos = this.pos; this.memory.path_fails = 0;
		}
		if (this.moveByPath(this.memory.path) < 0) {
			this.memory.path_failed = true;
			return PATH_ERROR;
		}
		return PATH_WALKING;
	}
	this.memory.path_fails += 1 || 1;
	return PATH_ERROR;
};


/**
 * Retrieves the maxHits of a structure. The difference between this and the built in maxHits property is
 * that if the object being tested is listed in the STRUCTURE_TARGET_HITS constant, the appropriate
 * number of maxHits for this room's controller level will be returned.
 * @returns {Number} Returns the number value of this structure's maximum hit points.
 */
Structure.prototype.getStructureHits = function () {
	var room = this.room;
	if (_.isUndefined(room) || _.isUndefined(room.controller) || !room.controller.my
		|| !_.has(STRUCTURE_TARGET_HITS, this.structureType) || !_.has(STRUCTURE_TARGET_HITS[this.structureType], room.controller.level + '')) {
		return this.hitsMax;
	}
	
	return STRUCTURE_TARGET_HITS[this.structureType][room.controller.level];
};


Structure.prototype.getResourceDeficiency = function (resourceType = RESOURCE_ENERGY) {
	if (resourceType === RESOURCE_ENERGY && this.hasEnergyStore()) {
		return this.energyCapacity - this.energy;
	}
	else if (resourceType !== RESOURCE_ENERGY && this.hasResourceStore()) {
		return this.storeCapacity - _.sum(this.store);
	}
	return 0;
};


Structure.prototype.hasEnergyStore = function () {
	return _.isNumber(this.energy) && _.isNumber(this.energyCapacity);
};


Structure.prototype.hasResourceStore = function () {
	return _.isObject(this.store) && _.isNumber(this.storeCapacity);
};


/**
 * @returns {boolean} True, if this structure can currently receive at least one unit
 * of energy, false otherwise
 */
Structure.prototype.canReceiveEnergy = function () {
	return this.canReceiveResources(RESOURCE_ENERGY);
};

/**
 * Determines whether this structure can currently receive resources of the given type.
 *
 * @param {String} resourceType The type of resource that someone is trying to transfer
 * to this structure
 * @returns {boolean} True, if this structure can currently receive at least 1 resource
 * of the given type, false otherwise
 */
Structure.prototype.canReceiveResources = function (resourceType = RESOURCE_ENERGY) {
	return (this.hasResourceStore() && _.sum(this.store) < this.storeCapacity) ||
		(resourceType === RESOURCE_ENERGY && this.hasEnergyStore() && this.energy < this.energyCapacity);
};


/**
 * @returns {boolean} True, if this structure is friendly or neutral, false otherwise
 */
Structure.prototype.isFriendlyOrNeutral = function () {
	return _.isUndefined(this.my) || this.my === true;
};


/**
 * A utility method for getting a value from the structure's memory object. Useful with
 * structures that don't have a memory reference of their own, e.g. towers.
 *
 * @param {String} key The key whose corresponding value should be get
 * @returns {*} Whatever is stored for the given key, or undefined if no value has been set
 */
RoomObject.prototype.getFromMemory = function (key) {
	this.initMemory();
	return this.memory[key];
};


/**
 * A utility method for setting a value to the structure's memory object. Useful with
 * structures that don't have a memory reference of their own, e.g. towers.
 *
 * @param {String} key The key whose corresponding value should be set
 * @param value The value to set for the given key
 */
RoomObject.prototype.setToMemory = function (key, value) {
	this.initMemory();
	this.memory[key] = value;
};


/**
 * A utility method for deleting a value from the structure's memory object. Useful with
 * structures that don't have a memory reference of their own, e.g. towers.
 *
 * @param {String} key The key whose corresponding value should be deleted
 */
RoomObject.prototype.clearFromMemory = function (key) {
	if (_.isObject(this.memory) && _.has(this.memory, key)) {
		delete this.memory[key];
	}
};


/**
 * Initializes the memory for a structure to be manipulated.
 */
RoomObject.prototype.initMemory = function () {
	if (_.isUndefined(this.memory)) {
		if (_.isUndefined(this.room.memory.sources)) {
			this.room.memory.sources = {};
		}
		if (_.isUndefined(this.room.memory.sources[this.id])) {
			this.room.memory.sources[this.id] = {};
		}
		this.memory = this.room.memory.sources[this.id];
	}
};


/**
 * Determines if this room has enough surplus energy to provide assistance to another room with low energy.
 * @returns {boolean} Truthy if this room has surplus energy, Falsey if it does not.
 */
Room.prototype.hasSurplusEnergy = function () {
	if (((this.energyAvailable === this.energyCapacityAvailable && _.filter(Game.creeps, creep => {
		if ((creep.memory.loadout === LOADOUT_HARVEST || creep.memory.loadout === LOADOUT_HAUL || creep.memory.loadout === LOADOUT_GENERIC) && creep.ticksToLive <= CREEP_LIFE_TIME * 10){return creep;}
		}).length < 1)  || this.storage.store[RESOURCE_ENERGY] >= this.storage.storeCapacity * 0.50) && !this.find(FIND_HOSTILE_CREEPS).length > 0 && this.find(FIND_MY_CREEPS).length > 2) {
		this.memory.hasSurplusEnergy = true;
		return true;
	}
	else {
		this.memory.hasSurplusEnergy = false;
		return false;
	}
};


/**
 * Determines if this room requires an influx of energy from another room that has a surplus store of such.
 * @returns {boolean} Truthy if this room has low energy, Falsey if it has plenty.
 */
Room.prototype.hasInsufficientEnergy = function () {
	if (this.storage && this.storage.store[RESOURCE_ENERGY] < this.storage.storeCapacity * 0.10 || _.filter(Game.creeps, creep => {
			if ((creep.memory.loadout === LOADOUT_HARVEST || creep.memory.loadout === LOADOUT_HAUL || creep.memory.loadout === LOADOUT_GENERIC) && creep.ticksToLive <= CREEP_LIFE_TIME * 10){return creep;}
		}).length > 2 || this.find(FIND_HOSTILE_CREEPS).length > 0 || this.find(FIND_MY_CREEPS).length < 2) {
		this.memory.hasInsufficientEnergy = true;
		return true;
	}
	else {
		this.memory.hasInsufficientEnergy = false;
		return false;
	}
};


Room.prototype.needsEmergencyEnergy = function () {
	if (this.storage) {
		return this.energyAvailable < this.energyCapacityAvailable && this.storage.store[RESOURCE_ENERGY] != undefined && (this.hasHostilesPresent()
			|| this.find(FIND_MY_CREEPS, {filter: creep=> creep.memory.loadout === LOADOUT_HARVEST || creep.memory.loadout === LOADOUT_HAUL
			|| creep.memory.loadout === LOADOUT_GENERIC}).length < 2);
	}
	else {
		return false;
	}
	
};


Room.prototype.hasHostilesPresent = function () {
	return this.find(FIND_HOSTILE_CREEPS).length > 0
};