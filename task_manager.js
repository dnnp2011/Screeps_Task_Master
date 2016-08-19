
var _ = require('lodash');
var utils = require('_utilities');
require('_prototypes');


function Task(type, roomName, targetId, loadout, priority) {
	this.type = type;
	this.roomName = roomName;
	this.targetId = targetId;
	this.loadout = loadout;
	this.priority = priority;
	this.maxAssignees = TASK_MAX_CREEPS[type];
	this.assignees = [];
}


module.exports = {
	
	getTaskForLoadout : function (assignee, loadout) {
		let room = assignee.room;
		let roomMemory = Memory.rooms[room.name] || {};
		let allTasks = roomMemory.tasks;
		let tasks = _.filter(allTasks, task => {if (task.loadout === loadout){return task}});
		
		if (!_.isEmpty(tasks)) {
			let lowestPrio = 999, tasksWithLowestPrio = [];
			
			_.forEach(tasks, task => {
				if (this.isTaskValid(task) && (!_.isNumber(task.maxAssignees) || task.assignees.length < task.maxAssignees)) {
					if (task.priority < lowestPrio) {
						lowestPrio = task.priority;
						tasksWithLowestPrio = [task];
					}
					else if (task.priority === lowestPrio) {
						tasksWithLowestPrio.push(task);
					}
				}
			});
			
			let closestTask;
			let rangeToClosestTask = 50;
			
			_.forEach(tasksWithLowestPrio, task => {
				let target = Game.getObjectById(task.targetId);
				if (task.roomName === assignee.room.name) {
					let range = assignee.pos.getRangeTo(target) || 50;
					if (_.isUndefined(closestTask) || range < rangeToClosestTask) {
						closestTask = task;
						rangeToClosestTask = range;
					}
				}
				else {
					let range = assignee.pos.getRangeTo(assignee.room.findExitTo(task.roomName));
					if (range < rangeToClosestTask) {
						closestTask = task;
						rangeToClosestTask = range;
					}
				}
			});
			
			if (closestTask) {
				closestTask.assignees.push(assignee.id);
				assignee.memory.task = closestTask;
				if (closestTask.type === TASK_HARVEST  || closestTask.type === TASK_HARVEST_REMOTE_ENERGY) {
					let source = Game.getObjectById(closestTask.targetId);
					assignee.memory.sourceId = source.id;
					source.setToMemory('minerId', assignee.id);
				}
				else if (closestTask.type === TASK_HARVEST_MINERAL || closestTask.type === TASK_HARVEST_REMOTE_MINERAL) {
					let mineral = Game.getObjectById(closestTask.targetId);
					assignee.memory.mineralId = mineral.id;
					mineral.setToMemory('minerId', assignee.id);
				}
				else if (closestTask.type === TASK_HAUL_FROM && Game.getObjectById(closestTask.targetId) instanceof Creep && Game.getObjectById(closestTask.targetId).memory.loadout === LOADOUT_HARVEST) {
					let miner = Game.getObjectById(closestTask.targetId);
					miner.memory.haulerId = assignee.id;
				}
				return closestTask;
			}
			
		}
		return null;
	},
	
	
	generateTasksForRoom : function (roomName) {
		var room = Game.rooms[roomName];
		var roomMemory = Memory.rooms[roomName] || {};
		
		
		if (_.isUndefined(roomMemory.tasksUpdated)) {
			roomMemory.tasksUpdated = 0;
		}
		
		//Move update timer up to getTasks function
		if ((roomMemory.tasksUpdated < Game.time && (roomMemory.tasksUpdated === 0 || Game.time % TASK_UPDATE_INTERVAL === 0)) || room.find(FIND_HOSTILE_CREEPS).length > 0) { //ToDo: If tasks haven't updated this tick, and if this is the first update OR if Game.time is divisible by 5
			let oldTasks = roomMemory.tasks || {};
			let tasks = {};
			
			//ToDo: Find HARVEST tasks
				//ToDo: Find energy sources available
			let roomSources = room.find(FIND_SOURCES);
			let removals = [];
			_.forEach(roomSources, source => {
				if (_.isString(source.getFromMemory('minerId'))) {
					if (_.isObject(Game.getObjectById(source.getFromMemory('minerId')))) {
						removals.push(source);
					}
					else {
						source.clearFromMemory('minerId');
					}
				}
			});
			_.remove(roomSources, source => _.contains(removals, source));
			_.forEach(roomSources, source => {
				tasks[source.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HARVEST, roomName, source.id, LOADOUT_HARVEST, PRIO_HOME_ENERGY_SOURCE);
			});
				//ToDo: Find mineral sources available
			//Set up mineral harvesting when needed
			let roomExtractors = room.find(FIND_MINERALS, {filter: function(source){
				let rangeToExtractor = source.pos.getRangeTo(_.first(room.find(FIND_STRUCTURES, {filter: structure => structure.structureType === STRUCTURE_EXTRACTOR})));
				if (rangeToExtractor === 0) {return source;}
			}});
			if (!_.isEmpty(roomExtractors)) {
				let removals = [];
				_.forEach(roomExtractors, mineral => {
					if (_.isString(mineral.getFromMemory('minerId'))) {
						if (_.isObject(Game.getObjectById(mineral.getFromMemory('minerId')))) {
							removals.push(mineral);
						}
						else {
							mineral.clearFromMemory('minerId');
						}
					}
				});
				_.remove(roomExtractors, source => _.contains(removals, source));
				if (!_.isEmpty(roomExtractors)) {
					_.forEach(roomExtractors, source => {
						tasks[source.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HARVEST_MINERAL, roomName, source.id, LOADOUT_HARVEST, PRIO_HOME_MINERAL_SOURCE);
					});
				}
			}
				//ToDo: Find remote mining sources available
			let linkedRooms = utils.getAdjacentRooms(roomName);
			let registeredRooms = Memory.registeredRooms || {};
			let flagNum = roomMemory.flagNum || 0;
			_.forEach(linkedRooms, thisRoom => {
				if (!_.contains(_.keys(registeredRooms), thisRoom) && _.filter(Game.flags, flag => {if ((flag.name.startsWith('scout') || Game.flags[flag].memory.scoutingNeeded) && flag.room.name === thisRoom){return thisRoom}}).length === 0) {
					let middle = new RoomPosition(25, 25, thisRoom);
					let newFlag = Game.rooms[thisRoom].createFlag(middle, ('scout' + scoutFlagNum++), COLOR_YELLOW);
					Game.flags[newFlag].memory.scoutingNeeded = true;
				}
				else {
					//ToDo: Add support for remote mineral mining in the future
					let roomRegistry = registeredRooms[thisRoom];
					if (roomRegistry.numOfSources !== 0 && !roomRegistry.numOfHostiles > 0) {
						let sourceIds = roomRegistry.sourceIds;
						_.forEach(sourceIds, id => {
							let source = Game.getObjectById(id);
							if (!source.getFromMemory('minerId') || !_.isObject(Game.getObjectById(source.getFromMemory('minerId')))) {
								if (source.getFromMemory('minerId')) {source.clearFromMemory('minerId');}
								tasks[source.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HARVEST_REMOTE_ENERGY, source.room.name, source.id, LOADOUT_HARVEST, PRIO_ADJACENT_ENERGY_SOURCE);
							}
						});
					}
					if (roomRegistry.numOfMinerals !== 0 && !roomRegistry.numOfHostiles > 0) {
						let mineralIds = roomRegistry.mineralIds;
						_.forEach(mineralIds, id => {
							let mineral = Game.getObjectById(id);
							if (!mineral.getFromMemory('minerId') || !_.isObject(Game.getObjectById(mineral.getFromMemory('minerId')))) {
								if (mineral.getFromMemory('minerId')) {mineral.clearFromMemory('minerId')}
								tasks[mineral.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HARVEST_REMOTE_MINERAL, mineral.room.name, mineral.id, LOADOUT_HARVEST, PRIO_ADJACENT_MINERAL_SOURCE);
							}
						});
					}
				}
			});
			roomMemory.flagNum = flagNum;
			
			
			//ToDo: Find HAUL tasks
				//ToDo: Find energy miner hauling tasks
			let miners = room.find(FIND_MY_CREEPS, {filter: creep => creep.memory.loadout === LOADOUT_HARVEST});
			_.forEach(miners, miner => {
				if (miner.memory.taskType === TASK_HARVEST) {
					if (miner.memory.sourceId && _.isObject(Game.getObjectById(miner.memory.sourceId))) {
						if (!miner.memory.haulerId) {
							tasks[miner.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HAUL_FROM, roomName, miner.id, LOADOUT_HARVEST, PRIO_HAUL_ENERGY_MINER)
						}
					}
				}
					//ToDo: Find mineral miner hauling tasks
				else if (miner.memory.taskType === TASK_HARVEST_MINERAL) {
					if (miner.memory.mineralId && _.isObject(Game.getObjectById(miner.memory.mineralId))) {
						if (!miner.memory.haulerId) {
							tasks[miner.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HAUL_FROM, roomName, miner.id, LOADOUT_HARVEST, PRIO_HAUL_MINERAL_MINER)
						}
					}
				}
					//ToDo: Find remote miner hauling tasks
				else if (miner.memory.taskType === TASK_HARVEST_REMOTE_ENERGY) {
					if (miner.memory.sourceId && _.isObject(Game.getObjectById(miner.memory.sourceId))) {
						if (!miner.memory.haulerId) {
							tasks[miner.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HAUL_FROM, roomName, miner.id, LOADOUT_HARVEST, PRIO_HAUL_REMOTE_MINER)
						}
					}
				}
					//ToDo: Find remote mineral miner hauling tasks
				else if (miner.memory.taskType === TASK_HARVEST_REMOTE_MINERAL) {
					if (miner.memory.mineralId && _.isObject(Game.getObjectById(miner.memory.mineralId))) {
						if (!miner.memory.haulerId) {
							tasks[miner.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HAUL_FROM, roomName, miner.id, LOADOUT_HARVEST, PRIO_HAUL_REMOTE_MINERAL)
						}
					}
				}});
				//ToDo: Find storage to spawns and extensions hauling
			if (room.needsEmergencyEnergy()) {
				let spawnsAndExtensions = room.find(FIND_MY_STRUCTURES, {filter: structure => structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION});
				_.forEach(spawnsAndExtensions, n => {
					if (n.energy < n.energyCapacity) {
						tasks[n.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HAUL_TO, roomName, n.id, LOADOUT_HAUL, PRIO_HAUL_STORAGE_TO_SPAWN_EXTENSIONS);
					}
				});
			}
				//ToDo: Find storage to tower hauling
			let towers = room.find(FIND_MY_STRUCTURES, structure => structure.structureType === STRUCTURE_TOWER);
			_.forEach(towers, tower => {
				if (tower.energy < tower.energyCapacity) {
					let priority = tower.energy / tower.energyCapacity + PRIO_HAUL_STORAGE_TO_TOWER;
					tasks[tower.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HAUL_TO, roomName, tower.id, LOADOUT_HAUL, priority);
				}
			});
			
			//ToDo: Find GENERIC tasks
				//ToDo: Find build tasks
			_.forEach(Game.constructionSites, site => {
				if (site.pos.roomName === roomName) {
					let priority = 1 - site.progress / site.progressTotal + TASK_PRIO_BUILD;
					
					tasks[site.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_BUILD, roomName, site.id, LOADOUT_GENERIC, priority);
				}
				else if (site.pos.roomName !== roomName && site.structureType === STRUCTURE_SPAWN) {
					tasks[site.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_BUILD, site.pos.roomName, site.id, LOADOUT_GENERIC, TASK_PRIO_BUILD_ADJACENT_SPAWN);
				}
			});
				//ToDo: Find tower repair tasks
			let towersNeedingRepair = room.find(FIND_MY_STRUCTURES, {filter: structure => structure.structureType === STRUCTURE_TOWER
																					&& structure.hits < structure.getStructureHits() * 0.9});
			_.forEach(towersNeedingRepair, tower => {
				let priority = tower.hits / tower.getStructureHits() + PRIO_TOWER_REPAIR;
				tasks[tower.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_REPAIR, tower.pos.roomName, tower.id, LOADOUT_GENERIC, priority);
			});
				//ToDo: Find structure repair tasks
			let structuresNeedingRepair = room.find(FIND_STRUCTURES, {filter: structure => structure.structureType !== STRUCTURE_WALL
										&& structure.structureType !== STRUCTURE_RAMPART && structure.structureType !== STRUCTURE_TOWER
																					&& structure.hits < structure.getStructureHits() * 0.9});
			
			_.forEach(structuresNeedingRepair, structure => {
				let priority = structure.hits / structure.getStructureHits() + PRIO_STRUCTURE_REPAIR;
				tasks[structure.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_REPAIR, structure.pos.roomName, structure.id, LOADOUT_GENERIC, priority);
			});
				//ToDo: Find rampart repair tasks
			let rampartsNeedingRepair = room.find(FIND_MY_STRUCTURES, {filter: structure => structure.structureType === STRUCTURE_RAMPART
																					&& structure.hits < structure.getStructureHits()});
			
			_.forEach(rampartsNeedingRepair, rampart => {
				let priority = rampart.hits / rampart.getStructureHits() + PRIO_RAMPART_REPAIR;
				tasks[rampart.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_REPAIR, rampart.pos.roomName, rampart.id, LOADOUT_GENERIC, priority);
			});
				//ToDo: Find wall repair tasks
			let wallsNeedingRepair = room.find(FIND_STRUCTURES, {filter: structure => structure.structureType === STRUCTURE_WALL
																					&& structure.hits < structure.getStructureHits()});
			
			_.forEach(wallsNeedingRepair, wall => {
				let priority = wall.hits / wall.getStructureHits() + PRIO_WALL_REPAIR;
				tasks[wall.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_REPAIR, wall.pos.roomName, wall.id, LOADOUT_GENERIC, priority);
			});
				//ToDo: Find upgrade tasks
			if (room.controller && room.controller.my) {
				let controller = room.controller;
				if (controller.level < 8) {
					tasks[controller.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_UPGRADE_CONTROLLER, controller.room.name, controller.id, LOADOUT_GENERIC, PRIO_UPGRADE_CONTROLLER + 0.1 );
				}
				else {
					let ticksRemaining = controller.ticksToDowngrade / CONTROLLER_DOWNGRADE[controller.level];
					let priority = ticksRemaining * 2 + PRIO_UPGRADE_CONTROLLER;
					tasks[controller.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_UPGRADE_CONTROLLER, controller.room.name, controller.id, LOADOUT_GENERIC, priority);
				}
			}
			
			//ToDo: Find CONTROLLER_* tasks
				//ToDo: Find terminal to terminal tasks
				if (_.isObject(room.terminal)) {
					let terminal = room.terminal;
					if (terminal.getFromMemory('storageState') && terminal.getFromMemory('storageState') === 'fill') {
						tasks[terminal.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HAUL_TO, roomName, terminal.id, LOADOUT_HAUL, PRIO_HAUL_STORAGE_TO_TERMINAL);
						if (terminal.store[RESOURCE_ENERGY] === terminal.storeCapacity) {
							terminal.setToMemory('storageState', 'standBy');
						}
					}
					else if (terminal.getFromMemory('storageState') && terminal.getFromMemory('storageState') === 'empty') {
						let priority = (1 - terminal.store[RESOURCE_ENERGY] / terminal.storeCapacity) + PRIO_HAUL_TERMINAL_TO_STORAGE;
						tasks[terminal.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HAUL_FROM, roomName, terminal.id, LOADOUT_HAUL, priority);
						if (terminal.store[RESOURCE_ENERGY] === undefined) {
							terminal.setToMemory('storageState', 'idle');
						}
					}
					else if (terminal.getFromMemory('storageState') && terminal.getFromMemory('storageState') === 'standBy') {
						if (terminal.store[RESOURCE_ENERGY] === terminal.storeCapacity) {
							let targetRoom = this.findRoomWithInsufficientEnergy(room.name);
							if (_.isObject(targetRoom)) {
								utils.addToLog(`Terminal ${terminal} in room ${roomName} succeeded in sending (${terminal.store[RESOURCE_ENERGY]}) surplus energy to room ${targetRoom.name}`);
								terminal.send(RESOURCE_ENERGY, terminal.store[RESOURCE_ENERGY], targetRoom.name, 'Sending surplus energy');
								if (terminal.store[RESOURCE_ENERGY] !== terminal.storeCapacity) {
									terminal.setToMemory('storageState', 'idle');
									roomMemory.terminalTransferFailed = false;
								}
							}
							else {
								if (!roomMemory.terminalTransferFailed) {
									utils.addToLog(`Terminal ${terminal} in room ${roomName} failed to find a target to transfer (${terminal.store[RESOURCE_ENERGY]}) surplus energy`);
									roomMemory.terminalTransferFailed = true;
								}
							}
						}
					}
					else if (terminal.getFromMemory('storageState') && terminal.getFromMemory('storageState') === 'idle') {
						if (terminal.store[RESOURCE_ENERGY] > 0) {
							terminal.setToMemory('storageState', 'empty');
						}
						
						if (room.hasSurplusEnergy()) {
							terminal.setToMemory('storageState', 'fill');
						}
					}
					else {
						terminal.setToMemory('storageState', 'idle');
					}
				}
				
				//ToDo: Find link to link tasks
			let roomLinks = room.find(FIND_MY_STRUCTURES, {filter: link => link.structureType === STRUCTURE_LINK});
			if (!_.isEmpty(roomLinks)) {
				_.forEach(roomLinks, link => {
					if (link.getFromMemory('linkType') && link.getFromMemory('lastTransferTime')) {
						if (link.getFromMemory('linkType') === 'linkTo') {
							if (link.energy > 0) {
								let priority = (1 - link.energy / link.energyCapacity) + PRIO_HAUL_LINK_TO_STORAGE;
								tasks[link.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HAUL_FROM, roomName, link.id, LOADOUT_HAUL, priority);
							}
						}
						else if (link.getFromMemory('linkType') === 'linkFrom') {
							if (link.energy / link.energyCapacity >= LINK_TRANSFER_THRESHOLD ||
								(link.getFromMemory('lastTransferTime') - Game.time >= LINK_TICK_THRESHOLD && link.energy > 0) && link.cooldown === 0) {
								let linkTransferTarget = this.findLinkTransferTarget();
								if (_.isObject(linkTransferTarget)) {
									link.transferEnergy(linkTransferTarget, link.energy);
								}
							}
						}
					}
					else {
						if (link.pos.isNearTo(link.room.storage)) {
							link.setToMemory('linkType', 'linkTo');
							link.setToMemory('lastTransferTime', Game.time);
						}
						else {
							link.setToMemory('linkType', 'linkFrom');
							link.setToMemory('lastTransferTime', Game.time);
						}
					}
				});
			}
			
			
				//ToDo: Find renewal tasks
			//Deferred
			/*_.forEach(Game.creeps, creep => {
				_.forEach(room.spawns, spawn => {
					if (creep.pos.isNearTo(spawn.pos.x, spawn.pos.y) && creep.ticksToLive < CREEP_LIFE_TIME * 0.2) {
						let priority = creep.ticksToLive / CREEP_LIFE_TIME + PRIO_RENEW_CREEP;
						tasks[creep.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_RENEW, roomName, creep.id, LOADOUT_SPAWN, priority);
					}
				});
			});*/
			
				//ToDo: Find spawn tasks
			//Deferred to spawn controller
			
			//ToDo: Find ATTACK tasks
				//ToDo: Find hostiles in this room to attack
			let hostiles = room.find(FIND_HOSTILE_CREEPS);
			let hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
			let hostileConSites = room.find(FIND_HOSTILE_CONSTRUCTION_SITES);
			let hostileSpawns = room.find(FIND_HOSTILE_SPAWNS);
			//Find hostile creeps first, target healers? or attackers?
			//Stay X distance from towers if existing until hostile creep attackers are dead
			//Then attack towers, then spawn, then other creeps, then other structures, then construction sites
			//Stay within 4 tiles of each other? (formations)
			//Need to incorporate destroying path blocking objects like ramparts or walls.
			if (!_.isEmpty(hostileStructures)) {
				_.forEach(hostileStructures, structure => {
					if (structure.structureType === STRUCTURE_TOWER) {
						let priority = structure.energy < TOWER_ENERGY_COST ? PRIO_ATTACK_TOWER + 0.4 : PRIO_ATTACK_TOWER;
						tasks[structure.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_ATTACK, roomName, structure.id, LOADOUT_ATTACK, priority);
					}
					else if (structure.structureType === STRUCTURE_SPAWN) {
						//Do nothing
					}
					else {
						tasks[structure.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_ATTACK, roomName, structure.id, LOADOUT_ATTACK, PRIO_ATTACK_GENERIC_CREEP);
					}
				});
			}
			if (!_.isEmpty(hostiles)) {
				_.forEach(hostiles, creep => {
					if (creep.getActiveBodyParts(ATTACK).length > 0) {tasks[creep.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_ATTACK, roomName, creep.id, LOADOUT_ATTACK, PRIO_ATTACK_MELEE_CREEP);}
					else if (creep.getActiveBodyParts(RANGED_ATTACK).length > 0) {tasks[creep.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_ATTACK, roomName, creep.id, LOADOUT_ATTACK, PRIO_ATTACK_RANGED_CREEP);}
					else if (creep.getActiveBodyParts(HEAL).length > 0) {tasks[creep.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_ATTACK, roomName, creep.id, LOADOUT_ATTACK, PRIO_ATTACK_HEAL_CREEP);}
					else {tasks[creep.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_ATTACK, roomName, creep.id, LOADOUT_ATTACK, PRIO_ATTACK_GENERIC_CREEP);}
				});

			}
			if (!_.isEmpty(hostileSpawns)) {
				_.forEach(hostileSpawns, spawn => {
					tasks[spawn.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_ATTACK, roomName, spawn.id, LOADOUT_ATTACK, PRIO_ATTACK_SPAWN);
				});
			}
			if (!_.isEmpty(hostileConSites)) {
				_.forEach(hostileConSites, site => {
					tasks[site.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_ATTACK, roomName, site.id, LOADOUT_ATTACK, PRIO_ATTACK_CONSTRUCTION_SITES);
				});
			}
				//ToDo: Find hostiles in adjacent rooms to attack
			//Defer this task to creep specific actions. If there is occupy flag, move to room. Then hostile task runs again.
				//ToDo: Find occupation flags to invade
			//Deferred
			
			//ToDo: Find HEAL tasks
				//ToDo: Find friendlies to heal in this room
			let friendlyHeals = room.find(FIND_MY_CREEPS, {filter: creep => creep.hits < creep.hitsMax});
			_.forEach(friendlyHeals, creep => {
				let priority = creep.hits / creep.hitsMax + PRIO_HEAL_CREEP;
				tasks[creep.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_HEAL, roomName, creep.id, LOADOUT_HEAL, priority);
			});
				//ToDo: Find friendlies to heal in adjacent rooms
			//Deferred
				//ToDo: Find friendlies invading an occupation room to heal/follow
			//Deferred
			
			//ToDo: Find CLAIM tasks
				//ToDo: Find claim flags in adjacent rooms to claim controllers of
			//Claim TASKS are KEYed by the room name of the target room.
			let claimFlags = _.filter(Game.flags, flag => {
				return (flag.memory.claim || flag.name === 'claim') && !Game.getObjectById(flag.memory.claimerID);
			});
			if (!_.isEmpty(claimFlags)) {
				_.forEach(claimFlags, claimFlag => {
					tasks[claimFlag.room.controller.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_CLAIM, claimFlag.pos.roomName, claimFlag.room.controller.id, LOADOUT_CLAIM, PRIO_CLAIM_ROOM);
				});
			}
			
			//ToDo: Find SCOUT tasks
				//ToDo: Find scout flags in rooms that need scouting
				//ToDo: Find occupy flags in rooms that need scouting??
			//Create scout tasks to scout adjacent rooms that dont have register in memory
			//Scout them and then create register of energy sources, mineral sources, hostiles, source keepers, and exits.
			registeredRooms = _.keys(Memory.registeredRooms) || [];
			flagNum = roomMemory.scoutFlagNum || 0;
			linkedRooms = utils.getAdjacentRooms(roomName);
			//If there are no registered rooms, create scout flags in adjacent rooms and set scout in memory.
			//Or if not all linked rooms are registered, create a scout flags in those that have not been registered.
			_.forEach(linkedRooms, thisRoom => {
				if (!_.contains(registeredRooms, thisRoom) && _.filter(Game.flags, flag => {if ((flag.name.startsWith('scout') || Game.flags[flag].memory.scoutingNeeded) && flag.room.name === thisRoom){return thisRoom}}).length === 0) {
					let middle = new RoomPosition(25, 25, thisRoom);
					let newFlag = Game.rooms[thisRoom].createFlag(middle, ('scout' + flagNum++), COLOR_YELLOW);
					Game.flags[newFlag].memory.scoutingNeeded = true;
				}
			});
			
			//Then FIND all scout flags and create a TASK_SCOUT object for it.
			//Scout TASKS are KEYed by the name of the scout flag in the target room.
			let scoutingFlags = _.filter(Game.flags, flag => {
				return flag.memory.scoutingNeeded && !Game.getObjectById(flag.memory.scoutId);
			});
			//ToDo: May need to change target IDs of flags if they do not have IDs
			_.forEach(scoutingFlags, scoutFlag => {
				tasks[scoutFlag.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_SCOUT, scoutFlag.pos.roomName, scoutFlag.id, LOADOUT_SCOUT, PRIO_SCOUT_ADJACENT_ROOM);
			});
			roomMemory.tasks = tasks;
			roomMemory.tasksUpdated = Game.time;
			Memory.rooms[roomName] = roomMemory;
			roomMemory.scoutFlagNum = flagNum;
		}
		
	},
	
	/**
	 * Determines if a task is still considered valid.
	 * @param task {Task} The specific task to be checked for validity.
	 * @returns {boolean} Returns true if the task is still valid, false if it is not valid.
	 */
	isTaskValid : function (task) {
		if (_.isEmpty(task)) {return false;}
		
		if (task.type === TASK_SCOUT && (!_.contains(_.keys(Game.rooms), task.roomName) || Game.getObjectById(task.assignees[0]).room.name === task.roomName || Game.getObjectById(task.targetId) instanceof Flag)) {return true;}
		
		if (task.type === TASK_CLAIM && (!_.contains(_.keys(Game.rooms), task.roomName) || Game.getObjectById(task.targetId) instanceof StructureController)) {return true;}
		
		let target = Game.getObjectById(task.targetId);
		if (target === null) {return false;}
		
		if (task.type === TASK_BUILD && target instanceof ConstructionSite) {return true;}
		
		if (task.type === TASK_REPAIR && target instanceof Structure) {return true;}
		
		if (task.type === TASK_UPGRADE_CONTROLLER && target instanceof StructureController) {return true;}
		
		if (task.type === TASK_HARVEST && (target instanceof Source || target instanceof StructureExtractor || target instanceof Mineral)) {return true;}
		
		if ((task.type === TASK_HAUL_FROM || task.type === TASK_HAUL_TO) && (target instanceof Resource || target instanceof StructureStorage || target instanceof StructureContainer
			|| target instanceof StructureLink || target instanceof StructureTerminal || target instanceof Creep || target instanceof StructureTower || target instanceof Structure)) {return true;}
			
		if (task.type === TASK_LINK_TRANSFER && target instanceof StructureLink) {return true;}
		
		if (task.type === TASK_TERMINAL_TRANSFER && target instanceof StructureTerminal) {return true;}
		
		if (task.type === TASK_RENEW && target instanceof Creep) {return true;}
		
		if (task.type === TASK_ATTACK && (target instanceof Creep || target instanceof Structure || target instanceof ConstructionSite || target instanceof Spawn)) {return true;}
		
		if (task.type === TASK_HEAL && target instanceof Creep) {return true;}
	},

	
	/**
	 * Check if this task already exists in the room's Task Memory.
	 * @param oldTasks {Array} An array of previously generated Task objects.
	 * @param taskType {String} One of the TASK_* constants denoting the type of task to be performed.
	 * @param roomName {String} The name of the room this task is to be performed in.
	 * @param targetId {String} The serial ID of the intended target of this task.
	 * @param loadout {String} One of the LOADOUT_* constants denoting what creep loadout is required to perform this task.
	 * @param priority {Number} A floating point value denoting the priority level of this task.
	 * @returns {Task} Returns a Task object representing all the attributes of this task.
	 */
	updateOldTaskOrCreateNew : function (oldTasks, taskType, roomName, targetId, loadout, priority) {
		if (_.has(oldTasks, targetId)) {
			let task = oldTasks[targetId];
			task.priority = priority;
			_.remove(task.assignees, id=>_.isEmpty(Game.getObjectById(id)));
			return task;
		}
		else {
			return new Task(taskType, roomName, targetId, loadout, priority)
		}
	},
	
	
	findRoomWithInsufficientEnergy : function (thisRoom) {
		let targetRooms = [];
		_.forEach(Game.rooms, room => {
			if (_.isObject(room.controller) && room.controller.my && _.isObject(room.terminal) && room.name !== thisRoom.name) {
				if (room.hasInsufficientEnergy()) {
					targetRooms.push(room);
				}
			}
		});
		
		if (!_.isEmpty(targetRooms)) {
			if (targetRooms.length > 1) {
				return this.findRoomWithGreatestEnergyDeficit(targetRooms);
			}
			else {
				return _.first(targetRooms);
			}
		}
		else {
			return null;
		}
	},
	
	
	findRoomWithGreatestEnergyDeficit : function (rooms) {
		var lowestStoreRatio = 1;
		var lowestRoom;
		_.forEach(rooms, room => {
			if (room.storage.store[RESOURCE_ENERGY] / room.storage.storeCapacity < lowestStoreRatio) {
				lowestRoom = room;
				lowestStoreRatio = room.storage.store[RESOURCE_ENERGY] / room.storage.storeCapacity;
			}
			else if (room.storage.store[RESOURCE_ENERGY] / room.storage.storeCapacity === lowestStoreRatio){
				lowestRoom = room;
				lowestStoreRatio = room.storage.store[RESOURCE_ENERGY] / room.storage.storeCapacity;
			}
		});
		return _.isObject(lowestRoom) ? lowestRoom : null;
	},
	
	
	findLinkTransferTarget : function (link) {
		var transferTarget = Game.getObjectById(link.getFromMemory('transferTargetId'));
		if (_.isObject(transferTarget) && transferTarget.energyCapacity - transferTarget.energy >= link.energy) {
			return transferTarget;
		}
		else {
			link.clearFromMemory('transferTargetId');
		}
		
		var toLink = _.first(link.room.find(FIND_MY_STRUCTURES, {filter: structure =>
		structure.structureType === STRUCTURE_LINK && structure.getFromMemory('linkType') === 'linkTo'
		}));
		if (_.isObject(toLink)) {
			link.setToMemory('transferTargetId', toLink.id);
			return toLink;
		}
		else {
			utils.addToLog(`Failed to find a target for (${link.energy}) energy from ${link}`);
			return null;
		}
	}
	
};