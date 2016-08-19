/**
 * Tick interval at which Garbage Collection will occur.
 * @type {number}
 */
global.GC_INTERVAL = 5;


/**
 * The in-game user name of this player.
 * @type {string}
 */
global.USER_NAME = 'Drowsy';


/**
 * The number of ticks that will pass before a room's Tasks are updated.
 * @type {number}
 */
global.TASK_UPDATE_INTERVAL = 5;

global.PATH_FAIL = -1;
global.PATH_FOUND = 1;
global.PATH_CHANGED = 2;
global.PATH_WALKING = 3;
global.PATH_END = 4;
global.PATH_ERROR = 5;


global.TASK_BUILD = 'build';
global.TASK_REPAIR = 'repair';
global.TASK_UPGRADE_CONTROLLER = 'upgradeController';
global.TASK_HARVEST = 'harvest';
global.TASK_HARVEST_MINERAL = 'harvestMineral';
global.TASK_HARVEST_REMOTE_ENERGY = 'harvestRemoteEnergy';
global.TASK_HARVEST_REMOTE_MINERAL = 'harvestRemoteMineral';
global.TASK_HAUL_TO = 'transferTo';
global.TASK_HAUL_FROM = 'transferFrom';
global.TASK_LINK_TRANSFER = 'transferEnergy';
global.TASK_TERMINAL_TRANSFER = 'send';
global.TASK_RENEW = 'renew';
global.TASK_CLAIM = 'claimThisRoom';
global.TASK_ATTACK = 'attack';
global.TASK_HEAL = 'heal';
global.TASK_SCOUT = 'scoutThisRoom';


global.LOADOUT_HARVEST = 'harvester';
global.LOADOUT_HAUL = 'hauler';
global.LOADOUT_GENERIC = 'generic';
global.LOADOUT_ATTACK = 'attacker';
global.LOADOUT_HEAL = 'healer';
global.LOADOUT_CLAIM = 'claimer';
global.LOADOUT_SCOUT = 'scout';
global.LOADOUT_SPAWN = 'spawn';


global.LOADOUTS = {
	[LOADOUT_HARVEST] : require('loadout_harvest')
	/*[LOADOUT_HAUL] : require('loadout_haul'),
	[LOADOUT_GENERIC] : require('loadout_generic'),
	[LOADOUT_ATTACK] : require('loadout_attack'),
	[LOADOUT_HEAL] : require('loadout_heal'),
	[LOADOUT_CLAIM] : require('loadout_claim'),
	[LOADOUT_SCOUT] : require('loadout_scout')*/
};


global.TASK_MAX_CREEPS = {
	[TASK_BUILD]: 3,
	[TASK_REPAIR]: 1,
	[TASK_HAUL_FROM]: 1,
	[TASK_HAUL_TO]: 1,
	[TASK_HARVEST]: 1,
	[TASK_UPGRADE_CONTROLLER]: 2,
	[TASK_TERMINAL_TRANSFER]: 1,
	[TASK_RENEW]: 1,
	[TASK_CLAIM]: 1,
	[TASK_SCOUT]: 1
};


global.STRUCTURE_TARGET_HITS = {
	[STRUCTURE_WALL]: {
		0: 1,
		1: 10000,
		2: 50000,
		3: 75000,
		4: 150000,
		5: 300000,
		6: 600000,
		7: 1500000,
		8: 3000000
	},
	[STRUCTURE_RAMPART]: {
		0: 1,
		1: 20000,
		2: 60000,
		3: 120000,
		4: 250000,
		5: 500000,
		6: 1000000,
		7: 1500000,
		8: 3000000
	}
};

global.LINK_TRANSFER_THRESHOLD = 0.25;
global.LINK_TICK_THRESHOLD = 25;

global.TASK_PRIO_BUILD = 0.3;
global.TASK_PRIO_BUILD_ADJACENT_SPAWN = 0.1;

global.PRIO_HOME_ENERGY_SOURCE = 0.1;
global.PRIO_ADJACENT_ENERGY_SOURCE = 0.3;
global.PRIO_HOME_MINERAL_SOURCE = 0.5;
global.PRIO_ADJACENT_MINERAL_SOURCE = 0.7;

global.PRIO_SCOUT_ADJACENT_ROOM = 0;
global.PRIO_CLAIM_ROOM = 0;

global.PRIO_TOWER_REPAIR = 0.1;
global.PRIO_STRUCTURE_REPAIR = 0.2;
global.PRIO_RAMPART_REPAIR = 0.85;
global.PRIO_WALL_REPAIR = 0.9;

global.PRIO_UPGRADE_CONTROLLER = 0.2;

global.PRIO_ATTACK_TOWER = 0.1;
global.PRIO_ATTACK_MELEE_CREEP = 0.2;
global.PRIO_ATTACK_RANGED_CREEP = 0.25;
global.PRIO_ATTACK_HEAL_CREEP = 0.3;
global.PRIO_ATTACK_SPAWN = 0.35;
global.PRIO_ATTACK_GENERIC_CREEP = 0.4;
global.PRIO_ATTACK_STRUCTURES = 0.45;
global.PRIO_ATTACK_CONSTRUCTION_SITES = 0.5;

global.PRIO_HEAL_CREEP = 0.1;
global.PRIO_RENEW_CREEP = 0.1;

global.PRIO_HAUL_ENERGY_MINER = 0.1;
global.PRIO_HAUL_REMOTE_MINER = 0.35;
global.PRIO_HAUL_MINERAL_MINER = 0.5;
global.PRIO_HAUL_REMOTE_MINERAL = 0.6;
global.PRIO_HAUL_LINK_TO_STORAGE = 0.15;
global.PRIO_HAUL_STORAGE_TO_TERMINAL = 0.45;
global.PRIO_HAUL_STORAGE_TO_SPAWN_EXTENSIONS = 0.2;
global.PRIO_HAUL_STORAGE_TO_TOWER = 0.2;
global.PRIO_HAUL_TERMINAL_TO_STORAGE = 0.2;
