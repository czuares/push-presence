'use strict';

var StorageTypes = [ 'local', 'sync' ];
var EventTypes = [ 'active','locked','idle' ];
if(Object.freeze){
  Object.freeze(StorageTypes);
  Object.freeze(EventTypes);
}

function DataModel() {
  this.pushBulletApiToken = '';
  this.deviceId = null;
  this.devices = [];
  this.subscriptions = [];
}

function Subscription(storageType) {
  this.deviceId = null;
  this.storageType = storageType;
  this.timeframes = [new Timeframe()];
  this.events = [];
  for(var e in EventTypes){
    this.events.push(new Event(EventTypes[e]));
  }
}

function Event(et){
  this.eventType = et;
  this.subscribed = false;
  this.customMessage = '';
}

function Timeframe() {
  this.begin = new Date().toISOString();
  this.end = new Date().toISOString();
  this.invert = false;
}

String.prototype.capitalize = function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
};