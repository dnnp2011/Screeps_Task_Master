var _ = require('lodash');
var utils = require('_utilities');
require('_prototypes');
var taskManager = require('task_manager');

module.exports = {
	
	run: function (miner) {
		
			if (!miner.spawning) {
				let task = miner.memory.task ? miner.memory.task : taskManager.getTaskForLoadout(miner, miner.memory.loadout);
				if (task && (task.type === TASK_HARVEST || task.type === TASK_HARVEST_REMOTE_ENERGY || task.type === TASK_HARVEST_MINERAL || task.type === TASK_HARVEST_REMOTE_MINERAL)) {
					if (_.sum(miner.carry) >= 50) {
						if (miner.carry.resourceType === RESOURCE_ENERGY) {
							miner.transferResourcesToAdjacentCreep(RESOURCE_ENERGY,
								(miner.room.hasSurplusEnergy() ? [LOADOUT_GENERIC, LOADOUT_HAUL] : LOADOUT_HAUL));
						}
						else {
							miner.transferResourcesToAdjacentCreep(miner.carry.resourceType, LOADOUT_HAUL);
						}
					}
					
					if (_.sum(miner.carry) === miner.carryCapacity) {
						if (!miner.memory.haulerId) {
							miner.memory.inDeliveryMode = true;
						}
						else {
							miner.drop(miner.carry.resourceType);
						}
					}
					else if (_.sum(miner.carry) === 0 || _.sum(miner.carry) === undefined) {
						miner.memory.inDeliveryMode = false;
						miner.memory.dropOffId = null;
					}
					
					if (miner.memory.inDeliveryMode) {
						if (miner.room.name === miner.memory.homeRoom) {
							miner.deliverEnergy();
						}
						else {
							miner.moveTo(miner.pos.findClosestByRange(miner.room.findExitTo(miner.memory.homeRoom)));
						}
					}
					else {
						if (miner.room.name === task.roomName) {
							this.performTask(miner, miner.memory.task);
						}
						else {
							miner.moveTo(miner.pos.findClosestByRange(miner.room.findExitTo(task.roomName)));
						}
					}
				}
			}
	},
	
	
	performTask : function (miner, task) {
		let mySource;
		if (task.type === TASK_HARVEST || task.type === TASK_HARVEST_REMOTE_ENERGY) {
			mySource = Game.getObjectById(miner.memory.sourceId);
		}
		else {
			mySource = Game.getObjectById(miner.memory.mineralId);
		}
		
		if (mySource) {
			this.findMinerDropContainers(miner); //ToDo: Make this more efficient by not calling it for every creep, every tick
			let minerDropContainerIds = miner.room.memory.minerDropContainerIds;
			let myDropContainer;
			_.forEach(minerDropContainerIds, containerId => {
				let container = Game.getObjectById(containerId);
				if (container.pos.isNearTo(mySource)) {
					myDropContainer = container;
				}
			});
			if (myDropContainer && !miner.pos.isEqualTo(myDropContainer)) {
				miner.moveTo(myDropContainer);
			}
			else if (myDropContainer && !miner.pos.isEqualTo(myDropContainer) && miner.pos.isNearTo(mySource)) {
				miner.moveTo(myDropContainer);
			}
			else if (!myDropContainer && !miner.pos.isNearTo(mySource)) {
				miner.moveTo(mySource);
			}
			else {
				if (!myDropContainer && miner.room.find(FIND_STRUCTURES, {filter: structure => structure.structureType===STRUCTURE_CONTAINER}).length < 5) {
					miner.room.createConstructionSite(miner.pos, STRUCTURE_CONTAINER);
				}
				miner.harvest(mySource);
			}
		}
	},
	
	
	
	findMinerDropContainers : function (miner) {
		let allContainers = miner.room.find(FIND_STRUCTURES, {filter: structure => {
			return structure.structureType === STRUCTURE_CONTAINER;
		}});
		let allContainerSites = miner.room.find(FIND_CONSTRUCTION_SITES, {filter: structure => {
			return structure.structureType === STRUCTURE_CONTAINER;
		}});
		let allSources = miner.room.find(FIND_SOURCES);
		let adjacentContainers = [];
		_.forEach(allSources, source => {
			_.forEach(allContainers, container => {
				if (container.pos.isNearTo(source)) {
					adjacentContainers.push(container);
				}
			});
			_.forEach(allContainerSites, site => {
				if (site.pos.isNearTo(source)) {
					adjacentContainers.push(site);
				}
			})
		});
		miner.room.memory.minerDropContainerIds = !_.isEmpty(_.map(adjacentContainers, 'id')) ? _.map(adjacentContainers, 'id') : [];
	},
};


