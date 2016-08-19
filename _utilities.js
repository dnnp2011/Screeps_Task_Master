var _ = require('lodash');

function RegisteredRoom(roomName, sourceIds = [], mineralIds = [], hostileIds = [], hostileTowerIds = [], adjacentRooms = [], sourceKeepers = false) {
	this.roomName = roomName;
	this.sourceIds = sourceIds;
	this.mineralIds = mineralIds;
	this.hostileIds = hostileIds;
	this.hostileTowerIds = hostileTowerIds;
	this.adjacentRooms = adjacentRooms;
	this.sourceKeepers = sourceKeepers;
	this.numOfHostiles = hostileIds.length;
	this.numOfHostileTowers = hostileTowerIds.length;
	this.numOfSources = sourceIds.length;
	this.numOfMinerals = mineralIds.length;
}

module.exports = {
	
	addToLog : function (message) {
		var log = Memory.log || [];
		if (_.isString(message)) {
			if (log.length + 1 > 100) {
				log = _.rest(log);
			}
			
			log.push(message);
		}
		else if (_.isArray(message)) {
			if (log.length + message.length > 100) {
				let trim = log.length + message.length - 100;
				log = _.drop(log, trim);
			}
			
			log.concat(message);
		}
		Memory.log = log;
	},
	
	
	addToMovementLog : function (message) {
		var log = Memory.log || [];
		if (_.isString(message)) {
			if (log.length + 1 > 100) {
				log = _.rest(log);
			}
			
			log.push(message);
		}
		else if (_.isArray(message)) {
			if (log.length + message.length > 100) {
				let trim = log.length + message.length - 100;
				log = _.drop(log, trim);
			}
			
			log.concat(message);
		}
		Memory.log = log;
	},
	
	
	findClosestEnergyDropOff : function (position, ignoreStructures = []) {
		if (_.isString(ignoreStructures)) {ignoreStructures = [ignoreStructures];}
		
		let room = Game.rooms[position.roomName];
		if (!room) {
			return null;
		}
		
		let spawnsAndExtensions = room.find(FIND_STRUCTURES, {filter: structure => {
			return structure.isFriendlyOrNeutral() && !_.contains(ignoreStructures, structure.id) && structure.canReceiveEnergy()
		}});
		let storage = room.find(FIND_MY_STRUCTURES, {filter: x => x.structureType === STRUCTURE_STORAGE});
		
		if (!_.isEmpty(spawnsAndExtensions)) {return position.findClosestByRange(spawnsAndExtensions);}
		else if (storage) {return position.findClosestByRange(storage);}
	},
	
	
	getAdjacentRooms : function (room) {
		let adjacentRooms =  _.values(Game.map.describeExits(room));
		let myRooms = [];
		_.forEach(Game.rooms, thisRoom => {
			if (thisRoom.controller && thisRoom.controller.my) {
				myRooms.push(thisRoom);
			}
		});
		
		_.remove(adjacentRooms, (n) => _.contains(myRooms, n));
		
		return adjacentRooms;
	},
	
	
	updateOrCreateNewRoomRegister : function (creep) {
		let registeredRooms = Memory.registeredRooms || {};
		let hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS);
		let hostileTowers = creep.room.find(FIND_HOSTILE_STRUCTURES, {filter: structure => structure.structureType === STRUCTURE_TOWER});
		let sources = creep.room.find(FIND_SOURCES);
		let minerals = creep.room.find(FIND_MINERALS);
		let sourceKeepers = creep.room.find(FIND_STRUCTURES, {filter: structure => structure.structureType === STRUCTURE_KEEPER_LAIR}).length > 0;
		let adjacentRooms = this.getAdjacentRooms(creep.room);
		
		let hostileIds = [];
		let hostileTowerIds = [];
		let sourceIds = [];
		let mineralIds = [];
		
		if (!_.isEmpty(registeredRooms)) {
			if (_.has(registeredRooms, creep.room.name)) {
				_.forEach(hostileCreeps, creep => {
					if (creep.getActiveBodyParts(ATTACK).length > 0 || creep.getActiveBodyParts(RANGED_ATTACK).length > 0 || creep.getActiveBodyParts(HEAL).length > 0) {
						hostileIds.push(creep.id);
					}
				});
				_.forEach(hostileTowers, tower => {hostileTowerIds.push(tower.id);});
				!_.isEmpty(hostileTowerIds) ? Memory.registeredRooms[creep.room.name].hostileTowerIds = hostileTowerIds : Memory.registeredRooms[creep.room.name].hostileTowerIds = null;
				!_.isEmpty(hostileIds) ? Memory.registeredRooms[creep.room.name].hostileIds = hostileIds : Memory.registeredRooms[creep.room.name].hostileIds = null;
				return;
			}
		}
		
		_.forEach(hostileCreeps, creep => {
			if (creep.getActiveBodyParts(ATTACK).length > 0 || creep.getActiveBodyParts(RANGED_ATTACK).length > 0 || creep.getActiveBodyParts(HEAL).length > 0) {
				hostileIds.push(creep.id);
			}
		});
		_.forEach(hostileTowers, tower => {hostileTowerIds.push(tower.id);});
		_.forEach(sources, source => {sourceIds.push(source.id);});
		_.forEach(minerals, mineral => {mineralIds.push(mineral.id);});
		
		registeredRooms[creep.room.name] = new RegisteredRoom(creep.room.name, sourceIds, mineralIds, hostileIds, hostileTowerIds, adjacentRooms, sourceKeepers);
		Memory.registeredRooms = registeredRooms;
	},
	
	
	setPathTo : function (creep, target, distance) {
		if (Memory.pathCache && Memory.pathCache.length > 500) {this.addToLog(`Wiping ${Memory.pathCache.length} items from Memory.pathCache`); delete Memory.pathCache;}
		if (!Memory.pathCache) {Memory.pathCache = {};}
		
		let path, uses, temp = this.getPathKey(creep.pos, target.pos);
		
		if (Memory.pathCache[temp] !== undefined) {
			path = Memory.pathCache[temp].path;
			uses = Memory.pathCache[temp].uses || 0;
		}
		
		else {
			path = creep.pos.findPathTo(target);
			uses = 0;
			this.addToMovementLog(`${creep.name}: of type ${creep.memory.loadout} generating path to ${temp}`);
		}
		
		if (path) {
			Memory.pathCache[temp] = {path: path, uses: ++uses};
			this.addToMovementLog(`${creep.name}: of type ${creep.memory.loadout} using path ${temp} ${uses} times`);
			
			if (uses > 40) {
				let before = _.size(Memory.pathCache);
				delete Memory.pathCache[temp];
				for (let key in Memory.pathCache) {
					if (Memory.pathCache[key].uses < 3 || Memory.pathCache[key].uses >= 40) {delete Memory.pathCache[key];}
				}
				let after = _.size(Memory.pathCache);
				this.addToLog(`${before - after} paths cleaned from pathCache`);
			}
		}
		
		creep.memory.path = path;
		creep.memory.path_target_id = target.id;
		//creep.memory.path_fails = 0;
		let lastStep = creep.memory.path.length - 1;
		if (creep.memory.path && creep.memory.path[lastStep] && target.pos.isEqualTo(creep.memory.path[lastStep].x, creep.memory.path[lastStep].y)) {
			return creep.memory.path;
		}
		else {
			creep.memory.path_fails += 1 || 1;
		}
		return null;
	},
	
	
	getPathKey: function (from, to) {
		//console.log("getPathKey= "+getPosKey(from) + '$' + getPosKey(to));
		return this.getPosKey(from) + '|' + this.getPosKey(to);
	},
	
	getPosKey: function(pos) {
		return pos.x + '_' + pos.y + '_' + pos.roomName;
	},
	
};