import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';

import { guidGenerator } from '../../startup/both/modules/crypto';
import { Contracts } from '../../api/contracts/Contracts';


let node = '';
let currentParent = '';


/**
/* @summary - helper function to resolve path on searchTree
*/
const resolvePath = (uri) => {
  let path = [];
  path = uri.split('.');
  path.splice(-2, 2);
  // uri = path.toString().replace(/,/g, '.');
  return path.toString().replace(/,/g, '.');
};

/**
/* @summary - searches the thread tree to locate the node that's being modified
/* @param {object} element - object from `events` array
/* @param {string} matchingTitle - title or id of element in subject
/* @param {string} iterator
/* @param {boolean} isRoot - indicates first parent or not
/* @param {string} inheritedPath - indicates correct path for recurssion
/* @param {string} target - what is being searched, '.children' (for postComment),
                          '.sortTotal' (for voteComment)
*/
const searchTree = (element, matchingTitle, iterator, isRoot, inheritedPath, target) => {
  let parentStr;
  if (element.id === matchingTitle) {
    if (iterator !== undefined) {
      if (isRoot) {
        return `events.${iterator.toString()}${target}`;
      }
      parentStr = `.${iterator.toString()}${target}`;
      node += inheritedPath + parentStr;
      return node;
    }
  } else if (element.children !== undefined) {
    let i;
    let result = '';
    if (isRoot) {
      currentParent = 'events';
    }
    currentParent += `.${iterator.toString()}.children`;
    for (i = 0; result === '' && i < element.children.length; i += 1) {
      result = searchTree(element.children[i], matchingTitle, i, false, currentParent, target);
    }
    if (result === '') {
      currentParent = resolvePath(currentParent);
    }
    return result;
  }
  return '';
};

/**
/* @summary posts a comment on a thread
/* @param {string} contractId - contract where this comment goes.
/* @param {object} eventObject - object containing the event info
/* @param {string} replyId - if reply to another comment, id of such comment.
*/
export const postComment = (contractId, eventObj, replyId) => {
  let thread = [];
  const eventObject = eventObj;
  const query = {};
  if (replyId === undefined) {
    Contracts.update(contractId, { $push: { events: eventObject } });
  } else {
    // add event object dynamic key values since Schema is blackboxed to enable infinite branching.
    eventObject.timestamp = new Date();
    eventObject.status = 'NEW';
    eventObject.id = guidGenerator();
    thread = Contracts.find({ _id: Session.get('contract')._id }).fetch()[0].events;
    node = '';
    currentParent = '';
    for (const children in thread) {
      node += searchTree(thread[children], replyId, children, true, '', '.children');
    }
    query[node] = eventObject;
    Contracts.update(
      { _id: contractId },
      { $push: query }
    );
  }
};

/**
/* @summary - upvotes or downvotes a comment
/* @param {string} contractId - contract where this comment goes.
/* @param {string} threadId - exact comment that is being up/down voted
/* @param {string} vote - indicates where it's an upvote (1) or downvote (-1)
/* @param {boolean} removal - removes the vote rather than adding one
*/
export const voteComment = (contractId, threadId, vote, removal) => {
  const thread = Contracts.find({ _id: contractId }).fetch()[0].events;
  const query = {};
  node = '';
  currentParent = '';
  for (const children in thread) {
    node += searchTree(thread[children], threadId, children, true, '', '.votes');
  }

  // build query
  query[node] = {
    quantity: vote,
    userId: Meteor.userId(),
  };

  if (removal === true) {
    Contracts.update(
      { _id: contractId },
      { $pull: query }
    );
  } else {
    // store vote in contract thread
    Contracts.update(
      { _id: contractId },
      { $push: query }
    );
  }
};
