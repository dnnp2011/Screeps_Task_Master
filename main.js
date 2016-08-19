var _ = require('lodash');
var utils = require('_utilities');
require('_prototypes');
require('_constants');
var taskManager = require('task_manager');

module.exports = {
	
	loop: function () {
		
		if (Game.time % GC_INTERVAL === 0) {
			this.performGC();
		}
		
		_.forEach(Game.rooms, room => {
			taskManager.generateTasksForRoom(room.name);
		});
		
		_.forEach(Game.creeps, creep => {
			let loadout = LOADOUTS[creep.memory.loadout];
			loadout.run(creep);
		});
		
		_.forEach(Game.creeps, creep => {
			//If a creep enters an un-owned, non-visible room, it will either update an existing room registry or create a new one.
			if ((!creep.room.controller || !creep.room.controller.my) && !_.filter(Game.creeps, thisCreep => {if (thisCreep.pos.roomName === creep.room.name){return thisCreep}}).length > 1) {
				utils.updateOrCreateNewRoomRegister(creep);
			}
		});
	},
	
	
	performGC : function () {
		_.forEach(['creeps', 'flags', 'spawns'], type => {
			if (_.has(Memory, type) && _.has(Game, type)) {
				_.forEach(Memory[type], (value, name) => {
					if (!_.has(Game[type], name)) {
						utils.addToLog(`GC: Deleting memory of ${type.slice(0, -1)} ${name}`);
						delete Memory[type][name];
					}
				});
			}
		});
		
		_.forEach(Memory.structures, (value, id) => {
			if (Game.getObjectById(id) === null) {
				utils.addToLog(`GC: Deleting memory of structure ${id}`);
				delete Memory.structures[id];
			}
		});
	},
	
};