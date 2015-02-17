'use strict';

var EventTypes = ['active', 'locked', 'idle'];
var DaysOfWeek = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tues',
  3: 'Weds',
  4: 'Thurs',
  5: 'Fri',
  6: 'Sat'
};

if (Object.freeze) {
  Object.freeze(EventTypes);
  Object.freeze(DaysOfWeek);
}

function ConfigurationModel() {
  this.pushBulletApiToken = '';
  this.initialized = false;
}

function Device(d) {
  this.id = d.iden;
  this.name = d.nickname;
  this.type = d.type;
}

function DataModel() {
  this.subscriptions = [];

  this.globalEnabled = true;
  this.showDesktopNotifications = false;
  this.hideDisabled = false;
  this.wakeUpDelay = 0; //TODO: implement
}

function Subscription(d) {
  this.device = new Device(d);
  this.enabled = false;
  this.selected = false;
  this.timeframes = [new Timeframe()];
}

function Event(et) {
  this.eventType = et;
  this.subscribed = true;
  this.customMessage = '';
}

function Day(dayIndex) {
  this.id = dayIndex;
  this.enabled = false;
}

function Timeframe() {
  this.name = '';
  this.allDay = true;
  this.begin = new Date();
  this.end = new Date();;
  this.invert = false;

  this.days = [];
  for (var d in DaysOfWeek) {
    this.days.push(new Day(d));
  }

  this.events = [];
  for (var e in EventTypes) {
    this.events.push(new Event(EventTypes[e]));
  }
}

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};
