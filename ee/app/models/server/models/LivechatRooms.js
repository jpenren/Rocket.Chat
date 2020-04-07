import { LivechatRooms } from '../../../../../app/models/server/models/LivechatRooms';
import { logger } from '../../../livechat-enterprise/server/lib/logger';
import { addQueryRestrictionsToRoomsModel } from '../../../livechat-enterprise/server/lib/query.helper';
import { overwriteClassOnLicense } from '../../../license/server';
import LivechatPriority from './LivechatPriority';

const applyRestrictions = (method) => function(originalFn, originalQuery, ...args) {
	const query = addQueryRestrictionsToRoomsModel(originalQuery);
	logger.queries.debug(() => `LivechatRooms.${ method } - ${ JSON.stringify(query) }`);
	return originalFn.call(this, query, ...args);
};

overwriteClassOnLicense('livechat-enterprise', LivechatRooms, {
	find: applyRestrictions('find'),
	findOne: applyRestrictions('findOne'),
	update: applyRestrictions('update'),
	remove: applyRestrictions('remove'),
	updateDepartmentAncestorsById(originalFn, _id, departmentAncestors) {
		const query = {
			_id,
		};
		const update = departmentAncestors ? { $set: { departmentAncestors } } : { $unset: { departmentAncestors: 1 } };
		return this.update(query, update);
	},
	saveRoomById(originalFn, ...args) {
		if (!args.length || !args[0].priority) {
			this.update({ _id: args[0]._id }, {
				$unset: { 'omnichannel.priority': 1 },
			});
			return originalFn.apply(this, args);
		}
		const priority = LivechatPriority.findOneById(args[0].priority);
		if (!priority) {
			throw new Error('Invalid Priority');
		}
		this.update({ _id: args[0]._id }, {
			$set: {
				'omnichannel.priority': {
					_id: priority._id,
					name: priority.name,
					dueTimeInMinutes: parseInt(priority.dueTimeInMinutes),
				},
				customProperties: {
					avatar: {
						color: priority.color,
					},
				},
			},
		});
		return originalFn.apply(this, args);
	},
});

LivechatRooms.prototype.updatePriorityDataByPriorityId = function(priorityId, priorityData) {
	return this.update({
		'omnichannel.priority._id': priorityId,
		t: 'l',
		open: true,
	},
	{
		$set: {
			'omnichannel.priority.name': priorityData.name,
			'omnichannel.priority.dueTimeInMinutes': parseInt(priorityData.dueTimeInMinutes),
			'customProperties.avatar.color': priorityData.color,
		},
	});
};

LivechatRooms.prototype.unsetPriorityByPriorityId = function(priorityId) {
	return this.update({
		'omnichannel.priority._id': priorityId,
		t: 'l',
		open: true,
	},
	{
		$unset: {
			'omnichannel.priority': 1,
			'customProperties.avatar.color': 1,
		},
	});
};

export default LivechatRooms;
